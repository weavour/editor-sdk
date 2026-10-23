# Display conditions

Prepared for SDK 0.1.6. The SDK and compatible hosted iframe must both advertise
`displayConditionsV1`; publication and hosted promotion are separate releases.

Define rules in dashboard editor settings or pass them through the SDK:

```ts
const editor = mount('#email-editor', {
  editorKey: 'YOUR_PUBLIC_EDITOR_KEY',
  userId: 'YOUR_USER_ID',
  displayConditions: [{
    id: 'free_account',
    label: 'Free accounts',
    description: 'Show the upgrade offer to free accounts.',
    category: 'Account',
    before: "{% if account.plan == 'free' %}",
    after: '{% endif %}',
  }],
  onDocumentChange(document) { /* Persist the complete versioned envelope. */ },
});
await editor.ready;
```

`displayConditions` is also supported in `editorConfig`, `updateConfig()` and as
a live React prop. Top-level definitions win over nested mount defaults. One
embed array merges by ID over dashboard definitions; each override replaces a
whole definition. `[]` adds no overrides; `undefined` clears embed overrides.
Invalid updates preserve the current configuration and email.

Both wrapper strings are required and preserved exactly. The host owns their
syntax and evaluation. No HTML tags or disallowed control characters are
accepted. Limits: 100 effective definitions, unique ASCII IDs up to 64 characters,
labels/categories up to 100 characters, descriptions up to 500, and each wrapper
up to 2,048 UTF-8 bytes, subject to the combined settings/wire limits.

Authors apply one rule to a section or complete column layout through **Show
when**. Nested rules require every parent to match. Conditions are shown on the
canvas; scenario previews use illustrative booleans kept only in instance
memory. Saved snapshots keep their original wrappers when configuration changes;
users must explicitly update, map or remove the rule. A document allows 100
distinct IDs, 200 conditional occurrences and four nested scopes.

The first condition upgrades the envelope to schema version 2. Preserve
`schemaVersion`, `content`, `subject` and `preheader` through `onDocumentChange`,
and reopen with `emailDocument: saved`. Raw conditional-content mounts are
rejected. Version 2 remains after removing rules. Older clients reject newer
hosted documents before loading/autosaving them; do not strip or downgrade the
envelope to work around a compatibility error.

`exportHTML()` returns host template syntax in both HTML and plain text,
independently of the current preview scenario. Additional result fields are
`displayConditions`, `displayConditionIssues` and `requiresConditionEvaluation`.
Test-email callbacks receive the manifest and evaluation flag too. The host
must evaluate rules, resolve merge tags and deliver through its own provider.
Never send an unevaluated template or a sample preview to a real recipient.

The saved-JSON rendering endpoint alternatively accepts
`conditionValues: { free_account: true }`, indexed by rule ID. The host evaluates
the rules; Weavour selects matching layouts without interpreting syntax.
Omitted reachable outcomes fail explicitly. False parents require neither child
outcomes nor merge values used only inside their excluded content. Request data
is not stored. Repeating collections and free-form expression builders are
outside this version.
