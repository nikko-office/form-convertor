// Fastifyサーバー：Web UI + API

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../core/logger.js';
import { initBrowser, closeBrowser } from '../core/pdf-generator.js';
import { registerApiRoutes } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');

export async function startServer(options: { port: number; host: string }) {
  const logger = createLogger();

  const app = Fastify({ logger: false });

  // 静的ファイル配信（Web UI）
  await app.register(fastifyStatic, {
    root: join(PROJECT_ROOT, 'src', 'web-ui'),
    prefix: '/',
  });

  // assets配信（CSS、SVG等）
  await app.register(fastifyStatic, {
    root: join(PROJECT_ROOT, 'assets'),
    prefix: '/assets/',
    decorateReply: false,
  });

  // APIルート
  await app.register(registerApiRoutes, { prefix: '/api' });

  // Playwrightブラウザを事前起動
  logger.info('Playwright ブラウザを起動中...');
  await initBrowser();

  // サーバー起動
  try {
    await app.listen({ port: options.port, host: options.host });
    logger.info({ port: options.port, host: options.host }, `サーバー起動: http://${options.host}:${options.port}`);
    console.log(`\nMasterPiece Mini サーバー起動中: http://${options.host}:${options.port}\n`);
  } catch (err) {
    logger.error(err, 'サーバー起動に失敗しました');
    process.exit(1);
  }

  // 終了時のクリーンアップ
  const shutdown = async () => {
    logger.info('シャットダウン中...');
    await closeBrowser();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
