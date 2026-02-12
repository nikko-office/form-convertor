// PDF生成器：Playwright headless Chromium
// ブラウザシングルトン管理、HTML→PDF変換

import { chromium, type Browser } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

export interface PdfOptions {
  paperSize: 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  outputPath?: string;
}

// ブラウザシングルトン（サーバーモード時に再利用）
let browserInstance: Browser | null = null;

/**
 * ブラウザインスタンスを初期化する（サーバーモード用）
 */
export async function initBrowser(): Promise<void> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
  }
}

/**
 * ブラウザインスタンスを閉じる
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * ブラウザインスタンスを取得する（なければ起動）
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

// 用紙サイズのミリ単位定義
const PAPER_DIMENSIONS = {
  A4: { width: '210mm', height: '297mm' },
  A5: { width: '148mm', height: '210mm' },
} as const;

/**
 * HTML文字列からPDFバッファを生成する
 */
export async function generatePdf(
  html: string,
  options: PdfOptions
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // HTMLを直接セット（外部リソースはインライン化済み前提）
    await page.setContent(html, { waitUntil: 'networkidle' });

    const dimensions = PAPER_DIMENSIONS[options.paperSize];
    const isLandscape = options.orientation === 'landscape';

    // PDF生成
    const pdfBuffer = await page.pdf({
      width: isLandscape ? dimensions.height : dimensions.width,
      height: isLandscape ? dimensions.width : dimensions.height,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

/**
 * HTML文字列からPDFファイルを生成し、ファイルに保存する
 * 保存先パスを返す
 */
export async function generatePdfToFile(
  html: string,
  options: PdfOptions & { outputPath: string }
): Promise<string> {
  const pdfBuffer = await generatePdf(html, options);

  // 出力ディレクトリがなければ作成
  const dir = dirname(options.outputPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(options.outputPath, pdfBuffer);
  return options.outputPath;
}
