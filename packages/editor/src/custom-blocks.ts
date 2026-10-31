import { validMergeToken } from './merge-tags.js';
import { Parser, parseDocument, DomUtils } from 'htmlparser2';
import { validateCustomBlockIcon } from './custom-block-icon.js';
export { validateCustomBlockIcon } from './custom-block-icon.js';
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type CustomBlockImage = { src: string; assetId: string; width: number; height: number; alt: string };
type Label = { label: string };
export type CustomBlockControl = Label & (
  | { type: 'text' | 'textarea'; placeholder?: string; required?: boolean; maxLength?: number }
  | { type: 'url'; placeholder?: string; required?: boolean }
  | { type: 'image'; required?: boolean }
  | { type: 'number'; min?: number; max?: number; step?: number }
  | { type: 'select'; options: { label: string; value: string }[] }
  | { type: 'boolean' | 'color' }
);
export type CustomBlockDefinition<Props extends JsonObject = JsonObject> = {
  id: string; version: number; label: string; defaultProps: Props;
  /** Static SVG geometry overriding the automatic rendered-layout outline. */
  iconSvg?: string;
  controls: Record<string, CustomBlockControl>;
  render(props: Readonly<Props>): string | Promise<string>;
};
export type CustomBlockRegistration = Omit<CustomBlockDefinition, 'render'>;
// A heterogeneous registry must accept independently inferred renderer props.
export type AnyCustomBlockDefinition = CustomBlockRegistration & { render: (props: any) => string | Promise<string> };
export function defineCustomBlock<Props extends JsonObject>(definition: CustomBlockDefinition<Props>): CustomBlockDefinition<Props> { return definition; }
export const CUSTOM_BLOCK_LIMITS = Object.freeze({ definitions: 50, controls: 32, nodes: 100, propsBytes: 32768, htmlBytes: 102400, documentBytes: 1000000, concurrency: 4, queue: 100, debounce: 150, timeout: 5000 });
export const CUSTOM_BLOCK_POLICY = 1;
const bytes = (value: string) => new TextEncoder().encode(value).length;
const plain = (value: unknown): value is Record<string, any> => {
  if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') return false;
  const prototype = Object.getPrototypeOf(value);
  // JSON objects may come from another window; custom class instances are not JSON objects.
  return prototype === null || Object.getPrototypeOf(prototype) === null;
};
const safeKey = (key: string) => !['__proto__', 'constructor', 'prototype'].includes(key) && key.length <= 100;
const idPattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
function fail(message = 'invalid_custom_block'): never { throw new Error(message); }
function label(value: unknown): value is string { return typeof value === 'string' && !!value.trim() && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value); }
export function customBlockProps(value: unknown): JsonObject {
  let count = 0;
  const visit = (item: unknown, depth: number) => {
    if (++count > 4096 || depth > 12) fail('custom_props_too_complex');
    if (item === null || typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item)) return;
    if (Array.isArray(item)) { item.forEach(child => visit(child, depth + 1)); return; }
    if (!plain(item)) fail('invalid_custom_props');
    for (const [key, child] of Object.entries(item)) { if (!safeKey(key)) fail('invalid_custom_props'); visit(child, depth + 1); }
  };
  if (!plain(value)) fail('invalid_custom_props');
  visit(value, 0);
  if (bytes(JSON.stringify(value)) > CUSTOM_BLOCK_LIMITS.propsBytes) fail('custom_props_too_large');
  return JSON.parse(JSON.stringify(value));
}
export function validateCustomValues(props: unknown, controls: Record<string, CustomBlockControl>): JsonObject {
  const result = customBlockProps(props);
  for (const [key, control] of Object.entries(controls)) {
    const value: any = result[key];
    switch (control.type) {
      case 'text': case 'textarea': case 'url': case 'color': case 'select':
        if (typeof value !== 'string') fail('invalid_custom_field:' + key);
        if ('required' in control && control.required && !value.trim()) fail('required_custom_field:' + key);
        if ('maxLength' in control && control.maxLength !== undefined && value.length > control.maxLength) fail('invalid_custom_field:' + key);
        if (control.type === 'url' && value && !safeCustomURL(value, false)) fail('invalid_custom_field:' + key);
        if (control.type === 'color' && !/^#[a-f0-9]{6}$/i.test(value)) fail('invalid_custom_field:' + key);
        if (control.type === 'select' && !control.options.some(option => option.value === value)) fail('invalid_custom_field:' + key);
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value) || control.min !== undefined && value < control.min || control.max !== undefined && value > control.max || control.step !== undefined && Math.abs((value - (control.min ?? 0)) / control.step - Math.round((value - (control.min ?? 0)) / control.step)) > 1e-7) fail('invalid_custom_field:' + key);
        break;
      case 'boolean': if (typeof value !== 'boolean') fail('invalid_custom_field:' + key); break;
      case 'image':
        if (value === null && !control.required) break;
        if (!plain(value) || !safeCustomURL(value.src, true) || typeof value.assetId !== 'string' || !value.assetId || typeof value.alt !== 'string' || !Number.isInteger(value.width) || value.width < 1 || !Number.isInteger(value.height) || value.height < 1) fail('invalid_custom_field:' + key);
    }
  }
  return result;
}
export function customBlockRegistrations(value: unknown): CustomBlockRegistration[] {
  if (!Array.isArray(value) || value.length > CUSTOM_BLOCK_LIMITS.definitions) fail('invalid_custom_definitions');
  const pairs = new Set<string>();
  return value.map(def => {
    if (!plain(def) || !idPattern.test(def.id) || !Number.isSafeInteger(def.version) || def.version < 1 || !label(def.label) || !plain(def.controls) || Object.keys(def.controls).length > CUSTOM_BLOCK_LIMITS.controls) fail('invalid_custom_definition');
    const pair = def.id + ':' + def.version;
    if (pairs.has(pair)) fail('duplicate_custom_definition'); pairs.add(pair);
    const controls: Record<string, CustomBlockControl> = {};
    for (const [key, c] of Object.entries(def.controls)) {
      if (!safeKey(key) || !plain(c) || !label(c.label) || !['text','textarea','url','image','number','select','boolean','color'].includes(c.type)) fail('invalid_custom_control');
      const allowed = ['type','label', ...(['text','textarea'].includes(c.type) ? ['placeholder','required','maxLength'] : c.type === 'url' ? ['placeholder','required'] : c.type === 'image' ? ['required'] : c.type === 'number' ? ['min','max','step'] : c.type === 'select' ? ['options'] : [])];
      if (Object.keys(c).some(key => !allowed.includes(key)) || c.required !== undefined && typeof c.required !== 'boolean' || c.placeholder !== undefined && (typeof c.placeholder !== 'string' || c.placeholder.length > 500) || c.maxLength !== undefined && (!Number.isInteger(c.maxLength) || c.maxLength < 1 || c.maxLength > 32768)) fail('invalid_custom_control');
      for (const field of ['min','max','step']) if (c[field] !== undefined && (typeof c[field] !== 'number' || !Number.isFinite(c[field]))) fail('invalid_custom_control');
      if (c.step !== undefined && c.step <= 0 || c.min !== undefined && c.max !== undefined && c.min > c.max) fail('invalid_custom_control');
      if (c.type === 'select' && (!Array.isArray(c.options) || !c.options.length || c.options.length > 100 || c.options.some((o: any) => !plain(o) || !label(o.label) || typeof o.value !== 'string' || o.value.length > 200) || new Set(c.options.map((o: any) => o.value)).size !== c.options.length)) fail('invalid_custom_control');
      controls[key] = JSON.parse(JSON.stringify(c));
    }
    return { id: def.id, version: def.version, label: def.label, controls, defaultProps: validateCustomValues(def.defaultProps, controls), ...(def.iconSvg === undefined ? {} : { iconSvg: validateCustomBlockIcon(def.iconSvg) }) };
  });
}
export function customBlockDefinitions(value: unknown): { registrations: CustomBlockRegistration[]; callbacks: Map<string, AnyCustomBlockDefinition['render']> } {
  const registrations = customBlockRegistrations(value), callbacks = new Map<string, AnyCustomBlockDefinition['render']>();
  (value as AnyCustomBlockDefinition[]).forEach(def => { if (typeof def.render !== 'function') fail('invalid_custom_renderer'); callbacks.set(def.id + ':' + def.version, def.render); });
  return { registrations, callbacks };
}
function canonical(value: JsonValue): string {
  return Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : plain(value) ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
}
/** Canonical inputs are a freshness key, never an authorization proof. */
export function customBlockFingerprint(id: string, version: number, props: unknown): string { return canonical({ id, version, props: customBlockProps(props) }); }
export function safeCustomURL(value: unknown, image: boolean): value is string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u001f\u007f<>"'`]/.test(value)) return false;
  // The iframe/export/compiler resolve tokens against configured references.
  // SDK definitions cannot know tokens saved in the hosted configuration yet.
  if (!image && validMergeToken(value)) return true;
  if (/\s/.test(value)) return false;
  try { const url = new URL(value); return (image ? ['https:','http:'] : ['https:','http:','mailto:','tel:']).includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}

