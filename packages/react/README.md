# @weavour/react

MIT-licensed React 18.3/19 wrapper for the hosted Weavour email editor.
Install with `npm install @weavour/react`; React is a peer dependency.

```tsx
import { WeavourEditor } from '@weavour/react';

<WeavourEditor editorKey="YOUR_PUBLIC_EDITOR_KEY" userId="user-123" style={{ height: 700 }} />
```

The wrapper uses `@weavour/editor`, mounts in a client effect, cleans up on unmount,
and updates live configuration without replacing email content. Callback props
always use the latest handlers. Identity and initial content require an explicit
keyed remount. Imports are SSR safe; the bundle preserves its `use client` boundary.

The hosted editor and services remain private. Your application handles delivery.
Full API, identity/scoping rules, examples and release compatibility:
<https://github.com/weavour/editor-sdk>

Use `enableTestEmail={false}` to hide the toolbar test button. It is visible by
default and updates live without remounting. Your application can keep its own
export and delivery flow. Hiding the button closes an open editor test dialog.

Use `enableOrganizationBlocks={false}` to hide organization-block saving and reuse.
The prop updates live without remounting. It defaults to enabled for organization
mounts; the saved dashboard disable remains authoritative. Existing email content
and saved blocks are retained. See the core SDK reference for full configuration.


### Optional usage collection (0.1.12)

`enableAnalytics` defaults to true. Pass `enableAnalytics: false` at mount or in
`editorConfig`, call `updateConfig({ enableAnalytics: false })`, or set the React
prop to suppress browser usage observations. This does not change operational
counts of successfully created templates. Dashboard and website previews do not
create embedded visits.

The hosted iframe collects visible, usable edit and readonly visits, with a new
visit after 30 minutes without activity. Hidden tabs and timers do not create
activity. Preview mode pauses collection. Identity is scoped to the workspace
resolved from the editor key and the supplied organization/user namespaces. Pass
individual stable user IDs for useful people counts; an organization-only mount
normalizes to a personal user namespace and cannot distinguish people.
