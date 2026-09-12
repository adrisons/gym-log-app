/**
 * File path/name helpers for `FileSystemStorageAdapter` (spec 003
 * data-model.md "File System Access — file map"). Pure — no filesystem
 * access here, only the naming convention every read/write agrees on.
 */
import type { SessionId } from '../../domain/ids';

export const SESSIONS_DIR = 'sessions';
export const EXERCISES_FILE = 'exercises.json';
export const DRAFT_FILE = 'draft.json';
export const BAND_LABELS_FILE = 'band-labels.json';
export const META_FILE = '_meta.json';

/** `sessions/<id>.json` — one file per Session (data-model.md's rationale: individually legible, dated training records). */
export function sessionFileName(id: SessionId): string {
  return `${id}.json`;
}
