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

  it('rejects a session whose blocks are structurally empty objects instead of real Blocks (Copilot review, PR #31)', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        sessions: [
          {
            id: 'sess-1',
            dateTime: '2026-09-10T00:00:00.000Z',
            notes: '',
            blocks: [{}],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('session data');
  });

  it('rejects a session missing required top-level fields', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ sessions: [{}] }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a Block with an unrecognized type', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        sessions: [
          {
            id: 'sess-1',
            dateTime: '2026-09-10T00:00:00.000Z',
            notes: '',
            blocks: [{ type: 'not-a-real-type', exercises: [] }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an ExerciseEntry whose sets are malformed (bad load kind)', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        sessions: [
          {
            id: 'sess-1',
            dateTime: '2026-09-10T00:00:00.000Z',
            notes: '',
            blocks: [
              {
                type: 'straightSets',
                exercises: [
                  {
                    exerciseId: 'ex-1',
                    notes: '',
                    sets: [
                      {
                        load: { kind: 'not-a-real-kind' },
                        setKind: 'working',
                        completed: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('accepts a well-formed session with a full straightSets block, matching the shape buildExportFile produces', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        sessions: [
          {
            id: 'sess-1',
            dateTime: '2026-09-10T00:00:00.000Z',
            notes: '',
            blocks: [
              {
                type: 'straightSets',
                exercises: [
                  {
                    exerciseId: 'ex-1',
                    exerciseName: 'Back squat',
                    notes: '',
                    sets: [
                      {
                        load: { kind: 'weight', value: 100, unit: 'kg' },
                        volume: { kind: 'reps', count: 5 },
                        setKind: 'working',
                        completed: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects an Exercise catalogue entry missing required fields', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ exerciseCatalogue: [{ id: 'ex-1' }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('exercise catalogue');
  });

  it('accepts an older-schema Exercise legitimately missing defaultVolumeKind/trackEffort (FR-012)', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        schemaVersion: 1,
        exerciseCatalogue: [
          {
            id: 'ex-legacy',
            canonicalName: 'Legacy squat',
            aliases: [],
            defaultLoadType: 'weight',
            unilateral: false,
            discipline: 'Strength',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects an Exercise whose trackEffort is present but the wrong type', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        exerciseCatalogue: [
          {
            id: 'ex-1',
            canonicalName: 'Back squat',
            aliases: [],
            defaultLoadType: 'weight',
            defaultVolumeKind: 'reps',
            trackEffort: 'no',
            unilateral: false,
            discipline: 'Strength',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('ignores an unrecognized top-level field (e.g. a pre-v5 export’s leftover bandLabels)', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ bandLabels: ['Red', 'Blue'] }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a legacy Set.load of kind "band" structurally (ADR-0016) — apply-import.ts migrates it to freeText, this layer does not reject it', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        sessions: [
          {
            id: 'sess-1',
            dateTime: '2026-01-01T00:00:00.000Z',
            notes: '',
            blocks: [
              {
                type: 'straightSets',
                exercises: [
                  {
                    exerciseId: 'ex-1',
                    notes: '',
                    sets: [
                      {
                        load: { kind: 'band', label: 'Red' },
                        setKind: 'working',
                        completed: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects malformed settings (bad theme enum)', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        settings: {
          defaultUnit: 'kg',
          theme: 'ultraviolet',
          firstDayOfWeek: 'monday',
          quickIncrements: { durationSeconds: 30, distanceMetres: 100 },
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('settings');
  });

  it('accepts well-formed settings', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        settings: {
          defaultUnit: 'lb',
          theme: 'dark',
          firstDayOfWeek: 'sunday',
          quickIncrements: { durationSeconds: 15, distanceMetres: 50 },
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a malformed in-progress loggingDraft', () => {
    const result = parseAndValidateExportFile(
      validFileJson({ loggingDraft: { id: 'draft-1' } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('in-progress entry');
  });

  it('accepts a well-formed loggingDraft', () => {
    const result = parseAndValidateExportFile(
      validFileJson({
        loggingDraft: {
          id: 'draft-1',
          dateTime: '2026-09-10T00:00:00.000Z',
          notes: '',
          blocks: [],
        },
      }),
    );
    expect(result.ok).toBe(true);
  });
});
