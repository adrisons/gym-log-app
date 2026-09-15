/**
 * Builds the primary JSON interchange file (spec 006 FR-007/008/021/022/
 *023; data-model.md "ExportFile"). Pure — a function of already-read
 * `StoragePort` results, no I/O here.
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import type { LoggingDraft } from '@/application/ports/logging-draft';
import type { Settings } from '@/application/ports/settings';
import { CURRENT_SCHEMA_VERSION } from '@/application/schema-migration';

export const EXPORT_FORMAT = 'gym-log-export' as const;

/** An `ExerciseEntry`, plus a denormalized name purely for readability
 * (FR-008/FR-022) — `exerciseId` remains the sole field FR-010's identity
 * matching uses, so a rename between export and import never causes a
 * false non-match (research.md §4). */
export type ExportedExerciseEntry = ExerciseEntry & { exerciseName: string };

export type ExportedSession = Omit<Session, 'blocks'> & {
  blocks: (Omit<Session['blocks'][number], 'exercises'> & {
    exercises: ExportedExerciseEntry[];
  })[];
};

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  /** ISO 8601, informational only — never used for identity/merge decisions (FR-023). */
  exportedAt: string;
  sessions: ExportedSession[];
  exerciseCatalogue: Exercise[];
  bandLabels?: string[];
  settings?: Settings;
  loggingDraft?: LoggingDraft;
}

export interface LocalExportSource {
  sessions: Session[];
  exercises: Exercise[];
  bandLabels: string[];
  settings: Settings | undefined;
  loggingDraft: LoggingDraft | undefined;
  now?: Date;
}

function exerciseNameById(exercises: Exercise[]): Map<string, string> {
  return new Map(exercises.map((e) => [e.id, e.canonicalName]));
}

function denormalizeSession(
  session: Session,
  nameById: Map<string, string>,
): ExportedSession {
  return {
    ...session,
    blocks: session.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((entry) => ({
        ...entry,
        exerciseName: nameById.get(entry.exerciseId) ?? entry.exerciseId,
      })),
    })),
  };
}

/**
 * Builds the export file. `bandLabels`/`settings`/`loggingDraft` are
 * included only when present locally (data-model.md's presence
 * semantics): an empty band-label list and an absent Settings/draft are
 * both omitted from the file entirely, not written as an empty/default
 * placeholder — FR-010's import preview relies on this to report true
 * presence.
 */
export function buildExportFile(source: LocalExportSource): ExportFile {
  const nameById = exerciseNameById(source.exercises);
  const file: ExportFile = {
    format: EXPORT_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: (source.now ?? new Date()).toISOString(),
    sessions: source.sessions.map((s) => denormalizeSession(s, nameById)),
    exerciseCatalogue: source.exercises,
  };
  if (source.bandLabels.length > 0) file.bandLabels = source.bandLabels;
  if (source.settings !== undefined) file.settings = source.settings;
  if (source.loggingDraft !== undefined)
    file.loggingDraft = source.loggingDraft;
  return file;
}
