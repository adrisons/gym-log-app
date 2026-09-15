/**
 * Parses and validates a candidate import file's raw text (spec 006
 * FR-013/014): rejects unparseable JSON, a missing/wrong `format`
 * discriminant, a `schemaVersion` newer than this app understands, and a
 * structurally invalid same-version file — every rejection returns a
 * result, never throws past the caller, and nothing is written for any of
 * them (FR-014's "before any preview is shown").
 */
import { EXPORT_FORMAT, type ExportFile } from './export-file';
import { CURRENT_SCHEMA_VERSION } from '@/application/schema-migration';

export type ImportValidationResult =
  { ok: true; file: ExportFile } | { ok: false; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Structural validation only — no domain-level re-validation of every
 * Set/Load/Volume (those already went through `createSet`/`createLoad`/
 * `createVolume` when originally recorded); this checks the shape an
 * `ExportFile` MUST have to be usable at all. */
function validateStructure(
  candidate: Record<string, unknown>,
): string | undefined {
  if (candidate.format !== EXPORT_FORMAT) {
    return 'This file was not produced by this app’s export (unrecognized format).';
  }
  if (typeof candidate.schemaVersion !== 'number') {
    return 'This file is missing its schema version and cannot be imported.';
  }
  if (!Array.isArray(candidate.sessions)) {
    return 'This file is missing its session data and cannot be imported.';
  }
  if (!Array.isArray(candidate.exerciseCatalogue)) {
    return 'This file is missing its exercise catalogue and cannot be imported.';
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
