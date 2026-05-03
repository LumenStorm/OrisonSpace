import type { FileTreeEntry } from '@orison/shared-contracts';

export type FileEntry = FileTreeEntry;
export type CtxState = { x: number; y: number; entry: FileEntry | null } | null;
export type CreatingType = 'file' | 'folder' | null;
