/**
 * FR-015's fixed three-tier ranking, independent of any chart-metric
 * selection (spec.md's spec-reviewer-resolved correction): highest-e1RM
 * eligible set, else highest numeric load, else highest rep count.
 */
import type { Set } from '@/domain/set';
import { estimatedOneRepMax, isE1rmEligible } from './e1rm';

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

function repsOf(set: Set): number {
  return set.volume?.kind === 'reps' ? set.volume.count : 0;
}

function isWorkingSet(set: Set): boolean {
  return set.setKind === 'working' || set.setKind === 'toFailure';
}

export function bestWorkingSet(sets: Set[]): Set | undefined {
  const workingSets = sets.filter(isWorkingSet);
  if (workingSets.length === 0) return undefined;

  const eligible = workingSets.filter(isE1rmEligible);
  if (eligible.length > 0) {
    return eligible.reduce((best, set) =>
      estimatedOneRepMax(set) > estimatedOneRepMax(best) ? set : best,
    );
  }

  const withNumericLoad = workingSets.filter(
    (set) => numericLoadValue(set) !== undefined,
  );
  if (withNumericLoad.length > 0) {
    return withNumericLoad.reduce((best, set) =>
      numericLoadValue(set)! > numericLoadValue(best)! ? set : best,
    );
  }

  return workingSets.reduce((best, set) =>
    repsOf(set) > repsOf(best) ? set : best,
  );
}
