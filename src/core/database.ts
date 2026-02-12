// データベース：自社情報・得意先をJSONファイルで永続化する

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');

// ===== 型定義 =====

export interface Issuer {
  id: string;
  companyName: string;
  address: string;
  tel: string;
  fax?: string;
  isDefault: boolean;
}

export interface Recipient {
  id: string;
  companyName: string;
  department?: string;
  personName?: string;
  honorific?: string;   // 様、御中 etc.
  address?: string;
  tel?: string;
}

interface Database {
  issuers: Issuer[];
  recipients: Recipient[];
}

// ===== ファイルI/O =====

const DB_PATH = join(DATA_DIR, 'db.json');

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function loadDb(): Promise<Database> {
  await ensureDataDir();
  if (!existsSync(DB_PATH)) {
    return { issuers: [], recipients: [] };
  }
  const raw = await readFile(DB_PATH, 'utf-8');
  return JSON.parse(raw) as Database;
}

async function saveDb(db: Database): Promise<void> {
  await ensureDataDir();
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== 自社情報（Issuer） =====

export async function listIssuers(): Promise<Issuer[]> {
  const db = await loadDb();
  return db.issuers;
}

export async function getIssuer(id: string): Promise<Issuer | undefined> {
  const db = await loadDb();
  return db.issuers.find(i => i.id === id);
}

export async function getDefaultIssuer(): Promise<Issuer | undefined> {
  const db = await loadDb();
  return db.issuers.find(i => i.isDefault) ?? db.issuers[0];
}

export async function addIssuer(data: Omit<Issuer, 'id'>): Promise<Issuer> {
  const db = await loadDb();
  const issuer: Issuer = { ...data, id: generateId() };

  // isDefault が true なら既存のデフォルトを解除
  if (issuer.isDefault) {
    db.issuers.forEach(i => { i.isDefault = false; });
  }

  db.issuers.push(issuer);
  await saveDb(db);
  return issuer;
}

export async function updateIssuer(id: string, data: Partial<Omit<Issuer, 'id'>>): Promise<Issuer | undefined> {
  const db = await loadDb();
  const index = db.issuers.findIndex(i => i.id === id);
  if (index === -1) return undefined;

  // isDefault が true なら既存のデフォルトを解除
  if (data.isDefault) {
    db.issuers.forEach(i => { i.isDefault = false; });
  }

  db.issuers[index] = { ...db.issuers[index], ...data };
  await saveDb(db);
  return db.issuers[index];
}

export async function deleteIssuer(id: string): Promise<boolean> {
  const db = await loadDb();
  const before = db.issuers.length;
  db.issuers = db.issuers.filter(i => i.id !== id);
  if (db.issuers.length === before) return false;
  await saveDb(db);
  return true;
}

// ===== 得意先（Recipient） =====

export async function listRecipients(): Promise<Recipient[]> {
  const db = await loadDb();
  return db.recipients;
}

export async function getRecipient(id: string): Promise<Recipient | undefined> {
  const db = await loadDb();
  return db.recipients.find(r => r.id === id);
}

export async function searchRecipients(query: string): Promise<Recipient[]> {
  const db = await loadDb();
  const q = query.toLowerCase();
  return db.recipients.filter(r =>
    r.companyName.toLowerCase().includes(q) ||
    (r.personName && r.personName.toLowerCase().includes(q)) ||
    (r.department && r.department.toLowerCase().includes(q))
  );
}

export async function addRecipient(data: Omit<Recipient, 'id'>): Promise<Recipient> {
  const db = await loadDb();
  const recipient: Recipient = { ...data, id: generateId() };
  db.recipients.push(recipient);
  await saveDb(db);
  return recipient;
}

export async function updateRecipient(id: string, data: Partial<Omit<Recipient, 'id'>>): Promise<Recipient | undefined> {
  const db = await loadDb();
  const index = db.recipients.findIndex(r => r.id === id);
  if (index === -1) return undefined;

  db.recipients[index] = { ...db.recipients[index], ...data };
  await saveDb(db);
  return db.recipients[index];
}

export async function deleteRecipient(id: string): Promise<boolean> {
  const db = await loadDb();
  const before = db.recipients.length;
  db.recipients = db.recipients.filter(r => r.id !== id);
  if (db.recipients.length === before) return false;
  await saveDb(db);
  return true;
}
