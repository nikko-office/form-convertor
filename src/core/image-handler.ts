// 画像処理：ファイル/バッファからBase64 data URL変換

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

// 拡張子→MIMEタイプのマッピング
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * ファイルパスからBase64 data URLに変換する
 */
export async function fileToBase64DataUrl(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext];
  if (!mimeType) {
    throw new Error(`未対応の画像形式です: ${ext}`);
  }

  const buffer = await readFile(filePath);
  return bufferToBase64DataUrl(buffer, mimeType);
}

/**
 * バッファからBase64 data URLに変換する（Web UIのクリップボード画像用）
 */
export function bufferToBase64DataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Base64 data URLのバリデーション
 */
export function validateBase64Image(dataUrl: string): boolean {
  return /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl);
}
