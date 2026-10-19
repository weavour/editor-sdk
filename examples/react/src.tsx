import { createElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { WeavourEditor, type WeavourEditorRef } from '@weavour/react';
function Composer() {
  const editor = useRef<WeavourEditorRef>(null);
  return createElement(WeavourEditor, {
    ref: editor,
    editorKey: import.meta.env.VITE_EDITOR_KEY || 'YOUR_PUBLIC_EDITOR_KEY',
    userId: 'example-user', organizationId: 'example-organization',
    editorUrl: import.meta.env.VITE_EDITOR_URL || 'https://weavour.com/editor',
    apiUrl: import.meta.env.VITE_API_URL || 'https://api.weavour.com',
    locale: 'en', style: { height: '90vh', minHeight: 480 },
    onDocumentChange: email => console.log('Versioned email', email),
    onReady: () => console.log('Editor ready'), onError: console.error,
  });
}
createRoot(document.getElementById('root')!).render(createElement(Composer));
