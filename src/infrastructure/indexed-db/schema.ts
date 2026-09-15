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
import type { Settings } from '../../application/ports/settings';

/** Single-row tables (`StoragePort`'s draft/band-labels/settings/schema-version surface), keyed by a fixed string so there is always exactly zero or one row. */
export interface SingleRow<Value> {
  key: string;
  value: Value;
}

export const DRAFT_ROW_KEY = 'current';
export const BAND_LABELS_ROW_KEY = 'current';
export const SETTINGS_ROW_KEY = 'current';
export const SCHEMA_VERSION_ROW_KEY = 'schemaVersion';
export const FILE_SYSTEM_HANDLE_ROW_KEY = 'root';

export class GymLogDatabase extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  draft!: EntityTable<SingleRow<LoggingDraft>, 'key'>;
  bandLabels!: EntityTable<SingleRow<string[]>, 'key'>;
  /** Settings (spec 006 FR-001/002) — non-canonical singleton, no schema-version bump (D14). */
  settings!: EntityTable<SingleRow<Settings>, 'key'>;
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
    // Dexie's OWN internal database version (distinct from this app's
    // CURRENT_SCHEMA_VERSION in ../schema-version.ts — that axis governs
    // this app's own migrate/open/refuse behavior over canonical data;
    // this one is Dexie's own store-shape bookkeeping). A browser that
    // already created the v1 database needs this bump to actually gain
    // the new `settings` store on next open — Dexie only carries forward
    // unchanged stores across a version bump, so only the new one needs
    // declaring here.
    this.version(2).stores({
      settings: 'key',
    });
  }
}
