// CLI エントリーポイント
// masterpiece generate / templates / issuer / recipient / serve コマンド

import { Command } from 'commander';
import { generateCommand } from './commands/generate.js';
import { listTemplatesCommand } from './commands/list-templates.js';
import {
  issuerListCommand,
  issuerAddCommand,
  issuerUpdateCommand,
  issuerDeleteCommand,
} from './commands/issuer.js';
import {
  recipientListCommand,
  recipientSearchCommand,
  recipientAddCommand,
  recipientUpdateCommand,
  recipientDeleteCommand,
} from './commands/recipient.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('masterpiece')
  .description('MasterPiece Mini - 帳票PDF生成ツール')
  .version(VERSION);

// generate コマンド
program
  .command('generate')
  .description('帳票PDFを生成する')
  .requiredOption('-t, --template <name>', 'テンプレート名（例: 見積書）')
  .option('-d, --data <path>', 'データファイルパス（JSON）')
  .option('--tsv <text>', 'TSVデータを直接指定')
  .option('--stdin', '標準入力からJSONデータを読む')
  .option('-o, --output <path>', '出力PDFパス')
  .option('--paper <size>', '用紙サイズ（A4|A5）', 'A4')
  .option('--orientation <dir>', '向き（portrait|landscape）', 'portrait')
  .option('--issuer <id>', 'DBの自社情報IDを使用')
  .option('--recipient <id>', 'DBの得意先IDを使用')
  .option('--no-stamp', 'ハンコを非表示')
  .option('--no-logo', 'ロゴを非表示')
  .option('--json', '結果をJSON形式で出力')
  .option('--dry-run', '実行せずパラメータ確認のみ')
  .action(generateCommand);

// templates コマンド
program
  .command('templates')
  .description('利用可能なテンプレート一覧を表示する')
  .option('--json', 'JSON形式で出力')
  .action(listTemplatesCommand);

// ===== issuer（自社情報）コマンド =====
const issuerCmd = program
  .command('issuer')
  .description('自社情報の管理');

issuerCmd
  .command('list')
  .description('自社情報の一覧')
  .option('--json', 'JSON形式で出力')
  .action(issuerListCommand);

issuerCmd
  .command('add')
  .description('自社情報を追加')
  .requiredOption('--name <name>', '会社名')
  .requiredOption('--address <address>', '住所')
  .requiredOption('--tel <tel>', '電話番号')
  .option('--fax <fax>', 'FAX番号')
  .option('--default', 'デフォルトに設定')
  .option('--json', 'JSON形式で出力')
  .action(issuerAddCommand);

issuerCmd
  .command('update <id>')
  .description('自社情報を更新')
  .option('--name <name>', '会社名')
  .option('--address <address>', '住所')
  .option('--tel <tel>', '電話番号')
  .option('--fax <fax>', 'FAX番号')
  .option('--default', 'デフォルトに設定')
  .option('--json', 'JSON形式で出力')
  .action(issuerUpdateCommand);

issuerCmd
  .command('delete <id>')
  .description('自社情報を削除')
  .option('--json', 'JSON形式で出力')
  .action(issuerDeleteCommand);

// ===== recipient（得意先）コマンド =====
const recipientCmd = program
  .command('recipient')
  .description('得意先の管理');

recipientCmd
  .command('list')
  .description('得意先の一覧')
  .option('--json', 'JSON形式で出力')
  .action(recipientListCommand);

recipientCmd
  .command('search <query>')
  .description('得意先を検索')
  .option('--json', 'JSON形式で出力')
  .action(recipientSearchCommand);

recipientCmd
  .command('add')
  .description('得意先を追加')
  .requiredOption('--name <name>', '会社名')
  .option('--person <name>', '担当者名')
  .option('--honorific <title>', '敬称（様/御中）', '御中')
  .option('--address <address>', '住所')
  .option('--tel <tel>', '電話番号')
  .option('--json', 'JSON形式で出力')
  .action(recipientAddCommand);

recipientCmd
  .command('update <id>')
  .description('得意先を更新')
  .option('--name <name>', '会社名')
  .option('--person <name>', '担当者名')
  .option('--honorific <title>', '敬称')
  .option('--address <address>', '住所')
  .option('--tel <tel>', '電話番号')
  .option('--json', 'JSON形式で出力')
  .action(recipientUpdateCommand);

recipientCmd
  .command('delete <id>')
  .description('得意先を削除')
  .option('--json', 'JSON形式で出力')
  .action(recipientDeleteCommand);

// serve コマンド
program
  .command('serve')
  .description('プレビューサーバーを起動する')
  .option('-p, --port <number>', 'ポート番号', '3000')
  .option('--host <addr>', 'ホスト', 'localhost')
  .option('--no-open', 'ブラウザを自動で開かない')
  .action(async (opts: { port: string; host: string; open: boolean }) => {
    const { startServer } = await import('../server/index.js');
    await startServer({ port: parseInt(opts.port, 10), host: opts.host, open: opts.open });
  });

program.parse();
