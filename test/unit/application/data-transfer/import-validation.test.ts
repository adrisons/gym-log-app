import { describe, expect, it } from 'vitest';
import { parseAndValidateExportFile } from '../../../../src/application/data-transfer/import-validation';
import { EXPORT_FORMAT } from '../../../../src/application/data-transfer/export-file';
import { CURRENT_SCHEMA_VERSION } from '../../../../src/application/schema-migration';

function validFileJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: EXPORT_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: '2026-09-15T00:00:00.000Z',
    sessions: [],
    exerciseCatalogue: [],
    ...overrides,
  });
}

describe('parseAndValidateExportFile (spec 006 FR-013/014)', () => {
  it('accepts a well-formed, same-version export', () => {
    const result = parseAndValidateExportFile(validFileJson());
    expect(result.ok).toBe(true);
  });

  it('rejects unparseable JSON with a clear message, never throwing', () => {
    const result = parseAndValidateExportFile('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  it('rejects a file with the wrong or missing format discriminant', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ format: 'some-other-app-export' }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a structurally invalid same-version file (missing sessions array)', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ sessions: undefined }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a schemaVersion newer than this app understands (FR-013), with a clear actionable message', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.toLowerCase()).toContain('newer');
    }
  });

  it('accepts an older schemaVersion (migration happens later, not here)', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ schemaVersion: 1 }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a JSON array (not a plain object) at the top level', () => {
    const result = parseAndValidateExportFile('[1,2,3]');
    expect(result.ok).toBe(false);
  });
});
