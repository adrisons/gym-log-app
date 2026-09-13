/**
 * Diary search-by-exercise-name (ADR-0009, supersedes FR-6/FR-003's
 * jump-to-date). Reuses FR-7's own matcher (`shared/fuzzy-match.ts`)
 * against each session's derived exercise-name list rather than
 * introducing a second matching algorithm.
 */
import { matchExercise } from '@/shared/fuzzy-match';
import type { DiarySessionSummary } from './diary-summary';

export function filterSessionsByExerciseName(
  summaries: DiarySessionSummary[],
  query: string,
): DiarySessionSummary[] {
  const trimmed = query.trim();
  if (trimmed === '') return summaries;
  return summaries.filter(
    (summary) =>
      matchExercise(
        trimmed,
        summary.mainExerciseNames.map((name) => ({ name, aliases: [] })),
      ).length > 0,
  );
}
