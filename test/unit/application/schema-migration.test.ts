import { describe, expect, it } from 'vitest';
import {
  migrateExerciseCatalogue,
  migrateExerciseTemplateDefaults,
  migrateBandLoad,
  migrateSessionBandLoads,
  migrateSessionsBandLoad,
} from '../../../src/application/schema-migration';
import type { Exercise } from '../../../src/domain/exercise';
import type { ExerciseId, SessionId } from '../../../src/domain/ids';
import type { Session } from '../../../src/domain/session';
import type { Load } from '../../../src/domain/load';

function legacyV1Exercise(
  overrides: Partial<Omit<Exercise, 'defaultVolumeKind' | 'trackEffort'>> = {},
): Exercise {
  // A genuinely pre-v2 shape: defaultVolumeKind/trackEffort absent, as a
  // real legacy record would be (TypeScript can't express "field absent"
  // on Exercise's own type, so this is deliberately cast, and built
  // without ever including those two fields rather than stripping them).
  return {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    unilateral: false,
    discipline: 'Strength',
    ...overrides,
  } as unknown as Exercise;
}

describe('migrateExerciseTemplateDefaults (ADR-0006 v1->v2 backfill)', () => {
  it('fills defaultVolumeKind/trackEffort with safe defaults when missing', () => {
    const migrated = migrateExerciseTemplateDefaults(legacyV1Exercise());
    expect(migrated.defaultVolumeKind).toBe('reps');
    expect(migrated.trackEffort).toBe(false);
  });

  it('is idempotent — already-migrated values pass through unchanged', () => {
    const already: Exercise = {
      id: 'ex-1' as ExerciseId,
      canonicalName: 'Back squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'duration',
      trackEffort: true,
      unilateral: false,
      discipline: 'Strength',
    };
    const migrated = migrateExerciseTemplateDefaults(already);
    expect(migrated.defaultVolumeKind).toBe('duration');
    expect(migrated.trackEffort).toBe(true);
  });

  it('preserves every other field unchanged', () => {
    const legacy = legacyV1Exercise({ canonicalName: 'Front squat' });
    expect(migrateExerciseTemplateDefaults(legacy).canonicalName).toBe(
      'Front squat',
    );
  });
});

describe('migrateExerciseCatalogue (spec 006 research.md §3)', () => {
  it('migrates every exercise when storedVersion < 2', () => {
    const catalogue = [
      legacyV1Exercise(),
      legacyV1Exercise({ id: 'ex-2' as ExerciseId }),
    ];
    const migrated = migrateExerciseCatalogue(catalogue, 1);
    expect(migrated.every((e) => e.defaultVolumeKind === 'reps')).toBe(true);
    expect(migrated.every((e) => e.trackEffort === false)).toBe(true);
  });

  it('is a no-op when storedVersion is already 2 or higher — no v2->v3 Exercise backfill exists (ADR-0008)', () => {
    const catalogue = [legacyV1Exercise()];
    expect(migrateExerciseCatalogue(catalogue, 2)).toEqual(catalogue);
    expect(migrateExerciseCatalogue(catalogue, 3)).toEqual(catalogue);
  });
});

function sessionWithLoad(
  load: Load,
  id: SessionId = 'sess-1' as SessionId,
): Session {
  return {
    id,
    dateTime: '2026-01-01T00:00:00.000Z',
    notes: '',
    blocks: [
      {
        type: 'straightSets',
        exercises: [
          {
            exerciseId: 'ex-1' as ExerciseId,
            notes: '',
            sets: [
              {
                load,
                setKind: 'working',
                completed: true,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('migrateBandLoad (ADR-0016 v4->v5 backfill)', () => {
  it('rewrites a legacy band load to freeText, preserving the label as text', () => {
    const legacy = { kind: 'band', label: 'Red' } as unknown as Load;
    expect(migrateBandLoad(legacy)).toEqual({
      kind: 'freeText',
      text: 'Band: Red',
    });
  });

  it('is idempotent — a load already migrated (or never band) passes through unchanged', () => {
    const freeText: Load = { kind: 'freeText', text: 'Band: Red' };
    expect(migrateBandLoad(freeText)).toEqual(freeText);
    const weight: Load = { kind: 'weight', value: 60, unit: 'kg' };
    expect(migrateBandLoad(weight)).toBe(weight);
    const none: Load = { kind: 'none' };
    expect(migrateBandLoad(none)).toBe(none);
  });
});

describe('migrateSessionBandLoads / migrateSessionsBandLoad (ADR-0016)', () => {
  it('rewrites every Set.load with kind band in a Session, leaving other sets untouched', () => {
    const legacy = { kind: 'band', label: 'Blue' } as unknown as Load;
    const session = sessionWithLoad(legacy);
    const migrated = migrateSessionBandLoads(session);
    expect(migrated.blocks[0]?.exercises[0]?.sets[0]?.load).toEqual({
      kind: 'freeText',
      text: 'Band: Blue',
    });
  });

  it('migrateSessionsBandLoad migrates every session when storedVersion < 5', () => {
    const legacy = { kind: 'band', label: 'Green' } as unknown as Load;
    const sessions = [
      sessionWithLoad(legacy, 's1' as SessionId),
      sessionWithLoad(legacy, 's2' as SessionId),
    ];
    const migrated = migrateSessionsBandLoad(sessions, 4);
    for (const session of migrated) {
      expect(session.blocks[0]?.exercises[0]?.sets[0]?.load).toEqual({
        kind: 'freeText',
        text: 'Band: Green',
      });
    }
  });

  it('is a no-op when storedVersion is already 5 or higher', () => {
    const legacy = { kind: 'band', label: 'Green' } as unknown as Load;
    const sessions = [sessionWithLoad(legacy)];
    expect(migrateSessionsBandLoad(sessions, 5)).toEqual(sessions);
  });

  it('is idempotent — re-running the migration on already-migrated sessions changes nothing further', () => {
    const legacy = { kind: 'band', label: 'Purple' } as unknown as Load;
    const once = migrateSessionsBandLoad([sessionWithLoad(legacy)], 4);
    const twice = migrateSessionsBandLoad(once, 4);
    expect(twice).toEqual(once);
  });
});
