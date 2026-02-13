// テンプレートエンジン：Handlebarsラッパー
// テンプレートの読み込み、データ注入、CSS/SVGインライン化を行う

import Handlebars from 'handlebars';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { formatCurrency, taxRateToPercent, calculateLineAmount } from './calculator.js';

// プロジェクトルートの解決
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ディレクトリパス
const TEMPLATES_DIR = join(PROJECT_ROOT, 'src', 'templates');
const ASSETS_DIR = join(PROJECT_ROOT, 'assets');
const CSS_DIR = join(ASSETS_DIR, 'css');
const SVG_DIR = join(ASSETS_DIR, 'svg');

// テンプレートデータの型定義
export interface TemplateData {
  documentDate: string;
  documentNumber: string;

  issuer: {
    companyName: string;
    address: string;
    tel: string;
    fax?: string;
  };

  recipient: {
    companyName: string;
    personName?: string;
    honorific?: string;
  };

  subject?: string;

  items: ItemRow[];

  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  remarks?: string;
  validUntil?: string;
  paymentTerms?: string;
  deliveryDate?: string;

  paperSize: 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';

  showStamp: boolean;
  showLogo: boolean;

  // フィールド表示フラグ
  visibility: FieldVisibility;

  images?: EmbeddedImage[];

  // 動的TSVテーブル（任意カラム対応）
  tsvColumns?: string[];
  tsvRows?: string[][];
}

export interface FieldVisibility {
  // 自社情報
  issuerFax: boolean;
  // テンプレート
  subject: boolean;
  totalSummary: boolean;
  remarks: boolean;
  validUntil: boolean;
  paymentTerms: boolean;
  deliveryDate: boolean;
}

export interface ItemRow {
  index: number;
  description: string;
  quantity: number | string;
  unit: string;
  unitPrice: number | string;
  amount: number | string;
}

// 全フィールド表示のデフォルト値
export const DEFAULT_VISIBILITY: FieldVisibility = {
  issuerFax: true,
  subject: true,
  totalSummary: true,
  remarks: true,
  validUntil: true,
  paymentTerms: true,
  deliveryDate: true,
};

export interface EmbeddedImage {
  id: string;
  dataUrl: string;
  width?: string;
  height?: string;
}

// Handlebarsカスタムヘルパー登録
Handlebars.registerHelper('formatCurrency', (amount: number) => formatCurrency(amount));
Handlebars.registerHelper('taxRatePercent', (rate: number) => taxRateToPercent(rate));

/**
 * CSSファイルをすべて読み込んで<style>タグとしてインライン化する
 */
async function loadInlineStyles(): Promise<string> {
  const cssFiles = ['paper.css', 'common.css', 'stamp-overlay.css'];
  const styles: string[] = [];

  for (const file of cssFiles) {
    const cssPath = join(CSS_DIR, file);
    if (existsSync(cssPath)) {
      const css = await readFile(cssPath, 'utf-8');
      styles.push(`/* ${file} */\n${css}`);
    }
  }

  return `<style>\n${styles.join('\n\n')}\n</style>`;
}

/**
 * SVGファイルを読み込む（ハンコ・ロゴ用）
 */
async function loadSvg(name: string): Promise<string> {
  const svgPath = join(SVG_DIR, name);
  if (!existsSync(svgPath)) {
    return '';
  }
  return await readFile(svgPath, 'utf-8');
}

/**
 * テンプレートHTMLを読み込んでHandlebarsコンパイルする
 */
async function loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
  // .html拡張子がなければ付与
  const fileName = templateName.endsWith('.html') ? templateName : `${templateName}.html`;
  const templatePath = join(TEMPLATES_DIR, fileName);

  if (!existsSync(templatePath)) {
    throw new Error(`テンプレートが見つかりません: ${templatePath}`);
  }

  const source = await readFile(templatePath, 'utf-8');
  return Handlebars.compile(source);
}

/**
 * テンプレートにデータを注入して完全なHTML文字列を生成する
 * CSS/SVGはすべてインライン化される
 */
export async function renderTemplate(templateName: string, data: TemplateData): Promise<string> {
  const template = await loadTemplate(templateName);

  // CSSインライン化
  const styles = await loadInlineStyles();

  // SVG読み込み
  const stampSvg = data.showStamp ? await loadSvg('hanko.svg') : '';
  const logoSvg = data.showLogo ? await loadSvg('logo.svg') : '';

  // 明細行にフォーマット済み金額を追加
  const formattedItems = data.items.map((item, i) => {
    const qty = typeof item.quantity === 'string' ? parseFloat(item.quantity) || 0 : item.quantity;
    const price = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) || 0 : item.unitPrice;
    const amount = calculateLineAmount(qty, price);
    return {
      ...item,
      index: item.index || i + 1,
      formattedUnitPrice: formatCurrency(price),
      formattedAmount: formatCurrency(amount),
    };
  });

  // 空行を追加（最低10行表示）
  const MIN_ROWS = 10;
  const emptyRowCount = Math.max(0, MIN_ROWS - formattedItems.length);
  const emptyRows = Array(emptyRowCount).fill({});

  // 動的TSVテーブルがあるか
  const hasDynamicTable = data.tsvColumns && data.tsvColumns.length > 0;

  // テンプレートデータ構築
  const templateData = {
    ...data,
    styles,
    stampSvg,
    logoSvg,
    items: formattedItems,
    emptyRows: hasDynamicTable ? [] : emptyRows,
    formattedSubtotal: formatCurrency(data.subtotal),
    formattedTaxAmount: formatCurrency(data.taxAmount),
    formattedTotal: formatCurrency(data.total),
    taxRatePercent: taxRateToPercent(data.taxRate || 0.10),
    hasDynamicTable,
  };

  return template(templateData);
}

/**
 * 利用可能なテンプレート一覧を取得する
 */
export async function listTemplates(): Promise<string[]> {
  const files = await readdir(TEMPLATES_DIR);
  return files
    .filter(f => f.endsWith('.html') && !f.startsWith('_'))
    .map(f => f.replace('.html', ''));
}
