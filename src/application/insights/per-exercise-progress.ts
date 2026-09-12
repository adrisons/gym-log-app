/**
 * FR-002/003: per-exercise progress card, `docs/requirements.md` §5.7's
 * "Exercise trend" row (>=6 distinct qualifying days AND >=21-day span
 * within the trailing 90-day window).
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';
import { computeExerciseTrend, dailyE1rmValues } from './exercise-trend';
import type { ExerciseTrendResult } from './exercise-trend';

const MIN_DAY_SPAN = 21;

export interface PerExerciseProgressCard {
  exerciseId: ExerciseId;
  exerciseName: string;
  trend: ExerciseTrendResult;
}

export function buildPerExerciseProgressCards(
  sessions: Session[],
  exercises: Exercise[],
): PerExerciseProgressCard[] {
  const cards: PerExerciseProgressCard[] = [];

  for (const exercise of exercises) {
    const daily = dailyE1rmValues(sessions, exercise.id);
    const trend = computeExerciseTrend(daily);
    if (!trend) continue;
    if (trend.daySpanWithinWindow < MIN_DAY_SPAN) continue;

    cards.push({
      exerciseId: exercise.id,
      exerciseName: exercise.canonicalName,
      trend,
    });
  }

  return cards;
}
