/**
 * Computes the add/replace preview FR-010 requires, before anything is
 * written. Pure — a function of two already-read snapshots (local
 * `StoragePort` reads, and a parsed+validated `ExportFile`); no
 * `StoragePort` call happens inside it.
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { LoggingDraft } from '@/application/ports/logging-draft';
import type { Settings } from '@/application/ports/settings';
import type { ExportFile } from './export-file';
import { CURRENT_SCHEMA_VERSION } from '@/application/schema-migration';

export interface RecordSetPreview {
  toAdd: number;
  toReplace: number;
}

export interface SingletonPreview {
  present: boolean;
  willReplace: boolean;
}

export interface ImportPreview {
  sessions: RecordSetPreview;
  exercises: RecordSetPreview;
  bandLabels: SingletonPreview;
  settings: SingletonPreview;
  loggingDraft: SingletonPreview;
  schemaVersion: { fileVersion: number; willMigrate: boolean };
}

export interface LocalImportSnapshot {
  sessions: Session[];
  exercises: Exercise[];
  bandLabels: string[];
  settings: Settings | undefined;
  loggingDraft: LoggingDraft | undefined;
}

function recordSetPreview<T extends { id: string }>(
  local: T[],
  incoming: T[],
): RecordSetPreview {
  const localIds = new Set(local.map((r) => r.id));
  let toAdd = 0;
  let toReplace = 0;
  for (const record of incoming) {
    if (localIds.has(record.id)) toReplace += 1;
    else toAdd += 1;
  }
  return { toAdd, toReplace };
}

function singletonPreview(
  present: boolean,
  localHasOne: boolean,
): SingletonPreview {
  return { present, willReplace: present && localHasOne };
}

/**
 * `originalFileVersion` is the file's *own* `schemaVersion` as exported
 * (before any in-memory migration, FR-012) — kept separate from `file`
 * itself so the preview can honestly report "this file will be migrated
 * from vX" even when `file`'s `exerciseCatalogue` has already been
 * migrated to the current version by the caller (`apply-import.ts`)
 * before this function runs.
 */
export function computeImportPreview(
  local: LocalImportSnapshot,
  file: ExportFile,
  originalFileVersion: number = file.schemaVersion,
): ImportPreview {
  return {
    sessions: recordSetPreview(local.sessions, file.sessions),
    exercises: recordSetPreview(local.exercises, file.exerciseCatalogue),
    bandLabels: singletonPreview(
      file.bandLabels !== undefined,
      local.bandLabels.length > 0,
    ),
    settings: singletonPreview(
      file.settings !== undefined,
      local.settings !== undefined,
    ),
    loggingDraft: singletonPreview(
      file.loggingDraft !== undefined,
      local.loggingDraft !== undefined,
    ),
    schemaVersion: {
      fileVersion: originalFileVersion,
      willMigrate: originalFileVersion < CURRENT_SCHEMA_VERSION,
    },
  };
}
