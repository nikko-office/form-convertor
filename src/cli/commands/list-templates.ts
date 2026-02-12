// templates コマンド：利用可能なテンプレート一覧

import { listTemplates } from '../../core/template-engine.js';

interface ListOptions {
  json?: boolean;
}

export async function listTemplatesCommand(options: ListOptions): Promise<void> {
  try {
    const templates = await listTemplates();

    if (options.json) {
      console.log(JSON.stringify(
        templates.map(name => ({ name, paperSize: 'A4', orientation: 'portrait' })),
        null,
        2
      ));
    } else {
      console.log('利用可能なテンプレート:');
      for (const name of templates) {
        console.log(`  ${name}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: { code: 'LIST_FAILED', message } }));
    } else {
      console.error(`エラー: ${message}`);
    }
    process.exitCode = 1;
  }
}
