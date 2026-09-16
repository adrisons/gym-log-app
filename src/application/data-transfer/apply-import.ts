/**
 * Orchestrates FR-011/012: validate → migrate in memory → read local
 * state → compute the preview → (caller decides confirm/cancel) → on
 * confirm, one atomic `StoragePort.importBulk` call. Cancelling simply
 * means never calling the returned `commit()` — nothing was written or
 * recorded, satisfying FR-012's "no trace" requirement with no separate
 * rollback logic needed.
 */
import type {
  StoragePort,
  BulkImportInput,
} from '@/application/ports/storage-port';
import type { Session } from '@/domain/session';
import { allStoredDataRange } from '@/application/date-range';
import {
  parseAndValidateExportFile,
  type ImportValidationResult,
} from './import-validation';
import {
  computeImportPreview,
  type ImportPreview,
  type LocalImportSnapshot,
} from './import-preview';
import {
  migrateExerciseCatalogue,
  migrateExerciseCatalogueLoadType,
  migrateSessionsBandLoad,
  migrateDraftBandLoad,
  CURRENT_SCHEMA_VERSION,
} from '@/application/schema-migration';
import type { ExportFile, ExportedSession } from './export-file';

export interface PreparedImport {
  preview: ImportPreview;
  commit: () => Promise<void>;
}

export type PrepareImportResult =
  { ok: true; prepared: PreparedImport } | { ok: false; message: string };

/** Strips the export's denormalized `exerciseName` (FR-008/022, readability
 * only) back off before writing — the domain `ExerciseEntry` shape has no
 * such field. */
function toPersistableSessions(
  sessions: ExportedSession[],
  fileVersion: number,
): Session[] {
  const stripped: Session[] = sessions.map((session) => ({
    ...session,
    blocks: session.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map(
        (entry): Session['blocks'][number]['exercises'][number] => ({
          exerciseId: entry.exerciseId,
          notes: entry.notes,
          sets: entry.sets,
        }),
      ),
    })),
  }));
  // A pre-v5 export (ADR-0016) may still carry `Set.load` values with
  // `kind: 'band'` — rewritten to `freeText` here, the same migration
  // (and the same reasoning) `StoragePort`'s own adapters apply to
  // already-stored data, so an imported file's band loads land exactly
  // where a locally-migrated one would.
  return migrateSessionsBandLoad(stripped, fileVersion);
}

export async function prepareImport(
  storage: StoragePort,
  content: string,
): Promise<PrepareImportResult> {
  const validation: ImportValidationResult =
    parseAndValidateExportFile(content);
  if (!validation.ok) return validation;

  const originalFileVersion = validation.file.schemaVersion;
  const migratedFile: ExportFile = {
    ...validation.file,
    exerciseCatalogue: migrateExerciseCatalogueLoadType(
      migrateExerciseCatalogue(
        validation.file.exerciseCatalogue,
        originalFileVersion,
      ),
      originalFileVersion,
    ),
    // A pre-v5 export (ADR-0016) may still carry a `loggingDraft` whose
    // sets have `Load` values with `kind: 'band'` — the same exposure
    // `toPersistableSessions` already fixes for `sessions` below, applied
    // here so a valid pre-v5 export can never reintroduce a `band` load
    // into `BulkImportInput.loggingDraft` (Copilot review, PR #39).
    ...(validation.file.loggingDraft !== undefined && {
      loggingDraft: migrateDraftBandLoad(validation.file.loggingDraft),
    }),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };

  const [sessions, exercises, settings, loggingDraft] = await Promise.all([
    storage.listSessions(allStoredDataRange()),
    storage.listExercises(),
    storage.getSettings(),
    storage.getDraft(),
  ]);
  const local: LocalImportSnapshot = {
    sessions,
    exercises,
    settings,
    loggingDraft,
  };

  const preview = computeImportPreview(
    local,
    migratedFile,
    originalFileVersion,
  );

  const input: BulkImportInput = {
    sessions: toPersistableSessions(migratedFile.sessions, originalFileVersion),
    exercises: migratedFile.exerciseCatalogue,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...(migratedFile.settings !== undefined && {
      settings: migratedFile.settings,
    }),
    ...(migratedFile.loggingDraft !== undefined && {
      loggingDraft: migratedFile.loggingDraft,
    }),
  };

  return {
    ok: true,
    prepared: {
      preview,
      commit: () => storage.importBulk(input),
    },
  };
}
