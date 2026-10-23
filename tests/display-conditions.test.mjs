import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDisplayConditions, resolveDisplayConditions, inspectDisplayConditions, emailDocument, documentSchemaVersion, parseConditionValues } from '../packages/editor/dist/protocol.js';
const rule = { id: 'free', label: 'Free accounts', before: "{% if account.plan == 'free' %}", after: '{% endif %}' };
const content = { type: 'doc', content: [{ type: 'section', attrs: { displayCondition: rule }, content: [{ type: 'paragraph' }] }] };
test('condition configuration preserves exact syntax, enforces bounded definitions and merges by stable identity', () => {
  assert.deepEqual(parseDisplayConditions([rule]), [rule]);
  assert.deepEqual(resolveDisplayConditions([rule], []), [rule]);
  assert.equal(resolveDisplayConditions([rule], [{ ...rule, before: '{{#free}}', after: '{{/free}}' }])[0].before, '{{#free}}');
  for (const value of [[rule, rule], [{ ...rule, before: '' }], [{ ...rule, id: '__proto__' }], [{ ...rule, after: '<script>bad()</script>' }], [{ ...rule, extra: true }], [{ ...rule, before: 'é'.repeat(1025) }]]) assert.throws(() => parseDisplayConditions(value));
  assert.equal(parseDisplayConditions([{ ...rule, before: '\n{% if amount < limit and count > 5 %}\n' }])[0].before, '\n{% if amount < limit and count > 5 %}\n');
});
test('versioned documents preserve snapshots and reject unsafe downgrades and condition locations', () => {
  const doc = emailDocument({ schemaVersion: 2, content, subject: '', preheader: '' });
  assert.equal(doc.content.attrs.documentSchemaVersion, 2);
  assert.equal(documentSchemaVersion(doc.content), 2);
  assert.throws(() => emailDocument({ ...doc, schemaVersion: 1 }));
  assert.throws(() => emailDocument({ schemaVersion: 1, content, subject: '', preheader: '' }));
  assert.throws(() => inspectDisplayConditions({ type: 'doc', content: [{ type: 'paragraph', attrs: { displayCondition: rule } }] }));
  assert.equal(inspectDisplayConditions(content, []).displayConditionIssues[0].code, 'unavailable_condition');
  assert.equal(inspectDisplayConditions(content, [{ ...rule, before: '{{#free}}' }]).displayConditionIssues[0].code, 'changed_condition');
  assert.deepEqual(parseConditionValues({ free: false }), { free: false });
  assert.throws(() => parseConditionValues({ free: 'false' }));
});