const tags = new Set('a p div span strong b em i u s br hr h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr td th img ul ol li blockquote pre code center small sup sub'.split(' '));
const attrs = new Set('style align valign width height title role dir lang cellpadding cellspacing border colspan rowspan alt href src target rel hidden aria-hidden data-id aria-label scope'.split(' '));
/** Strict, lossless body-fragment policy. Never silently strip authored content. */
export function validateCustomHTML(source: unknown): string {
  if (typeof source !== 'string' || !source.trim() || bytes(source) > CUSTOM_BLOCK_LIMITS.htmlBytes) fail('invalid_custom_html_size');
  let count = 0, depth = 0;
  const inspect = (html: string, nesting: number) => {
    if (nesting > 2) fail('unsupported_custom_comment');
    const parser = new Parser({
      onopentag(name, attributes) {
        if (!tags.has(name) || ++count > 5000 || ++depth > 50) fail('unsupported_custom_tag:' + name);
        for (const [key, value] of Object.entries(attributes)) {
          if (!attrs.has(key) || key === 'data-id' && value !== '__react-email-column' || key === 'href' && (name !== 'a' || !safeCustomURL(value, false)) || key === 'src' && (name !== 'img' || !safeCustomURL(value, true))) fail('unsupported_custom_attribute:' + key);
          if (key === 'style' && (value.length > 16000 || /url\s*\(|(?:image-set|cross-fade|image|expression)\s*\(|progid\s*:|@|[<>\\]|javascript:|behavior\s*:|binding\s*:|\/\*/i.test(value))) fail('unsupported_custom_style');
        }
      },
      onclosetag() { depth--; },
      onprocessinginstruction() { fail('unsupported_custom_document'); },
      oncomment(value) {
        const conditional = value.match(/^\[if (?:mso|!mso|gte mso \d+|lt mso \d+)\]>([\s\S]*)<!\[endif\]$/i);
        if (conditional) inspect(conditional[1], nesting + 1);
        else if (/[<>]|\[if|\[endif/i.test(value)) fail('unsupported_custom_comment');
      },
    }, { decodeEntities: true });
    parser.write(html); parser.end();
  };
  inspect(source, 0); return source;
}
export type CustomBlockSnapshot = { html: string; policyVersion: number; fingerprint: string };
export type CustomBlockData = { id: string; blockId: string; version: number; label: string; props: JsonObject; snapshot: CustomBlockSnapshot | null };
export function customBlockData(value: unknown): CustomBlockData {
  if (!plain(value) || !label(value.id) || !idPattern.test(value.blockId) || !Number.isSafeInteger(value.version) || value.version < 1 || !label(value.label)) fail();
  const props = customBlockProps(value.props);
  let snapshot: CustomBlockSnapshot | null = null;
  if (value.snapshot !== null && value.snapshot !== undefined) {
    const s = value.snapshot;
    if (!plain(s) || typeof s.html !== 'string' || bytes(s.html) > CUSTOM_BLOCK_LIMITS.htmlBytes || !Number.isInteger(s.policyVersion) || typeof s.fingerprint !== 'string' || bytes(s.fingerprint) > CUSTOM_BLOCK_LIMITS.propsBytes + 500) fail('invalid_custom_snapshot');
    snapshot = { html: s.html, policyVersion: s.policyVersion, fingerprint: s.fingerprint };
  }
  return { id: value.id, blockId: value.blockId, version: value.version, label: value.label, props, snapshot };
}
export function currentCustomSnapshot(value: unknown): CustomBlockSnapshot | null {
  const data = customBlockData(value), snapshot = data.snapshot;
  if (!snapshot || snapshot.policyVersion !== CUSTOM_BLOCK_POLICY || snapshot.fingerprint !== customBlockFingerprint(data.blockId, data.version, data.props)) return null;
  try { validateCustomHTML(snapshot.html); return snapshot; } catch { return null; }
}
export function hasCustomBlocks(content: Record<string, unknown>): boolean {
  return content.type === 'customBlock' || Array.isArray(content.content) && content.content.some(child => hasCustomBlocks(child));
}

/** Parse attributes/entities once for typed merge substitution and asset discovery. */
export function transformCustomHTML(source: string, text: (value: string) => string, url: (value: string, image: boolean) => string, other: (value: string) => string): string {
  const tree = parseDocument(validateCustomHTML(source));
  const walk = (node: any) => {
    if (node.type === 'text') node.data = text(node.data);
    if (node.attribs) for (const key of Object.keys(node.attribs)) {
      const value = node.attribs[key];
      node.attribs[key] = key === 'href' || key === 'src' ? url(value, key === 'src') : key === 'alt' || key === 'title' ? text(value) : other(value);
    }
    if (node.type === 'comment') {
      const match = node.data.match(/^(\[if [^\]]+\]>)([\s\S]*)(<!\[endif\])$/i);
      if (match) node.data = match[1] + transformCustomHTML(match[2], text, url, other) + match[3];
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  return DomUtils.getOuterHTML(tree, { encodeEntities: 'utf8' });
}
export function customDocumentAssetURLs(document: unknown): string[] {
  const result: string[] = [];
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'customBlock' && typeof value.attrs?.snapshot?.html === 'string') {
      try { transformCustomHTML(value.attrs.snapshot.html, text => text, value => { result.push(value); return value; }, value => value); } catch { /* Unusable snapshots are retained as unresolved content. */ }
    }
    if (Array.isArray(value.content)) value.content.forEach(visit);
    if (value.content && !Array.isArray(value.content)) visit(value.content);
  };
  visit(document); return result;
}
