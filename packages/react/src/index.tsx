'use client';
import { forwardRef, createElement, useEffect, useImperativeHandle, useRef, type HTMLAttributes } from 'react';
import { mount, EditorError, type EditorInstance, type MountOptions, type EditorConfig } from '@weavour/editor';
export type WeavourEditorProps = MountOptions & Omit<HTMLAttributes<HTMLDivElement>, keyof MountOptions | 'children'>;
export type WeavourEditorRef = Omit<EditorInstance, 'destroy'>;
const liveKeys = ['theme', 'locale', 'mergeTags', 'displayConditions', 'allowedBlocks', 'enableAi', 'aiPaidOrigin', 'enableTemplates', 'enableAutosave', 'enableEmailAudit', 'enableOrganizationBlocks', 'enableTestEmail'] as const;
const mountKeys = ['editorKey', 'userId', 'organizationId', 'document', 'emailDocument', 'subject', 'preheader', 'draftId', 'editorUrl', 'apiUrl', 'editorConfig', 'demo'] as const;

/** Mount-only props require an explicit React key change to replace the session. */
export const WeavourEditor = forwardRef<WeavourEditorRef, WeavourEditorProps>(function WeavourEditor(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorInstance | null>(null);
  const latest = useRef(props); latest.current = props;
  const initial = useRef<WeavourEditorProps | null>(null);
  const previousLive = useRef('');
  const active = () => { if (!editor.current) throw new EditorError('not_ready', 'Editor is not mounted.'); return editor.current; };
  useImperativeHandle(ref, () => ({
    get ready() { return active().ready; },
    exportHTML: () => active().exportHTML(),
    previewTemplate: () => active().previewTemplate(),
    flushAutosave: () => active().flushAutosave(),
    updateConfig: next => active().updateConfig(next),
  }), []);
  useEffect(() => {
    initial.current = latest.current;
    const value = latest.current;
    let instance: EditorInstance;
    try {
      instance = mount(container.current!, {
        ...value,
        onReady: () => latest.current.onReady?.(),
        onError: error => latest.current.onError?.(error),
        onChange: document => latest.current.onChange?.(document),
        onDocumentChange: document => latest.current.onDocumentChange?.(document),
        onSaveStatusChange: status => latest.current.onSaveStatusChange?.(status),
        onDraftChange: draft => latest.current.onDraftChange?.(draft),
        onTestEmail: value.onTestEmail ? request => { if (!latest.current.onTestEmail) throw new Error('Test email delivery is unavailable.'); return latest.current.onTestEmail(request); } : undefined,
      });
      editor.current = instance;
    } catch (error) { latest.current.onError?.(error instanceof Error ? error : new Error(String(error))); return; }
    return () => { instance.destroy(); if (editor.current === instance) editor.current = null; };
  }, []);
  useEffect(() => {
    const config: EditorConfig = { mergeTags: props.mergeTags, displayConditions: props.displayConditions };
    for (const key of liveKeys) if (Object.hasOwn(props, key)) Object.assign(config, { [key]: props[key] });
    const serialized = JSON.stringify(config);
    if (serialized !== previousLive.current) {
      try { editor.current?.updateConfig(config); previousLive.current = serialized; }
      catch (error) { latest.current.onError?.(error instanceof Error ? error : new Error(String(error))); }
    }
    const first = initial.current;
    if (first && mountKeys.some(key => JSON.stringify(props[key]) !== JSON.stringify(first[key]))) {
      latest.current.onError?.(new EditorError('invalid_config', 'Mount-only props changed. Use a new React key after saving current work.'));
    }
  });
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'id' || key === 'className' || key === 'style' || key === 'title' || key === 'role' || key === 'tabIndex' || key.startsWith('aria-') || key.startsWith('data-')) attributes[key] = value;
  }
  return createElement('div', { ...attributes, ref: container });
});
