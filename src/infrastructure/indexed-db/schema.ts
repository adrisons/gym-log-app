/**
 * The Dexie database definition backing `IndexedDbStorageAdapter` (spec 003
 * data-model.md "IndexedDB (Dexie) — table map"). Table names mirror
 * `StoragePort`'s own method grouping
 * (`src/application/ports/storage-port.ts`'s comments already group
 * methods by "Sessions" / "Exercise catalogue" / "The logging draft" / band
 * labels / schema version) — the simplest possible mapping, nothing to
 * design beyond naming the tables.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Session } from '../../domain/session';
import type { Exercise } from '../../domain/exercise';
import type { LoggingDraft } from '../../application/ports/storage-port';

/** Single-row tables (`StoragePort`'s draft/band-labels/schema-version surface), keyed by a fixed string so there is always exactly zero or one row. */
export interface SingleRow<Value> {
  key: string;
  value: Value;
}

export const DRAFT_ROW_KEY = 'current';
export const BAND_LABELS_ROW_KEY = 'current';
export const SCHEMA_VERSION_ROW_KEY = 'schemaVersion';
export const FILE_SYSTEM_HANDLE_ROW_KEY = 'root';

export class GymLogDatabase extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  draft!: EntityTable<SingleRow<LoggingDraft>, 'key'>;
  bandLabels!: EntityTable<SingleRow<string[]>, 'key'>;
  meta!: EntityTable<SingleRow<number>, 'key'>;
  /**
   * Not part of `StoragePort` — `FileSystemStorageAdapter`'s own cache of
   * its acquired `FileSystemDirectoryHandle`, stored here purely as a
   * convenient structured-clone store shared with the IndexedDB adapter's
   * own dependency (spec 003 research.md §2).
   */
  fileSystemHandle!: EntityTable<SingleRow<FileSystemDirectoryHandle>, 'key'>;

  constructor(name = 'gym-log') {
    super(name);
    this.version(1).stores({
      sessions: 'id',
      exercises: 'id',
      draft: 'key',
      bandLabels: 'key',
      meta: 'key',
      fileSystemHandle: 'key',
    });
  }
}
