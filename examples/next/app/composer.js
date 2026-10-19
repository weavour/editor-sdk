'use client';
import { createElement } from 'react';
import { WeavourEditor } from '@weavour/react';
export default function Composer() {
  return createElement(WeavourEditor, {
    editorKey: process.env.NEXT_PUBLIC_EDITOR_KEY || 'YOUR_PUBLIC_EDITOR_KEY',
    userId: 'example-user', organizationId: 'example-organization',
    style: { height: '90vh', minHeight: 480 },
    onError: error => console.error(error),
  });
}
