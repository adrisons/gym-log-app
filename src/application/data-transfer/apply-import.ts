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
function toPersistableSessions(sessions: ExportedSession[]): Session[] {
  return sessions.map((session) => ({
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
    exerciseCatalogue: migrateExerciseCatalogue(
      validation.file.exerciseCatalogue,
      originalFileVersion,
    ),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };

  const [sessions, exercises, bandLabels, settings, loggingDraft] =
    await Promise.all([
      storage.listSessions(allStoredDataRange()),
      storage.listExercises(),
      storage.listBandLabels(),
      storage.getSettings(),
      storage.getDraft(),
    ]);
  const local: LocalImportSnapshot = {
    sessions,
    exercises,
    bandLabels,
    settings,
    loggingDraft,
  };

  const preview = computeImportPreview(
    local,
    migratedFile,
    originalFileVersion,
  );

  const input: BulkImportInput = {
    sessions: toPersistableSessions(migratedFile.sessions),
    exercises: migratedFile.exerciseCatalogue,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ...(migratedFile.bandLabels !== undefined && {
      bandLabels: migratedFile.bandLabels,
    }),
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
