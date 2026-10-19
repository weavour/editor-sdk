/** Public configuration, never recipient values or credentials. */
export type MergeTag = { id: string; label: string; token: string; kind: 'text' | 'url'; description?: string; sampleValue?: string };
export type MergeTagReference = Pick<MergeTag, 'id' | 'token' | 'kind'>;
export const defaultMergeTags: MergeTag[] = [
  { id: 'unsubscribe_url', label: 'Unsubscribe link', token: '{{unsubscribe_url}}', kind: 'url' },
  { id: 'online_version_url', label: 'Online version link', token: '{{online_version_url}}', kind: 'url' },
];
const control = /[\u0000-\u001f\u007f]/;
export function validMergeToken(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= 200 && !control.test(value) && !/[<>"'`&]/.test(value) && !/^[a-z][a-z\d+.-]*:/i.test(value.trimStart());
}
/** Also used for persisted references; these intentionally contain no samples. */
export function mergeTagReferences(value: unknown): MergeTagReference[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('invalid_merge_tags');
  return value.map(tag => {
    if (!tag || typeof tag !== 'object' || typeof tag.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(tag.id) || !validMergeToken(tag.token) || !['text', 'url'].includes(tag.kind) ||
      defaultMergeTags.some(builtin => builtin.id === tag.id && tag.kind !== 'url')) throw new Error('invalid_merge_tags');
    return { id: tag.id, token: tag.token, kind: tag.kind };
  });
}
export function parseMergeTags(value: unknown): MergeTag[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('invalid_merge_tags');
  const refs = mergeTagReferences(value);
  const tags = (value as MergeTag[]).map((tag, index) => {
    if (Object.keys(tag).some(key => !['id', 'label', 'token', 'kind', 'description', 'sampleValue'].includes(key)) ||
      typeof tag.label !== 'string' || !tag.label.trim() || tag.label.length > 100 || control.test(tag.label) ||
      (tag.description !== undefined && (typeof tag.description !== 'string' || tag.description.length > 500 || control.test(tag.description))) ||
      (tag.sampleValue !== undefined && (typeof tag.sampleValue !== 'string' || tag.sampleValue.length > 2048 || control.test(tag.sampleValue))) ||
      (tag.kind === 'url' && tag.sampleValue && !safeMergeLink(tag.sampleValue))) throw new Error('invalid_merge_tags');
    return { ...refs[index]!, label: tag.label, ...(tag.description === undefined ? {} : { description: tag.description }), ...(tag.sampleValue === undefined ? {} : { sampleValue: tag.sampleValue }) };
  });
  const ids = new Set<string>();
  for (const [index, tag] of tags.entries()) {
    if (ids.has(tag.id) || tags.some((other, at) => at !== index && (other.token.includes(tag.token) || tag.token.includes(other.token)))) throw new Error('invalid_merge_tags');
    ids.add(tag.id);
  }
  return tags;
}
export function resolveMergeTags(saved: unknown = [], overrides: unknown = []): MergeTag[] {
  const resolved = new Map(defaultMergeTags.map(tag => [tag.id, tag]));
  for (const layer of [saved, overrides]) for (const tag of parseMergeTags(layer)) resolved.set(tag.id, tag);
  return parseMergeTags([...resolved.values()]);
}
export function safeMergeLink(value: string, tags: readonly MergeTagReference[] = []): string | undefined {
  if (!value || value.length > 2048 || control.test(value)) return undefined;
  if (tags.some(tag => tag.kind === 'url' && tag.token === value)) return value;
  if (/\s|[{}<>"`]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) && !url.username && !url.password &&
      (['https:', 'http:'].includes(url.protocol) || url.pathname) ? value : undefined;
  } catch { return undefined; }
}
export type MergeTagIssue = { code: 'unavailable_tag' | 'changed_tag' | 'invalid_tag_context'; id: string; token: string; location: string };
export type MergeTagUsage = MergeTagReference & { locations: string[] };
