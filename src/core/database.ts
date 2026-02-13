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
  personName?: string;
  honorific?: string;   // 様、御中 etc.
  address?: string;
  tel?: string;
}

export interface SavedDocument {
  id: string;
  template: string;          // "見積書" etc.
  documentNumber: string;
  documentDate: string;
  recipientName: string;     // 検索・一覧表示用
  subject?: string;
  formData: Record<string, unknown>;  // collectFormData() の内容をそのまま保存
  createdAt: string;         // ISO 8601
  updatedAt: string;
}

interface Database {
  issuers: Issuer[];
  recipients: Recipient[];
  documentCounters?: Record<string, number>;  // "EST-20260213" → 3
  documents?: SavedDocument[];
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
    (r.personName && r.personName.toLowerCase().includes(q))
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

// ===== 書類番号の自動採番 =====

export async function getNextDocumentNumber(prefix: string = 'EST'): Promise<string> {
  const db = await loadDb();
  if (!db.documentCounters) db.documentCounters = {};

  const today = new Date();
  const dateKey = `${prefix}-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const count = (db.documentCounters[dateKey] ?? 0) + 1;
  db.documentCounters[dateKey] = count;
  await saveDb(db);

  return `${dateKey}-${String(count).padStart(3, '0')}`;
}

export async function deleteRecipient(id: string): Promise<boolean> {
  const db = await loadDb();
  const before = db.recipients.length;
  db.recipients = db.recipients.filter(r => r.id !== id);
  if (db.recipients.length === before) return false;
  await saveDb(db);
  return true;
}

// ===== 帳票保存（Document） =====

export async function listDocuments(): Promise<SavedDocument[]> {
  const db = await loadDb();
  const docs = db.documents ?? [];
  // 新しい順
  return [...docs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDocument(id: string): Promise<SavedDocument | undefined> {
  const db = await loadDb();
  return (db.documents ?? []).find(d => d.id === id);
}

export async function saveDocument(data: Omit<SavedDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedDocument> {
  const db = await loadDb();
  if (!db.documents) db.documents = [];

  const now = new Date().toISOString();
  const doc: SavedDocument = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  db.documents.push(doc);
  await saveDb(db);
  return doc;
}

export async function updateDocument(id: string, data: Partial<Omit<SavedDocument, 'id' | 'createdAt'>>): Promise<SavedDocument | undefined> {
  const db = await loadDb();
  if (!db.documents) return undefined;

  const index = db.documents.findIndex(d => d.id === id);
  if (index === -1) return undefined;

  db.documents[index] = {
    ...db.documents[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await saveDb(db);
  return db.documents[index];
}

export async function deleteDocument(id: string): Promise<boolean> {
  const db = await loadDb();
  if (!db.documents) return false;
  const before = db.documents.length;
  db.documents = db.documents.filter(d => d.id !== id);
  if (db.documents.length === before) return false;
  await saveDb(db);
  return true;
}
