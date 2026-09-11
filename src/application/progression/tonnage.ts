/**
 * Session tonnage (spec 004 FR-018; `docs/requirements.md` §5.3):
 * `sum(load × reps)` across working sets with numeric load; falls back to
 * total reps, labelled `'reps'`, when no working set has a numeric load.
 */
import type { Set } from '@/domain/set';

export interface SessionTonnage {
  value: number;
  unit: 'kg' | 'lb' | 'reps';
}

function numericLoad(
  set: Set,
): { value: number; unit: 'kg' | 'lb' } | undefined {
  if (set.load.kind === 'weight')
    return { value: set.load.value, unit: set.load.unit };
  if (
    set.load.kind === 'bodyweight' &&
    set.load.addedOrAssistedKg !== undefined
  ) {
    return { value: set.load.addedOrAssistedKg, unit: 'kg' };
  }
  return undefined;
}

function repsOf(set: Set): number {
  return set.volume?.kind === 'reps' ? set.volume.count : 0;
}

export function sessionTonnage(workingSets: Set[]): SessionTonnage {
  const numericSets = workingSets
    .map((set) => ({ set, numeric: numericLoad(set) }))
    .filter(
      (
        entry,
      ): entry is { set: Set; numeric: { value: number; unit: 'kg' | 'lb' } } =>
        entry.numeric !== undefined,
    );

  if (numericSets.length === 0) {
    const totalReps = workingSets.reduce((sum, set) => sum + repsOf(set), 0);
    return { value: totalReps, unit: 'reps' };
  }

  const unit = numericSets[0]!.numeric.unit;
  const value = numericSets.reduce(
    (sum, { set, numeric }) => sum + numeric.value * repsOf(set),
    0,
  );
  return { value, unit };
}
