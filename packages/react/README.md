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
