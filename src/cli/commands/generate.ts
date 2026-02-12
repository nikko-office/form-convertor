// generate コマンド：テンプレート + データ → PDF生成

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { renderTemplate, type TemplateData } from '../../core/template-engine.js';
import { generatePdfToFile, closeBrowser } from '../../core/pdf-generator.js';
import { parseTsv } from '../../core/tsv-parser.js';
import { calculateTotals, calculateLineAmount } from '../../core/calculator.js';
import { createLogger } from '../../core/logger.js';
import { getIssuer, getDefaultIssuer, getRecipient } from '../../core/database.js';
import { DEFAULT_VISIBILITY } from '../../core/template-engine.js';

interface GenerateOptions {
  template: string;
  data?: string;
  tsv?: string;
  stdin?: boolean;
  output?: string;
  paper: string;
  orientation: string;
  issuer?: string;     // DB自社情報ID
  recipient?: string;  // DB得意先ID
  stamp: boolean;
  logo: boolean;
  json?: boolean;
  dryRun?: boolean;
}

/**
 * generate コマンドの実行処理
 */
export async function generateCommand(options: GenerateOptions): Promise<void> {
  const logger = createLogger();
  const startTime = Date.now();

  try {
    logger.info({ options: { ...options, data: options.data ? '(file)' : undefined } }, 'generate コマンド開始');

    // パラメータバリデーション
    const paperSize = validatePaperSize(options.paper);
    const orientation = validateOrientation(options.orientation);

    // DBから自社情報・得意先を取得
    const dbIssuer = options.issuer
      ? await getIssuer(options.issuer)
      : await getDefaultIssuer();
    const dbRecipient = options.recipient
      ? await getRecipient(options.recipient)
      : undefined;

    if (options.issuer && !dbIssuer) {
      throw new Error(`自社情報が見つかりません (ID: ${options.issuer})`);
    }
    if (options.recipient && !dbRecipient) {
      throw new Error(`得意先が見つかりません (ID: ${options.recipient})`);
    }

    // データ読み込み
    let templateData: TemplateData;
    if (options.data) {
      // JSONファイルから読み込み
      const raw = await readFile(resolve(options.data), 'utf-8');
      templateData = buildTemplateData(JSON.parse(raw), paperSize, orientation, options);
    } else if (options.tsv) {
      // TSV直接指定
      templateData = buildFromTsv(options.tsv, paperSize, orientation, options);
    } else if (options.stdin) {
      // 標準入力からJSON読み込み
      const raw = await readStdin();
      templateData = buildTemplateData(JSON.parse(raw), paperSize, orientation, options);
    } else {
      throw new Error('データソースを指定してください: --data, --tsv, または --stdin');
    }

    // DBの自社情報で上書き（--issuer指定時、またはデフォルトがある場合）
    if (dbIssuer) {
      templateData.issuer = {
        companyName: dbIssuer.companyName,
        address: dbIssuer.address,
        tel: dbIssuer.tel,
        fax: dbIssuer.fax,
      };
    }

    // DBの得意先で上書き（--recipient指定時）
    if (dbRecipient) {
      templateData.recipient = {
        companyName: dbRecipient.companyName,
        department: dbRecipient.department,
        personName: dbRecipient.personName,
        honorific: dbRecipient.honorific,
      };
    }

    // dry-run: パラメータ確認のみ
    if (options.dryRun) {
      const info = {
        template: options.template,
        paperSize,
        orientation,
        itemCount: templateData.items.length,
        subtotal: templateData.subtotal,
        total: templateData.total,
        showStamp: templateData.showStamp,
        showLogo: templateData.showLogo,
      };
      if (options.json) {
        console.log(JSON.stringify({ dryRun: true, ...info }, null, 2));
      } else {
        console.log('=== Dry Run ===');
        console.log(`テンプレート: ${info.template}`);
        console.log(`用紙: ${info.paperSize} ${info.orientation}`);
        console.log(`明細行数: ${info.itemCount}`);
        console.log(`合計: ¥${info.total.toLocaleString('ja-JP')}`);
      }
      return;
    }

    // テンプレートレンダリング
    logger.info('テンプレートをレンダリング中...');
    const html = await renderTemplate(options.template, templateData);

    // 出力パス決定
    const timestamp = formatTimestamp(new Date());
    const outputPath = options.output
      ?? join(process.cwd(), 'output', `${options.template}_${timestamp}.pdf`);

    // PDF生成
    logger.info({ outputPath }, 'PDF生成中...');
    const savedPath = await generatePdfToFile(html, {
      paperSize,
      orientation,
      outputPath,
    });

    const duration = Date.now() - startTime;
    logger.info({ savedPath, durationMs: duration }, 'PDF生成完了');

    // 結果出力
    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        outputPath: savedPath,
        template: options.template,
        paperSize,
        orientation,
        generatedAt: new Date().toISOString(),
        durationMs: duration,
        version: '0.1.0',
      }, null, 2));
    } else {
      console.log(`PDF生成完了: ${savedPath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'PDF生成に失敗しました');

    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: {
          code: 'GENERATE_FAILED',
          message,
        },
      }, null, 2));
    } else {
      console.error(`エラー: ${message}`);
    }
    process.exitCode = 1;
  } finally {
    await closeBrowser();
  }
}

/**
 * JSONデータからTemplateDataを構築する
 */
function buildTemplateData(
  raw: Record<string, unknown>,
  paperSize: 'A4' | 'A5',
  orientation: 'portrait' | 'landscape',
  options: GenerateOptions
): TemplateData {
  const items = (raw.items as Array<Record<string, unknown>> ?? []).map((item, i) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return {
      index: i + 1,
      description: String(item.description ?? ''),
      quantity: qty,
      unit: String(item.unit ?? ''),
      unitPrice: price,
      amount: calculateLineAmount(qty, price),
    };
  });

  const lineItems = items.map(i => ({
    quantity: typeof i.quantity === 'number' ? i.quantity : 0,
    unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : 0,
  }));
  const taxRate = Number(raw.taxRate) || 0.10;
  const totals = calculateTotals(lineItems, taxRate);

  return {
    documentDate: String(raw.documentDate ?? new Date().toISOString().split('T')[0]),
    documentNumber: String(raw.documentNumber ?? ''),
    issuer: raw.issuer as TemplateData['issuer'] ?? {
      companyName: '',
      address: '',
      tel: '',
    },
    recipient: raw.recipient as TemplateData['recipient'] ?? {
      companyName: '',
    },
    subject: String(raw.subject ?? ''),
    items,
    ...totals,
    remarks: String(raw.remarks ?? ''),
    validUntil: raw.validUntil ? String(raw.validUntil) : undefined,
    paymentTerms: raw.paymentTerms ? String(raw.paymentTerms) : undefined,
    deliveryDate: raw.deliveryDate ? String(raw.deliveryDate) : undefined,
    paperSize,
    orientation,
    showStamp: options.stamp,
    showLogo: options.logo,
    visibility: { ...DEFAULT_VISIBILITY },
    images: raw.images as TemplateData['images'],
  };
}

/**
 * TSVデータからTemplateDataを構築する
 * TSVカラム: 品名, 数量, 単位, 単価
 */
function buildFromTsv(
  tsv: string,
  paperSize: 'A4' | 'A5',
  orientation: 'portrait' | 'landscape',
  options: GenerateOptions
): TemplateData {
  const parsed = parseTsv(tsv, { hasHeader: true });

  const items = parsed.rows.map((row, i) => {
    const description = row[0] ?? '';
    const quantity = Number(row[1]) || 0;
    const unit = row[2] ?? '';
    const unitPrice = Number(row[3]) || 0;
    return {
      index: i + 1,
      description,
      quantity,
      unit,
      unitPrice,
      amount: calculateLineAmount(quantity, unitPrice),
    };
  });

  const lineItems = items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice }));
  const totals = calculateTotals(lineItems);

  return {
    documentDate: new Date().toISOString().split('T')[0],
    documentNumber: '',
    issuer: { companyName: '', address: '', tel: '' },
    recipient: { companyName: '' },
    subject: '',
    items,
    ...totals,
    remarks: '',
    paperSize,
    orientation,
    showStamp: options.stamp,
    showLogo: options.logo,
    visibility: { ...DEFAULT_VISIBILITY },
  };
}

function validatePaperSize(size: string): 'A4' | 'A5' {
  const upper = size.toUpperCase();
  if (upper !== 'A4' && upper !== 'A5') {
    throw new Error(`無効な用紙サイズ: ${size}（A4またはA5を指定してください）`);
  }
  return upper;
}

function validateOrientation(dir: string): 'portrait' | 'landscape' {
  if (dir !== 'portrait' && dir !== 'landscape') {
    throw new Error(`無効な向き: ${dir}（portraitまたはlandscapeを指定してください）`);
  }
  return dir;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function formatTimestamp(date: Date): string {
  return date.getFullYear().toString()
    + String(date.getMonth() + 1).padStart(2, '0')
    + String(date.getDate()).padStart(2, '0')
    + '_'
    + String(date.getHours()).padStart(2, '0')
    + String(date.getMinutes()).padStart(2, '0')
    + String(date.getSeconds()).padStart(2, '0');
}
