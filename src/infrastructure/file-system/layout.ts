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
export const SETTINGS_FILE = 'settings.json';
export const META_FILE = '_meta.json';
/** Write-ahead journal for `importBulk`/`resetToFreshInstall`'s atomic
 * multi-file write (spec 006 research.md §2). Present only while such an
 * operation is in flight; its presence on the next launch means the prior
 * attempt was interrupted and needs replaying. */
export const PENDING_BULK_WRITE_FILE = '_pending-bulk-write.json';

/** `sessions/<id>.json` — one file per Session (data-model.md's rationale: individually legible, dated training records). */
export function sessionFileName(id: SessionId): string {
  return `${id}.json`;
}
