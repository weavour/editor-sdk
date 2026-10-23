/** Public authoring configuration. Expressions belong to the host's sending engine. */
export type DisplayCondition = { id: string; label: string; description?: string; category?: string; before: string; after: string };
export type DisplayConditionReference = Pick<DisplayCondition, 'id' | 'label' | 'before' | 'after'>;
export type DisplayConditionUsage = DisplayConditionReference & { locations: string[] };
export type DisplayConditionIssue = { id: string; location: string; code: 'unavailable_condition' | 'changed_condition' };
export type ConditionValues = Record<string, boolean>;
export const conditionalLayoutTypes = new Set(['section', 'twoColumns', 'threeColumns', 'fourColumns']);
const idPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const label = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const wrapper = (v: unknown) => typeof v === 'string' && !!v.trim() && new TextEncoder().encode(v).length <= 2048 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<\/?[a-z!][^>]*>/i.test(v);
export function displayConditionReference(value: unknown): DisplayConditionReference {
  if (!plain(value) || typeof value.id !== 'string' || !idPattern.test(value.id) || !label(value.label, 100) || !wrapper(value.before) || !wrapper(value.after)) throw new Error('invalid_display_condition');
  return { id: value.id, label: value.label as string, before: value.before as string, after: value.after as string };
}
export function parseDisplayConditions(value: unknown): DisplayCondition[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('invalid_display_conditions');
  const ids = new Set<string>();
  return value.map(item => {
    const ref = displayConditionReference(item);
    if (ids.has(ref.id) || Object.keys(item).some(key => !['id','label','description','category','before','after'].includes(key)) || item.description !== undefined && !label(item.description, 500) || item.category !== undefined && !label(item.category, 100)) throw new Error('invalid_display_conditions');
    ids.add(ref.id);
    return { ...ref, ...(item.description === undefined ? {} : { description: item.description }), ...(item.category === undefined ? {} : { category: item.category }) };
  });
}
export function resolveDisplayConditions(saved: unknown = [], overrides?: unknown): DisplayCondition[] {
  const result = new Map(parseDisplayConditions(saved).map(rule => [rule.id, rule]));
  if (overrides !== undefined) for (const rule of parseDisplayConditions(overrides)) result.set(rule.id, rule);
  return parseDisplayConditions([...result.values()]);
}
/** Validates all authored branches, independently of preview outcomes. */
export function inspectDisplayConditions(content: Record<string, unknown>, configured?: readonly DisplayCondition[]) {
  const usage = new Map<string, DisplayConditionUsage>();
  const displayConditionIssues: DisplayConditionIssue[] = [];
  let nodes = 0, occurrences = 0;
  const visit = (node: unknown, location: string, depth: number, scopes: number) => {
    if (!plain(node) || ++nodes > 10000 || depth > 50) throw new Error('invalid_document');
    if (node.attrs !== undefined && !plain(node.attrs)) throw new Error('invalid_document');
    const value = plain(node.attrs) ? node.attrs.displayCondition : undefined;
    if (value !== undefined && value !== null) {
      if (!conditionalLayoutTypes.has(String(node.type)) || ++occurrences > 200 || ++scopes > 4) throw new Error('invalid_condition_scope');
      const ref = displayConditionReference(value), previous = usage.get(ref.id);
      if (previous && (previous.before !== ref.before || previous.after !== ref.after)) throw new Error('conflicting_display_conditions');
      if (previous) previous.locations.push(location);
      else usage.set(ref.id, { ...ref, locations: [location] });
      if (usage.size > 100) throw new Error('too_many_display_conditions');
      if (configured) {
        const current = configured.find(rule => rule.id === ref.id);
        if (!current || current.before !== ref.before || current.after !== ref.after) displayConditionIssues.push({ id: ref.id, location, code: current ? 'changed_condition' : 'unavailable_condition' });
      }
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) throw new Error('invalid_document');
      node.content.forEach((child, index) => visit(child, `${location}.content.${index}`, depth + 1, scopes));
    }
  };
  visit(content, 'content', 0, 0);
  return { displayConditions: [...usage.values()], displayConditionIssues };
}
export function documentSchemaVersion(content: Record<string, unknown>): 1 | 2 {
  return (content.attrs as Record<string, unknown> | undefined)?.documentSchemaVersion === 2 || inspectDisplayConditions(content).displayConditions.length ? 2 : 1;
}
export function parseConditionValues(value: unknown): ConditionValues {
  if (!plain(value) || Object.keys(value).length > 100 || Object.entries(value).some(([id, outcome]) => !idPattern.test(id) || typeof outcome !== 'boolean')) throw new Error('invalid_condition_values');
  return { ...value } as ConditionValues;
}
