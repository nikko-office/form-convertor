// recipient コマンド：得意先の管理（一覧・追加・更新・削除・検索）

import {
  listRecipients,
  addRecipient,
  updateRecipient,
  deleteRecipient,
  searchRecipients,
} from '../../core/database.js';

interface RecipientAddOptions {
  name: string;
  person?: string;
  honorific?: string;
  address?: string;
  tel?: string;
  json?: boolean;
}

interface RecipientUpdateOptions {
  name?: string;
  person?: string;
  honorific?: string;
  address?: string;
  tel?: string;
  json?: boolean;
}

// 一覧表示
export async function recipientListCommand(options: { json?: boolean }): Promise<void> {
  const recipients = await listRecipients();

  if (options.json) {
    console.log(JSON.stringify(recipients, null, 2));
    return;
  }

  if (recipients.length === 0) {
    console.log('得意先が登録されていません。`masterpiece recipient add` で追加してください。');
    return;
  }

  for (const r of recipients) {
    const person = r.personName ? ` ${r.personName}${r.honorific ?? ''}` : '';
    console.log(`  ${r.id}  ${r.companyName}${person}`);
    if (r.address) console.log(`         ${r.address}`);
    if (r.tel) console.log(`         TEL: ${r.tel}`);
    console.log('');
  }
}

// 検索
export async function recipientSearchCommand(query: string, options: { json?: boolean }): Promise<void> {
  const results = await searchRecipients(query);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(`"${query}" に一致する得意先が見つかりません`);
    return;
  }

  console.log(`検索結果: ${results.length}件`);
  for (const r of results) {
    const person = r.personName ? ` ${r.personName}${r.honorific ?? ''}` : '';
    console.log(`  ${r.id}  ${r.companyName}${person}`);
  }
}

// 追加
export async function recipientAddCommand(options: RecipientAddOptions): Promise<void> {
  const recipient = await addRecipient({
    companyName: options.name,
    personName: options.person,
    honorific: options.honorific ?? '御中',
    address: options.address,
    tel: options.tel,
  });

  if (options.json) {
    console.log(JSON.stringify({ success: true, recipient }, null, 2));
  } else {
    console.log(`得意先を登録しました: ${recipient.companyName} (ID: ${recipient.id})`);
  }
}

// 更新
export async function recipientUpdateCommand(id: string, options: RecipientUpdateOptions): Promise<void> {
  const data: Record<string, unknown> = {};
  if (options.name !== undefined) data.companyName = options.name;
  if (options.person !== undefined) data.personName = options.person;
  if (options.honorific !== undefined) data.honorific = options.honorific;
  if (options.address !== undefined) data.address = options.address;
  if (options.tel !== undefined) data.tel = options.tel;

  const result = await updateRecipient(id, data);

  if (!result) {
    console.error(`エラー: ID "${id}" の得意先が見つかりません`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ success: true, recipient: result }, null, 2));
  } else {
    console.log(`得意先を更新しました: ${result.companyName}`);
  }
}

// 削除
export async function recipientDeleteCommand(id: string, options: { json?: boolean }): Promise<void> {
  const deleted = await deleteRecipient(id);

  if (!deleted) {
    console.error(`エラー: ID "${id}" の得意先が見つかりません`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ success: true, deletedId: id }, null, 2));
  } else {
    console.log(`得意先を削除しました (ID: ${id})`);
  }
}
