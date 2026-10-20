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

## Email audit

Email-content quality checks are enabled by default. Set `enableEmailAudit: false`
at mount, in `editorConfig`, or through `editor.updateConfig(...)` to turn them
off. The React wrapper also accepts `enableEmailAudit` as a live prop. A saved
dashboard disable takes precedence over SDK preferences. Toggling preserves the
email and undo history. This requires the matching hosted iframe support.

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
