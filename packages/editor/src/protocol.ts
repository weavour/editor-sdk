export * from './display-conditions.js';
export { parseMergeTags, resolveMergeTags, mergeTagReferences, defaultMergeTags, safeMergeLink, validMergeToken } from './merge-tags.js';
export { emailDocument, canonicalJson } from './email-document.js';
export { resolveEditorTheme, readableForeground, editorSurfacePalette, colorContrast } from './editor-theme.js';
export { editorBlockIds } from './editor-blocks.js';
export type * from './types.js';
export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 2_097_152;
/** Only JSON-compatible wire values, with bounded size and nesting. */
export function validMessage(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  let count = 0;
  const visit = (item: unknown, depth: number): boolean => {
    if (++count > 50000 || depth > 60) return false;
    if (item === null || item === undefined || typeof item === 'string' || typeof item === 'boolean') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item !== 'object') return false;
    return Object.values(item).every(child => visit(child, depth + 1));
  };
  try { return visit(value, 0) && JSON.stringify(value).length <= MAX_MESSAGE_BYTES; } catch { return false; }
}
