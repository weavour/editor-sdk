export const editorBlockIds = [
  'text', 'heading', 'button', 'image', 'video', 'gif', 'timer', 'menu',
  'social', 'unsubscribe', 'list', 'html', 'space', 'divider', 'section', 'columns',
] as const;

export type EditorBlockId = typeof editorBlockIds[number];
