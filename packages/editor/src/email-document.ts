import { customBlockData, hasCustomBlocks, CUSTOM_BLOCK_LIMITS } from './custom-blocks.js';
import { inspectDisplayConditions } from './display-conditions.js';
import { mergeTagReferences } from './merge-tags.js';
import { TEMPLATE_PREVIEW_LIMIT } from './template-preview-limits.js';

/** Persisted authored email; editor chrome and export output are separate. */
export type EmailDocument = { schemaVersion: 1 | 2 | 3; content: Record<string, unknown>; subject: string; preheader: string; previewHtml?: string };

export function emailDocument(value: unknown): EmailDocument {
  try { return parseEmailDocument(value); } catch { throw new Error('invalid_document'); }
}

function parseEmailDocument(value: unknown): EmailDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_document');
  const doc = value as Record<string, unknown>;
  if (![1, 2, 3].includes(doc.schemaVersion as number) || typeof doc.subject !== 'string' || doc.subject.length > 200 ||
      typeof doc.preheader !== 'string' || doc.preheader.length > 500 || !doc.content || typeof doc.content !== 'object' || Array.isArray(doc.content)) throw new Error('invalid_document');
  if (doc.schemaVersion === 3 && new TextEncoder().encode(JSON.stringify(value)).length > CUSTOM_BLOCK_LIMITS.documentBytes) throw new Error('document_too_large');
  let nodes = 0, customNodes = 0; const customIds = new Set<string>();
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 50 || ++nodes > 10000) throw new Error('invalid_document');
    const node = value as Record<string, unknown>;
    if (typeof node.type !== 'string' || !node.type || node.type.length > 100 || (node.text !== undefined && typeof node.text !== 'string')) throw new Error('invalid_document');
    if (node.type === 'customBlock') { if (++customNodes > CUSTOM_BLOCK_LIMITS.nodes || node.content !== undefined) throw new Error('invalid_custom_block'); const data = customBlockData(node.attrs); if (customIds.has(data.id)) throw new Error('duplicate_custom_node'); customIds.add(data.id); }
    if (node.type === 'doc') {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      if (attrs?.documentSchemaVersion !== undefined && ![1, 2, 3].includes(attrs.documentSchemaVersion as number)) throw new Error('unsupported_document_version');
      if (attrs?.mergeTagReferences !== undefined) mergeTagReferences(attrs.mergeTagReferences);
    }
    if (node.type === 'mergeTag' || node.type === 'unsubscribe') {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      if (!attrs) throw new Error('invalid_document');
      mergeTagReferences([{ id: attrs.id, token: attrs.token, kind: node.type === 'unsubscribe' ? 'url' : attrs.kind }]);
      if (node.type === 'unsubscribe' && (attrs.id !== 'unsubscribe_url' || typeof attrs.label !== 'string' || !attrs.label.trim() || attrs.label.length > 500)) throw new Error('invalid_document');
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) throw new Error('invalid_document');
      node.content.forEach(child => visit(child, depth + 1));
    }
  };
  if ((doc.content as Record<string, unknown>).type !== 'doc') throw new Error('invalid_document');
  visit(doc.content, 0);
  if (doc.schemaVersion !== 3 && (hasCustomBlocks(doc.content as Record<string, unknown>) || (doc.content as any).attrs?.documentSchemaVersion === 3)) throw new Error('unsupported_document_version');
  const conditions = inspectDisplayConditions(doc.content as Record<string, unknown>);
  if (doc.schemaVersion === 1 && (conditions.displayConditions.length || (doc.content as any).attrs?.documentSchemaVersion === 2)) throw new Error('unsupported_document_version');
  if (doc.previewHtml !== undefined && (typeof doc.previewHtml !== 'string' || doc.previewHtml.length > TEMPLATE_PREVIEW_LIMIT)) throw new Error('invalid_document');
  return { ...(doc.previewHtml === undefined ? {} : { previewHtml: doc.previewHtml as string }), schemaVersion: doc.schemaVersion as 1 | 2 | 3, content: (doc.schemaVersion as number) >= 2 ? { ...doc.content as Record<string, unknown>, attrs: { ...(doc.content as any).attrs, documentSchemaVersion: doc.schemaVersion } } : doc.content as Record<string, unknown>, subject: doc.subject, preheader: doc.preheader };
}


/** Stable object order without altering authored strings or array order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
