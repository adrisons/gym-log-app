/**
 * Parses and validates a candidate import file's raw text (spec 006
 * FR-013/014): rejects unparseable JSON, a missing/wrong `format`
 * discriminant, a `schemaVersion` newer than this app understands, and a
 * structurally invalid same-version file — every rejection returns a
 * result, never throws past the caller, and nothing is written for any of
 * them (FR-014's "before any preview is shown").
 *
 * Validates every nested Session/Block/ExerciseEntry/Set and Exercise
 * shape, not just the top-level arrays (Copilot review, PR #31 — a file
 * like `{ sessions: [{}] }` previously passed this check and only failed
 * later, inside `prepareImport`, at `session.blocks.map`, well past the
 * point FR-014 requires rejection). Structural only — it does not
 * re-validate every domain invariant `createSet`/`createLoad`/
 * `createVolume` already enforced when these records were first recorded
 * (e.g. a `Volume.reps.count` of `0`) — that level of re-validation would
 * duplicate domain/ constructors' own job and isn't needed to prevent a
 * crash while applying the import.
 */
import { EXPORT_FORMAT, type ExportFile } from './export-file';
import { CURRENT_SCHEMA_VERSION } from '@/application/schema-migration';

export type ImportValidationResult =
  { ok: true; file: ExportFile } | { ok: false; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

const LOAD_KINDS = new Set([
  'weight',
  'band',
  'bodyweight',
  'freeText',
  'none',
]);
const VOLUME_KINDS = new Set(['reps', 'duration', 'distance']);
const SET_KINDS = new Set(['warmUp', 'working', 'toFailure']);
const BLOCK_TYPES = new Set(['straightSets', 'superset', 'circuit']);
const THEMES = new Set(['light', 'dark', 'system']);
const UNITS = new Set(['kg', 'lb']);
const FIRST_DAYS = new Set(['monday', 'sunday']);

function isValidLoad(value: unknown): boolean {
  return isPlainObject(value) && LOAD_KINDS.has(value.kind as string);
}

function isValidVolume(value: unknown): boolean {
  return isPlainObject(value) && VOLUME_KINDS.has(value.kind as string);
}

function isValidSet(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (!isValidLoad(value.load)) return false;
  if (value.volume !== undefined && !isValidVolume(value.volume)) return false;
  if (typeof value.setKind !== 'string' || !SET_KINDS.has(value.setKind)) {
    return false;
  }
  return typeof value.completed === 'boolean';
}

function isValidExerciseEntry(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (typeof value.exerciseId !== 'string') return false;
  if (typeof value.notes !== 'string') return false;
  return Array.isArray(value.sets) && value.sets.every(isValidSet);
}

function isValidBlock(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (typeof value.type !== 'string' || !BLOCK_TYPES.has(value.type)) {
    return false;
  }
  return (
    Array.isArray(value.exercises) &&
    value.exercises.every(isValidExerciseEntry)
  );
}

function isValidSession(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.dateTime !== 'string') return false;
  if (typeof value.notes !== 'string') return false;
  return Array.isArray(value.blocks) && value.blocks.every(isValidBlock);
}

function isValidExercise(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.canonicalName !== 'string') return false;
  if (!isStringArray(value.aliases)) return false;
  if (typeof value.defaultLoadType !== 'string') return false;
  // defaultVolumeKind/trackEffort are legitimately absent on a pre-v2
  // export (ADR-0006) — FR-012 requires accepting and migrating an
  // older-schema-version file, not rejecting it here before migration
  // ever runs. When present, though, they must be well-typed.
  if (
    value.defaultVolumeKind !== undefined &&
    typeof value.defaultVolumeKind !== 'string'
  ) {
    return false;
  }
  if (
    value.trackEffort !== undefined &&
    typeof value.trackEffort !== 'boolean'
  ) {
    return false;
  }
  if (typeof value.unilateral !== 'boolean') return false;
  return typeof value.discipline === 'string';
}

function isValidSettings(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (typeof value.defaultUnit !== 'string' || !UNITS.has(value.defaultUnit)) {
    return false;
  }
  if (typeof value.theme !== 'string' || !THEMES.has(value.theme)) {
    return false;
  }
  if (
    typeof value.firstDayOfWeek !== 'string' ||
    !FIRST_DAYS.has(value.firstDayOfWeek)
  ) {
    return false;
  }
  const increments = value.quickIncrements;
  return (
    isPlainObject(increments) &&
    typeof increments.durationSeconds === 'number' &&
    typeof increments.distanceMetres === 'number'
  );
}

function isValidLoggingDraft(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.dateTime !== 'string') return false;
  if (typeof value.notes !== 'string') return false;
  return Array.isArray(value.blocks);
}

/**
 * Structural validation of the whole file. Reports the first problem
 * found, in a fixed order, as a clear message — not every problem at
 * once (matching FR-014's "a clear message," singular).
 */
function validateStructure(
  candidate: Record<string, unknown>,
): string | undefined {
  if (candidate.format !== EXPORT_FORMAT) {
    return 'This file was not produced by this app’s export (unrecognized format).';
  }
  if (
    typeof candidate.schemaVersion !== 'number' ||
    !Number.isInteger(candidate.schemaVersion) ||
    candidate.schemaVersion < 1
  ) {
    return 'This file is missing a valid schema version and cannot be imported.';
  }
  if (
    !Array.isArray(candidate.sessions) ||
    !candidate.sessions.every(isValidSession)
  ) {
    return 'This file’s session data is missing or malformed and cannot be imported.';
  }
  if (
    !Array.isArray(candidate.exerciseCatalogue) ||
    !candidate.exerciseCatalogue.every(isValidExercise)
  ) {
    return 'This file’s exercise catalogue is missing or malformed and cannot be imported.';
  }
  if (
    candidate.bandLabels !== undefined &&
    !isStringArray(candidate.bandLabels)
  ) {
    return 'This file’s band labels are malformed and cannot be imported.';
  }
  if (
    candidate.settings !== undefined &&
    !isValidSettings(candidate.settings)
  ) {
    return 'This file’s settings are malformed and cannot be imported.';
  }
  if (
    candidate.loggingDraft !== undefined &&
    !isValidLoggingDraft(candidate.loggingDraft)
  ) {
    return 'This file’s in-progress entry is malformed and cannot be imported.';
  }
  return undefined;
}

export function parseAndValidateExportFile(
  content: string,
): ImportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      ok: false,
      message: 'This file is not valid — it could not be read as an export.',
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      message: 'This file is not valid — it could not be read as an export.',
    };
  }

  const structuralError = validateStructure(parsed);
  if (structuralError) {
    return { ok: false, message: structuralError };
  }

  const file = parsed as unknown as ExportFile;
  if (file.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      message:
        'This file was exported by a newer version of the app than this one understands. Update the app before importing it — nothing has been imported.',
    };
  }

  return { ok: true, file };
}
