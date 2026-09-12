/**
 * Picks a `fixedLoadValue` for the "reps at a fixed load" progression
 * metric (spec 004 FR-016) when no user selection exists yet — the most
 * recently logged numeric load (`Weight`, or `Bodyweight` with a numeric
 * added component) for the given exercise. Shared by the progression
 * screen (spec 004) and Insights' recent-records card (spec 005), both
 * of which need the same default rather than each picking their own.
 */
import type { Session } from '@/domain/session';
import type { ExerciseId } from '@/domain/ids';

export function mostRecentNumericLoad(
  sessions: Session[],
  exerciseId: ExerciseId,
): number | undefined {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
  );
  for (const session of sorted) {
    for (const block of session.blocks) {
      for (const entry of block.exercises) {
        if (entry.exerciseId !== exerciseId) continue;
        for (const set of entry.sets) {
          if (set.load.kind === 'weight') return set.load.value;
          if (
            set.load.kind === 'bodyweight' &&
            set.load.addedOrAssistedKg !== undefined
          ) {
            return set.load.addedOrAssistedKg;
          }
        }
      }
    }
  }
  return undefined;
}
