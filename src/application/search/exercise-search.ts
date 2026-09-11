/**
 * FR-7 exercise search — a thin wrapper over `shared/fuzzy-match.ts`'s
 * existing matcher (research.md §1: reused as-is, no new library, no
 * persisted index). Re-reads `catalogue` on every call — there is nothing
 * to keep in sync (FR-011).
 */
import { matchExercise } from '@/shared/fuzzy-match';
import type { Exercise } from '@/domain/exercise';

export function searchExercises(
  query: string,
  catalogue: Exercise[],
): Exercise[] {
  return matchExercise(
    query,
    catalogue.map((exercise) => ({
      ...exercise,
      name: exercise.canonicalName,
    })),
  );
}
