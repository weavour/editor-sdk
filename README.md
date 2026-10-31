# Weavour editor SDKs

Embed the hosted Weavour email editor in your application. Your application owns
its users and sends the exported emails.

- `@weavour/editor`: JavaScript/TypeScript and classic script-tag integrations.
- `@weavour/react`: React component using the same core and hosted iframe.

## JavaScript / TypeScript

```sh
npm install @weavour/editor
```

```ts
import { mount } from '@weavour/editor';

const editor = mount('#email-editor', {
  editorKey: 'YOUR_PUBLIC_EDITOR_KEY',
  userId: 'user-123',
  organizationId: 'organization-456',
  locale: 'en',
  onDocumentChange(email) { /* Persist the complete versioned envelope. */ },
  onError(error) { console.error(error); },
});
await editor.ready;
const { html, text, subject, preheader } = await editor.exportHTML();
// Your application sends the email.
// Before leaving, optionally await editor.flushAutosave(), then:
editor.destroy();
```

Supply an element with an explicit height, for example 700px. The SDK appends a
full-width, full-height titled iframe and preserves other container children.
The default iframe is `https://weavour.com/editor`.

## Script tags

Use the `dist/editor.js` artifact from a pinned SDK release. It exposes the same
API as `Weavour.mount(...)`; no framework or npm runtime is required.
`https://weavour.com/editor.js` remains the hosted compatibility entry point.
The new application-ready SDK requires the matching hosted iframe rollout;
see [compatibility](docs/compatibility.md) before switching production clients.

## React

```sh
npm install @weavour/react
```

```tsx
import { useRef } from 'react';
import { WeavourEditor, type WeavourEditorRef } from '@weavour/react';

export function EmailComposer() {
  const editor = useRef<WeavourEditorRef>(null);
  return <WeavourEditor
    ref={editor}
    editorKey="YOUR_PUBLIC_EDITOR_KEY"
    userId="user-123"
    organizationId="organization-456"
    locale="en"
    style={{ height: 700 }}
    onError={console.error}
  />;
}
```

The wrapper cleans up on unmount and supports React 18.3 and 19. Theme, locale,
merge tags and feature preferences update live. Change the React `key` explicitly
to switch identity or initial documents, after preserving current work. Callback
changes do not recreate the iframe. Imports are SSR-safe; mounting runs on the
client. Next.js examples use a client component boundary.

## Organization blocks

Organization blocks are enabled by default for mounts with both `userId` and
`organizationId`. Set `enableOrganizationBlocks: false` at mount, in
`editorConfig`, or through `updateConfig()` to hide the shared library and
**Save organization block** action. The React wrapper accepts the same live prop.
The dashboard switch is available when creating or editing an editor; a saved
server-side disable cannot be overridden by the SDK. Saved blocks and copies
already inserted in emails remain intact. This preference is independent of
`enableTemplates` and does not remove standard layout blocks.

## Email audit

Email-content quality checks are enabled by default. Set `enableEmailAudit: false`
at mount, in `editorConfig`, or through `editor.updateConfig(...)` to turn them
off. The React wrapper also accepts `enableEmailAudit` as a live prop. A saved
dashboard disable takes precedence over SDK preferences. Toggling preserves the
email and undo history. This requires the matching hosted iframe support.

## Test email button

The toolbar test button is visible by default. Set `enableTestEmail: false` at
mount, in `editorConfig`, or through `editor.updateConfig(...)` to hide it.
The React wrapper accepts the same live prop. Changing visibility preserves the
email and closes an open test dialog. This only controls the hosted editor UI;
your application can keep its own export and delivery flow. `onTestEmail` remains
the optional host delivery callback. Requires matching hosted iframe support.

## Identity and permissions

`editorKey` is public. `userId` and optional `organizationId` are declarative
namespaces inside the customer workspace resolved by that key. They are not
verified identities: supplying the same IDs grants shared access, including
modification. Origin restrictions control embedding and do not authenticate users.
An organization-only mount becomes a personal mount with that organization ID as
its user ID. A mount with neither ID fails. Never put admin credentials or AI
provider keys in mount options. Hosted capabilities and quotas are enforced by
the service, regardless of local preferences.

