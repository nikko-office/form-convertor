// APIルート：テンプレート、PDF生成、自社情報、得意先

import type { FastifyInstance } from 'fastify';
import { renderTemplate, listTemplates, type TemplateData, DEFAULT_VISIBILITY, type FieldVisibility } from '../../core/template-engine.js';
import { generatePdf } from '../../core/pdf-generator.js';
import { parseTsv } from '../../core/tsv-parser.js';
import { calculateTotals, calculateLineAmount, formatCurrency, taxRateToPercent } from '../../core/calculator.js';
import {
  listIssuers, addIssuer, updateIssuer, deleteIssuer, getIssuer,
  listRecipients, addRecipient, updateRecipient, deleteRecipient, getRecipient, searchRecipients,
  type Issuer, type Recipient,
} from '../../core/database.js';

export async function registerApiRoutes(app: FastifyInstance) {

  // ===== テンプレート =====

  app.get('/templates', async () => {
    const templates = await listTemplates();
    return templates.map(name => ({ name, paperSize: 'A4', orientation: 'portrait' }));
  });

  // ===== TSVパース =====

  app.post<{ Body: { tsv: string } }>('/parse-tsv', async (req) => {
    const { tsv } = req.body;
    const parsed = parseTsv(tsv, { hasHeader: true });
    return parsed;
  });

  // ===== プレビュー =====

  app.post<{ Body: {
    template: string;
    data: Record<string, unknown>;
    paperSize?: string;
    orientation?: string;
  } }>('/preview', async (req) => {
    const { template, data, paperSize = 'A4', orientation = 'portrait' } = req.body;
    const templateData = buildTemplateDataFromRequest(data, paperSize as 'A4' | 'A5', orientation as 'portrait' | 'landscape');
    const html = await renderTemplate(template, templateData);
    return { html };
  });

  // ===== PDF生成 =====

  app.post<{ Body: {
    template: string;
    data: Record<string, unknown>;
    paperSize?: string;
    orientation?: string;
  } }>('/generate-pdf', async (req, reply) => {
    const { template, data, paperSize = 'A4', orientation = 'portrait' } = req.body;
    const ps = paperSize as 'A4' | 'A5';
    const ori = orientation as 'portrait' | 'landscape';

    const templateData = buildTemplateDataFromRequest(data, ps, ori);
    const html = await renderTemplate(template, templateData);
    const pdfBuffer = await generatePdf(html, { paperSize: ps, orientation: ori });

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${template}_${Date.now()}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // ===== 自社情報（Issuer） =====

  app.get('/issuers', async () => {
    return await listIssuers();
  });

  app.post<{ Body: Omit<Issuer, 'id'> }>('/issuers', async (req) => {
    return await addIssuer(req.body);
  });

  app.put<{ Params: { id: string }; Body: Partial<Omit<Issuer, 'id'>> }>('/issuers/:id', async (req, reply) => {
    const result = await updateIssuer(req.params.id, req.body);
    if (!result) {
      reply.status(404);
      return { error: '自社情報が見つかりません' };
    }
    return result;
  });

  app.delete<{ Params: { id: string } }>('/issuers/:id', async (req, reply) => {
    const deleted = await deleteIssuer(req.params.id);
    if (!deleted) {
      reply.status(404);
      return { error: '自社情報が見つかりません' };
    }
    return { success: true };
  });

  // ===== 得意先（Recipient） =====

  app.get('/recipients', async () => {
    return await listRecipients();
  });

  app.get<{ Querystring: { q: string } }>('/recipients/search', async (req) => {
    return await searchRecipients(req.query.q || '');
  });

  app.post<{ Body: Omit<Recipient, 'id'> }>('/recipients', async (req) => {
    return await addRecipient(req.body);
  });

  app.put<{ Params: { id: string }; Body: Partial<Omit<Recipient, 'id'>> }>('/recipients/:id', async (req, reply) => {
    const result = await updateRecipient(req.params.id, req.body);
    if (!result) {
      reply.status(404);
      return { error: '得意先が見つかりません' };
    }
    return result;
  });

  app.delete<{ Params: { id: string } }>('/recipients/:id', async (req, reply) => {
    const deleted = await deleteRecipient(req.params.id);
    if (!deleted) {
      reply.status(404);
      return { error: '得意先が見つかりません' };
    }
    return { success: true };
  });
}

// リクエストデータからTemplateDataを構築する
function buildTemplateDataFromRequest(
  raw: Record<string, unknown>,
  paperSize: 'A4' | 'A5',
  orientation: 'portrait' | 'landscape'
): TemplateData {
  const items = (raw.items as Array<Record<string, unknown>> ?? []).map((item, i) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return {
      index: i + 1,
      description: String(item.description ?? ''),
      quantity: qty,
      unit: String(item.unit ?? ''),
      unitPrice: price,
      amount: calculateLineAmount(qty, price),
    };
  });

  const lineItems = items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice }));
  const taxRate = Number(raw.taxRate) || 0.10;
  const totals = calculateTotals(lineItems, taxRate);

  return {
    documentDate: String(raw.documentDate ?? new Date().toISOString().split('T')[0]),
    documentNumber: String(raw.documentNumber ?? ''),
    issuer: raw.issuer as TemplateData['issuer'] ?? { companyName: '', address: '', tel: '' },
    recipient: raw.recipient as TemplateData['recipient'] ?? { companyName: '' },
    subject: String(raw.subject ?? ''),
    items,
    ...totals,
    remarks: String(raw.remarks ?? ''),
    validUntil: raw.validUntil ? String(raw.validUntil) : undefined,
    paymentTerms: raw.paymentTerms ? String(raw.paymentTerms) : undefined,
    deliveryDate: raw.deliveryDate ? String(raw.deliveryDate) : undefined,
    paperSize,
    orientation,
    showStamp: raw.showStamp !== false,
    showLogo: raw.showLogo !== false,
    visibility: {
      ...DEFAULT_VISIBILITY,
      ...(raw.visibility as Partial<FieldVisibility> ?? {}),
    },
    images: raw.images as TemplateData['images'],
  };
}
