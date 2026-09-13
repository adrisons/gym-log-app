/**
 * Per-session diary summary (spec 004 FR-002, data-model.md "Derived:
 * Diary summary"). Never stored — recomputed from the current state of
 * the session and the catalogue on every read, so a later rename/merge or
 * `movementPattern` edit changes past sessions' displayed summary on next
 * read (spec.md Edge Cases).
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';

export interface DiarySessionSummary {
  sessionId: SessionId;
  dateTime: string;
  mainExerciseNames: string[];
  kindOfWork: string | undefined;
}

export function buildDiarySessionSummary(
  session: Session,
  exercisesById: Map<ExerciseId, Exercise>,
): DiarySessionSummary {
  const seenExerciseIds = new Set<ExerciseId>();
  const mainExerciseNames: string[] = [];
  const movementPatterns = new Set<string>();

  for (const block of session.blocks) {
    for (const entry of block.exercises) {
      if (!seenExerciseIds.has(entry.exerciseId)) {
        seenExerciseIds.add(entry.exerciseId);
        const exercise = exercisesById.get(entry.exerciseId);
        if (exercise) {
          mainExerciseNames.push(exercise.canonicalName);
          if (exercise.movementPattern) {
            movementPatterns.add(exercise.movementPattern);
          }
        }
      }
    }
  }

  return {
    sessionId: session.id,
    dateTime: session.dateTime,
    mainExerciseNames,
    kindOfWork:
      movementPatterns.size > 0 ? [...movementPatterns].join(', ') : undefined,
  };
}
