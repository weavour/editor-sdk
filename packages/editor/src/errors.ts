export type EditorErrorCode = 'not_ready' | 'destroyed' | 'reloaded' | 'timeout' | 'config_failed' | 'invalid_config' | 'autosave_disabled' | 'demo_restricted' | 'export_failed' | 'incompatible_editor';
export class EditorError extends Error {
  constructor(public readonly code: EditorErrorCode, message: string) { super(message); this.name = 'EditorError'; }
}
