import type { EditorTheme } from './editor-theme.js';
import type { MergeTag, MergeTagReference, MergeTagUsage, MergeTagIssue } from './merge-tags.js';
import type { EmailDocument } from './email-document.js';
import type { EditorBlockId } from './editor-blocks.js';
export type { EditorTheme, MergeTag, MergeTagReference, MergeTagUsage, MergeTagIssue, EmailDocument, EditorBlockId };
export type EditorExport = { html: string; text: string; document: Record<string, unknown>; subject: string; preheader: string; mergeTags: MergeTagUsage[]; mergeTagIssues: MergeTagIssue[] };
export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed' | 'conflict' | 'read-only';
export type DraftChange = { draftId: string | null; revision: number | null };
export type SaveStatusChange = DraftChange & { status: SaveStatus };
export type DraftSummary = { id: string; subject: string; revision: number; metadataRevision: number; hash: string; createdAt: number; updatedAt: number; archivedAt: number | null; sourceTemplateId: string | null; baseTemplateRevision: number | null };
export type DraftFlushResult = { draft: DraftSummary | null };
export type TestEmailRequest = { to: string; subject: string; html: string; text: string; document: Record<string, unknown> };
export type EditorConfig = { theme?: EditorTheme; mergeTags?: MergeTag[]; locale?: string; allowedBlocks?: EditorBlockId[]; enableAi?: boolean; aiPaidOrigin?: string; enableTemplates?: boolean; enableAutosave?: boolean };
export type EditorCallbacks = {
  onReady?(): void;
  onError?(error: Error): void;
  onChange?(document: Record<string, unknown>): void;
  onDocumentChange?(document: EmailDocument): void;
  onTestEmail?(request: TestEmailRequest): void | Promise<void>;
  onDraftChange?(value: DraftChange): void;
  onSaveStatusChange?(value: SaveStatusChange): void;
};
export type MountOptions = EditorConfig & EditorCallbacks & {
  editorKey: string; userId?: string; organizationId?: string;
  document?: Record<string, unknown>; emailDocument?: EmailDocument;
  subject?: string; preheader?: string; draftId?: string;
  editorConfig?: EditorConfig; editorUrl?: string; apiUrl?: string;
  demo?: boolean;
};
export type EditorInstance = {
  readonly ready: Promise<void>;
  exportHTML(): Promise<EditorExport>;
  previewTemplate(): Promise<EmailDocument>;
  flushAutosave(): Promise<DraftFlushResult>;
  updateConfig(config: EditorConfig): void;
  destroy(): void;
};
export type EditorSDK = { mount(target: HTMLElement | string, options: MountOptions): EditorInstance };
/** Dependency injection for local hosts and private dashboard adapters. Never serialized to the iframe. */
export type SDKOptions = { fetch?: typeof globalThis.fetch; scriptUrl?: string; readiness?: 'application' | 'configured' };