## Documentation and examples

- [API](docs/api.md), [compatibility and migration](docs/compatibility.md),
  [origins and CSP](docs/security.md).
- [Vanilla](examples/vanilla), [React](examples/react), [Next.js](examples/next).
- [Contributing](CONTRIBUTING.md), [security reports](SECURITY.md), [changelog](CHANGELOG.md).

## Development

Node.js 22.12+ and npm are required. A clean public checkout needs no credentials,
private code or Weavour account to build and test:

```sh
npm ci
npm run verify
npx playwright install chromium firefox webkit
npm run test:browser
```

Installing this SDK does not self-host the editor.


### Custom blocks

Pass `customBlocks: [{ id, version, label, defaultProps, controls, render }]` to
`mount()` or the React wrapper. `render(props)` runs in your host application and
returns an inline-styled email body fragment, synchronously or asynchronously.
The core package has no React runtime dependency. Use `defineCustomBlock<Props>()`
from `@weavour/editor` to preserve inference in heterogeneous arrays.

Controls are `text`, `textarea`, `url`, `image`, `number`, `select`, `boolean` and
`color`. All controls require labels and compatible defaults; image values are
`{ src, assetId, width, height, alt }` or `null`, selected from the scoped library.
Register exact `(id, version)` pairs, with the highest version used for insertion.
Increment versions when renderer behavior, defaults or control semantics change;
callback closures cannot be fingerprinted. Keep older versions to edit old nodes.
Renderers receive detached JSON props and must finish promptly without side effects.
Synchronous JavaScript cannot be interrupted by a timeout.

`updateConfig({ customBlocks })` atomically replaces registrations; `[]` clears
them and omission preserves them. Top-level options override `editorConfig`.
React callback identities may change without remounting. Existing props and
snapshots are never rewritten by a registry update. A missing definition keeps
valid saved previews/exports but disables field editing. Reopening a current
snapshot does not rerender that node. Definitions and callbacks are never stored.

The palette automatically draws a small wireframe from the browser layout of
`render(defaultProps)`. It reuses a matching current snapshot when available;
otherwise opening the palette calls the renderer once per definition/registry
generation, within the shared render limits. Palette rendering never edits the
document. Icons are cached across theme and tab changes. Measurement loads no
images or other network resources; missing image dimensions use a placeholder.
If rendering or measurement fails, insertion remains available with a generic icon.

Set optional `iconSvg` to override the outline and skip palette rendering:

```ts
iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h6M7 16h8"/></svg>',
```

SVG icons need a `viewBox` and static `g`, `path`, `rect`, `circle`, `ellipse`,
`line`, `polyline` or `polygon` geometry. Paints become `currentColor` (preserving
`none`) to follow the editor theme. Scripts, events, styles, text, external
references, embedded content and nested SVGs are rejected. Limits: 16 KiB UTF-8,
128 elements and 12 levels. This metadata never enters saved/exported email content.

Persist complete `onDocumentChange` envelopes and reopen with `emailDocument`.
Documents containing custom blocks require schema 3 and compatible hosted readers.
Explicit `allowedBlocks` lists must include `custom:<id>` to enable insertion.
Custom code transport is disabled in demo mode. Draft autosave preserves unresolved
edits; export and reusable-copy saves require current validated output. Full-email
AI replacement remains disabled when custom nodes are present.

Limits per mount: 50 definition versions, 32 controls per version, 100 custom nodes,
32 KiB UTF-8 props and 100 KiB HTML per node, four concurrent renders and 100 pending
requests, 150 ms typing debounce and a five-second render timeout. Schema-3 envelopes
have a combined 1,000,000-byte budget; API and bridge budgets also apply.

The fragment policy accepts self-contained table/text/link/image markup and inline
styles, preserving tested React Email button MSO comments. It rejects executable
markup, global/head styles, forms, embedded frames/objects and CSS URLs. Escape
values and use configured merge tokens and conditional layouts for personalization.
Weavour executes no customer callbacks on the server. See `examples/custom-blocks/`
and the hosted EN/FR/ES custom-block guides for complete examples and recovery steps.
