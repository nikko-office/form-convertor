// ロガー：pinoベース、ファイル+stdout二重出力
// META-PROMPTルールに従い、バージョン・OS・起動時刻をログに記録する

import pino from 'pino';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform, arch } from 'node:os';

// package.jsonから読み込むバージョン情報
const VERSION = '0.1.0';

export interface LoggerOptions {
  logDir?: string;
  level?: string;
}

/**
 * ロガーを作成する
 * stdout + ファイル（logs/YYYYMMDD_HHMMSS.log）の二重出力
 */
export function createLogger(options?: LoggerOptions): pino.Logger {
  const logDir = options?.logDir ?? join(process.cwd(), 'logs');
  const level = options?.level ?? 'info';

  // ログディレクトリがなければ作成
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // タイムスタンプ付きログファイル名
  const now = new Date();
  const timestamp = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '_'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const logFile = join(logDir, `${timestamp}.log`);

  // stdout + ファイルへの二重出力
  const transport = pino.transport({
    targets: [
      {
        target: 'pino-pretty',
        options: { colorize: true },
        level,
      },
      {
        target: 'pino/file',
        options: { destination: logFile, mkdir: true },
        level,
      },
    ],
  });

  const logger = pino({ level }, transport);

  // 起動情報をログに記録
  logger.info({
    version: VERSION,
    os: platform(),
    arch: arch(),
    startedAt: now.toISOString(),
    nodeVersion: process.version,
  }, 'MasterPiece Mini 起動');

  return logger;
}
