/**
 * `Exercise` (catalogue) — a reusable, user-owned definition of a
 * movement (`docs/requirements.md` §3.1; FR-001).
 *
 * No field distinguishes a seed-provided entry from a user-created one
 * (FR-016, ADR-0005) — a seed entry is just an `Exercise` constructed by
 * the app at first launch, indistinguishable from one the user later
 * creates.
 */

import type { Load } from './load';
import type { ExerciseId } from './ids';
import {
  ExerciseMergeError,
  ExerciseDeleteConfirmationRequiredError,
} from './errors';

export interface Exercise {
  id: ExerciseId;
  canonicalName: string;
  aliases: string[];
  /** Optional (`docs/requirements.md` §3.1). */
  movementPattern?: string;
  /** Optional (`docs/requirements.md` §3.1). */
  muscleGroups?: string[];
  defaultLoadType: Load['kind'];
  unilateral: boolean;
  /** Fixed in v1 (canonical casing per `docs/requirements.md` §1.4); FR-001 — present so a future value is additive. */
  discipline: 'Strength';
}

/**
 * Renames a catalogue `Exercise`. Updates `canonicalName` only — every
 * existing `ExerciseEntry` reference stays valid because references are
 * id-based, never name-based (FR-011); no other code path needs to change.
 */
export function renameExercise(exercise: Exercise, newName: string): Exercise {
  return { ...exercise, canonicalName: newName };
}

/**
 * The `Exercise`-local half of merging two catalogue entries (FR-012,
 * FR-019).
 *
 * Scope note (tasks.md T026): an `Exercise` value alone has no access to
 * the `Session`/`ExerciseEntry` data that reference it, so the
 * cross-session reassignment of every dependent `Set` (the rest of
 * FR-012's effect) cannot be performed here — that is
 * `StoragePort.mergeExercises`'s job (`contracts/storage-port.md`), which
 * does have access to every stored session. This function does only the
 * `Exercise`-local part: validates the survivor/loser are distinct
 * existing exercises (throwing `ExerciseMergeError` otherwise) and returns
 * the survivor with the loser's name appended to `aliases`.
 */
export function mergeExerciseIdentities(
  survivor: Exercise,
  loser: Exercise,
): Exercise {
  if (survivor.id === loser.id) {
    throw new ExerciseMergeError(
      'mergeExerciseIdentities: survivor and loser must be distinct exercises.',
    );
  }
  return {
    ...survivor,
    aliases: [...survivor.aliases, loser.canonicalName],
  };
}

/** Whether a catalogue `Exercise` has at least one logged `Set` referencing it. */
export type ExerciseHasHistory = boolean;

/**
 * Deletes a catalogue `Exercise`.
 *
 * Throws `ExerciseDeleteConfirmationRequiredError` when the exercise has
 * logged history and `confirmed` is not `true` (FR-013) — the caller/UI
 * layer maps that error type to a confirm-or-merge prompt. Proceeds
 * without confirmation when there is no logged history (FR-020) or when
 * `confirmed` is `true`.
 *
 * "History" (whether any `Set` references this exercise) is determined by
 * the caller and passed in as `hasHistory` — an `Exercise` value alone has
 * no access to session data, the same boundary `mergeExerciseIdentities`
 * documents above.
 */
export function deleteExercise(
  hasHistory: ExerciseHasHistory,
  confirmed: boolean,
): void {
  if (hasHistory && !confirmed) {
    throw new ExerciseDeleteConfirmationRequiredError(
      'Deleting an Exercise with logged history requires confirmation; merging is the alternative.',
    );
  }
}
