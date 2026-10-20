# API

`mount(target, options)` returns an `EditorInstance` synchronously. Invalid mount
configuration throws. `target` is an HTMLElement or selector. `editorKey` and an
effective `userId` are required. Supplied IDs retain valid whitespace and case.

Options include `organizationId`, `locale`, `theme`, `mergeTags`, `allowedBlocks`,
`enableTemplates`, `enableAutosave`, `enableEmailAudit`, `enableAi`, `aiPaidOrigin`, initial raw
`document`/`subject`/`preheader`, `emailDocument`, `draftId`, `editorUrl`, `apiUrl`
and `demo`. `editorConfig` provides saved defaults under explicit mount overrides.
Local flags cannot grant server-denied permissions or paid features.

Pass either a complete `emailDocument` envelope or raw content/metadata. Never
combine either with `draftId`: a resumed draft is loaded by the hosted editor,
without silently overwriting it with initial content. Resume failures remain
visible/retryable in the editor; a failed flush rejects and preserves work.

Methods:

- `ready: Promise<void>` resolves when the application can accept methods.
- `exportHTML()` returns HTML, text, raw document, subject, preheader, merge-tag
  usage and issues. Literal placeholder syntax is preserved.
- `previewTemplate()` returns a versioned email envelope with optional preview HTML.
- `flushAutosave()` returns `{ draft }` after acknowledged save, or rejects.
- `updateConfig(config)` updates supported live settings without replacing content.
- `destroy()` cancels pending work and removes the frame/listeners, idempotently.

Callbacks: `onReady`, `onError`, raw-content `onChange`, full-envelope
`onDocumentChange`, `onDraftChange`, `onSaveStatusChange`, and optional
`onTestEmail({ to, subject, html, text, document })`. Test sending is your
application's responsibility; resolve the returned promise only after submission
succeeds, or reject on failure. Providers and admin credentials stay server-side.

Prefer `onDocumentChange` when persisting email JSON:
`{ schemaVersion: 1, content, subject, preheader, previewHtml? }`.
Callbacks are distinct from hosted save acknowledgement. Exports do not save.

`updateConfig` supports appearance, locale, merge tags, allowed blocks, templates,
autosave, email audit, AI enablement and the paid origin used for local AI. Identity,
initial content, draft ID and endpoint overrides require a new mount. Empty
`allowedBlocks` hides all palette entries without deleting existing content.
`mergeTags: undefined` clears embed definitions and returns to dashboard/default
values. Theme and locale updates preserve the current email and undo history.

Readiness/loading: 15 seconds; export/template preview: 20 seconds; flush:
45 seconds. Service operations retain separate bounded timeouts (timer: 15s;
templates/drafts: 20s; asset metadata: 45s; AI: 42s or 210s for a run). Asset
bytes use the hosted editor's direct upload path. Destroy/reload cancels requests
and rejects pending host methods; a network timeout does not prove a server-side
mutation failed. Reconcile through the hosted feature's retry/recovery flow.
`EditorError` extends Error and exposes a stable `code`; server export/save
failures retain their actionable message. See exported declarations for types.

`enableEmailAudit` controls the live email-content quality rating and checks.
It defaults to enabled in the hosted editor. Set it to `false` at mount (or in
`editorConfig`) to opt out, or call `updateConfig({ enableEmailAudit: false })`.
Top-level mount preferences override `editorConfig`. A saved dashboard disable
always wins. Disabling removes the audit UI and stops its background checks;
reenabling checks the current email without replacing content or undo history.
The option changes editor behavior only, not exported email content.
