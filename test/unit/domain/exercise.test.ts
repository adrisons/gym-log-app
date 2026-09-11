import { describe, expect, it } from 'vitest';
import {
  renameExercise,
  mergeExerciseIdentities,
  deleteExercise,
} from '@/domain/exercise';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';
import {
  ExerciseMergeError,
  ExerciseDeleteConfirmationRequiredError,
} from '@/domain/errors';

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    unilateral: false,
    discipline: 'Strength',
    ...overrides,
  };
}

describe('Renaming an Exercise never breaks history (§3.3; FR-011)', () => {
  it('updates canonicalName only — id-based references stay valid', () => {
    const original = makeExercise();
    const renamed = renameExercise(original, 'Low-bar back squat');
    expect(renamed.canonicalName).toBe('Low-bar back squat');
    expect(renamed.id).toBe(original.id);
    // Any ExerciseEntry.exerciseId referencing original.id still resolves,
    // because references are id-based (FR-011) — no code change needed
    // elsewhere; this is a property of using ids, not enforced by
    // renameExercise itself.
  });
});

describe('Merging two Exercise entries — Exercise-local half (§3.3; FR-012)', () => {
  it('returns the survivor with the loser name appended as an alias (green)', () => {
    const survivor = makeExercise({
      id: 'ex-survivor' as ExerciseId,
      canonicalName: 'Back squat',
    });
    const loser = makeExercise({
      id: 'ex-loser' as ExerciseId,
      canonicalName: 'Squats',
    });
    const merged = mergeExerciseIdentities(survivor, loser);
    expect(merged.id).toBe(survivor.id);
    expect(merged.aliases).toContain('Squats');
  });

  // The cross-session Set-reassignment half of FR-012 is NOT asserted here
  // — an Exercise value alone has no access to session data. It is
  // asserted in test/unit/storage-port-fake.test.ts (T031) against the
  // storage-port fake, which does have session access. See
  // mergeExerciseIdentities's own doc comment.
});

describe('mergeExerciseIdentities rejects invalid merges (§3.3; FR-019)', () => {
  it('rejects merging an exercise with itself (red)', () => {
    const exercise = makeExercise();
    expect(() => mergeExerciseIdentities(exercise, exercise)).toThrow(
      ExerciseMergeError,
    );
  });

  it('accepts merging two distinct existing exercises (green counterpart)', () => {
    const survivor = makeExercise({ id: 'ex-a' as ExerciseId });
    const loser = makeExercise({
      id: 'ex-b' as ExerciseId,
      canonicalName: 'Squats',
    });
    expect(() => mergeExerciseIdentities(survivor, loser)).not.toThrow();
  });
});

describe('Deleting an Exercise with history requires confirmation (§3.3; FR-013, FR-020)', () => {
  it('rejects deleting an exercise with logged history without confirmation (red)', () => {
    expect(() => deleteExercise(true, false)).toThrow(
      ExerciseDeleteConfirmationRequiredError,
    );
  });

  it('accepts deleting the same exercise with confirmation (green)', () => {
    expect(() => deleteExercise(true, true)).not.toThrow();
  });

  it('accepts deleting an exercise with no logged history, without confirmation (FR-020)', () => {
    expect(() => deleteExercise(false, false)).not.toThrow();
  });
});

describe('Seed-catalogue shape is accommodated, not populated (ADR-0005; FR-016)', () => {
  it('constructs an ordinary Exercise using only fields a user-created entry would have — no "isSeed"/"source" marker required', () => {
    const exercise = makeExercise({ canonicalName: 'Push-up' });
    expect('isSeed' in exercise).toBe(false);
    expect('source' in exercise).toBe(false);
    // Behaves identically in merge/rename/delete flows:
    const renamed = renameExercise(exercise, 'Standard push-up');
    expect(renamed.canonicalName).toBe('Standard push-up');
    const other = makeExercise({
      id: 'ex-other' as ExerciseId,
      canonicalName: 'Knee push-up',
    });
    expect(() => mergeExerciseIdentities(exercise, other)).not.toThrow();
    expect(() => deleteExercise(false, false)).not.toThrow();
  });
});
