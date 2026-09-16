import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../../../support';
import { prepareImport } from '../../../../src/application/data-transfer/apply-import';
import { buildExportFile } from '../../../../src/application/data-transfer/export-file';
import type { Exercise } from '../../../../src/domain/exercise';
import type { ExerciseId, SessionId } from '../../../../src/domain/ids';
import { CURRENT_SCHEMA_VERSION } from '../../../../src/application/schema-migration';

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
    ...overrides,
  };
}

describe('prepareImport (spec 006 FR-011/012)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it('returns the validation failure unchanged for an invalid file, calling no storage method', async () => {
    const result = await prepareImport(storage, '{not json');
    expect(result.ok).toBe(false);
    expect(await storage.listExercises()).toEqual([]);
  });

  it('prepares a preview without writing anything until commit() is called', async () => {
    const exercise = makeExercise();
    const file = buildExportFile({
      sessions: [],
      exercises: [exercise],
      settings: undefined,
      loggingDraft: undefined,
    });
    const result = await prepareImport(storage, JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prepared.preview.exercises).toEqual({
      toAdd: 1,
      toReplace: 0,
    });
    expect(await storage.listExercises()).toEqual([]); // nothing written yet

    await result.prepared.commit();
    expect(await storage.listExercises()).toEqual([exercise]);
  });

  it('cancelling (never calling commit) leaves no trace at all', async () => {
    const file = buildExportFile({
      sessions: [],
      exercises: [makeExercise()],
      settings: undefined,
      loggingDraft: undefined,
    });
    const result = await prepareImport(storage, JSON.stringify(file));
    expect(result.ok).toBe(true);
    // Simulate "cancel": simply never call commit().
    expect(await storage.listExercises()).toEqual([]);
    expect(await storage.getSchemaVersion()).toBe(0);
  });

  it('migrates an older-schema-version exercise catalogue in memory before committing (FR-012)', async () => {
    const legacyExercise = {
      id: 'ex-legacy' as ExerciseId,
      canonicalName: 'Legacy squat',
      aliases: [],
      defaultLoadType: 'weight' as const,
      unilateral: false,
      discipline: 'Strength' as const,
      // defaultVolumeKind/trackEffort deliberately absent (v1 shape)
    } as unknown as Exercise;
    const file = {
      format: 'gym-log-export' as const,
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sessions: [],
      exerciseCatalogue: [legacyExercise],
    };

    const result = await prepareImport(storage, JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.prepared.preview.schemaVersion).toEqual({
      fileVersion: 1,
      willMigrate: true,
    });

    await result.prepared.commit();
    const imported = await storage.getExercise(legacyExercise.id);
    expect(imported?.defaultVolumeKind).toBe('reps');
    expect(imported?.trackEffort).toBe(false);
    expect(await storage.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migrates a pre-v5 imported session Set.load of kind band to freeText (ADR-0016)', async () => {
    const exercise = makeExercise();
    const file = {
      format: 'gym-log-export' as const,
      schemaVersion: 4,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sessions: [
        {
          id: 'sess-band' as SessionId,
          dateTime: '2026-09-10T18:00:00.000Z',
          notes: '',
          blocks: [
            {
              type: 'straightSets',
              exercises: [
                {
                  exerciseId: exercise.id,
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
      exerciseCatalogue: [exercise],
    };

    const result = await prepareImport(storage, JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await result.prepared.commit();
    const saved = await storage.getSession('sess-band' as SessionId);
    expect(saved?.blocks[0]?.exercises[0]?.sets[0]?.load).toEqual({
      kind: 'freeText',
      text: 'Band: Red',
    });
  });

  it('strips the denormalized exerciseName before writing sessions', async () => {
    const exercise = makeExercise();
    const file = buildExportFile({
      sessions: [
        {
          id: 'sess-1' as SessionId,
          dateTime: '2026-09-10T18:00:00.000Z',
          notes: '',
          blocks: [
            {
              type: 'straightSets',
              exercises: [{ exerciseId: exercise.id, notes: '', sets: [] }],
            },
          ],
        },
      ],
      exercises: [exercise],
      settings: undefined,
      loggingDraft: undefined,
    });
    const result = await prepareImport(storage, JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await result.prepared.commit();
    const saved = await storage.getSession('sess-1' as SessionId);
    expect(saved?.blocks[0]?.exercises[0]).not.toHaveProperty('exerciseName');
  });
});
