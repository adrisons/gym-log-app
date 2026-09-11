/**
 * Estimated 1RM (spec 004 FR-017; `docs/requirements.md` §5.2). Epley
 * formula, only for `Weight` loads and `Bodyweight` with a numeric added
 * load, only for working sets of 1-12 reps.
 */
import type { Set } from '@/domain/set';

const MIN_E1RM_REPS = 1;
const MAX_E1RM_REPS = 12;

function numericLoadValue(set: Set): number | undefined {
  if (set.load.kind === 'weight') return set.load.value;
  if (
    set.load.kind === 'bodyweight' &&
    set.load.addedOrAssistedKg !== undefined
  ) {
    return set.load.addedOrAssistedKg;
  }
  return undefined;
}

export function isE1rmEligible(set: Set): boolean {
  if (set.setKind === 'warmUp') return false;
  if (numericLoadValue(set) === undefined) return false;
  if (set.volume?.kind !== 'reps') return false;
  return set.volume.count >= MIN_E1RM_REPS && set.volume.count <= MAX_E1RM_REPS;
}

/** Precondition: `isE1rmEligible(set)` is `true`. */
export function estimatedOneRepMax(set: Set): number {
  const load = numericLoadValue(set);
  const reps = set.volume?.kind === 'reps' ? set.volume.count : undefined;
  if (load === undefined || reps === undefined) {
    throw new Error('estimatedOneRepMax: set is not e1RM-eligible');
  }
  return load * (1 + reps / 30);
}
