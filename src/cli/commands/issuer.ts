// issuer コマンド：自社情報の管理（一覧・追加・更新・削除）

import {
  listIssuers,
  addIssuer,
  updateIssuer,
  deleteIssuer,
  getIssuer,
} from '../../core/database.js';

interface IssuerAddOptions {
  name: string;
  address: string;
  tel: string;
  fax?: string;
  default?: boolean;
  json?: boolean;
}

interface IssuerUpdateOptions {
  name?: string;
  address?: string;
  tel?: string;
  fax?: string;
  default?: boolean;
  json?: boolean;
}

// 一覧表示
export async function issuerListCommand(options: { json?: boolean }): Promise<void> {
  const issuers = await listIssuers();

  if (options.json) {
    console.log(JSON.stringify(issuers, null, 2));
    return;
  }

  if (issuers.length === 0) {
    console.log('自社情報が登録されていません。`masterpiece issuer add` で追加してください。');
    return;
  }

  for (const i of issuers) {
    const def = i.isDefault ? ' [デフォルト]' : '';
    console.log(`  ${i.id}  ${i.companyName}${def}`);
    console.log(`         ${i.address}`);
    console.log(`         TEL: ${i.tel}${i.fax ? `  FAX: ${i.fax}` : ''}`);
    console.log('');
  }
}

// 追加
export async function issuerAddCommand(options: IssuerAddOptions): Promise<void> {
  const issuer = await addIssuer({
    companyName: options.name,
    address: options.address,
    tel: options.tel,
    fax: options.fax,
    isDefault: options.default ?? false,
  });

  if (options.json) {
    console.log(JSON.stringify({ success: true, issuer }, null, 2));
  } else {
    console.log(`自社情報を登録しました: ${issuer.companyName} (ID: ${issuer.id})`);
  }
}

// 更新
export async function issuerUpdateCommand(id: string, options: IssuerUpdateOptions): Promise<void> {
  const data: Record<string, unknown> = {};
  if (options.name !== undefined) data.companyName = options.name;
  if (options.address !== undefined) data.address = options.address;
  if (options.tel !== undefined) data.tel = options.tel;
  if (options.fax !== undefined) data.fax = options.fax;
  if (options.default !== undefined) data.isDefault = options.default;

  const result = await updateIssuer(id, data);

  if (!result) {
    console.error(`エラー: ID "${id}" の自社情報が見つかりません`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ success: true, issuer: result }, null, 2));
  } else {
    console.log(`自社情報を更新しました: ${result.companyName}`);
  }
}

// 削除
export async function issuerDeleteCommand(id: string, options: { json?: boolean }): Promise<void> {
  const deleted = await deleteIssuer(id);

  if (!deleted) {
    console.error(`エラー: ID "${id}" の自社情報が見つかりません`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ success: true, deletedId: id }, null, 2));
  } else {
    console.log(`自社情報を削除しました (ID: ${id})`);
  }
}
