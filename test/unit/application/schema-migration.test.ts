import { describe, expect, it } from 'vitest';
import {
  migrateExerciseCatalogue,
  migrateExerciseTemplateDefaults,
} from '../../../src/application/schema-migration';
import type { Exercise } from '../../../src/domain/exercise';
import type { ExerciseId } from '../../../src/domain/ids';

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
