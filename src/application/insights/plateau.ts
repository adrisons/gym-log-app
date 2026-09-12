/**
 * FR-008/009: detected-plateau card, `docs/requirements.md` §5.7's
 * "Plateau" row (>=6 distinct qualifying days within the trailing 8-week
 * window, absolute percentage change under 2% — no separate day-span
 * minimum, unlike the Exercise trend row).
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';
import { computeExerciseTrend, dailyE1rmValues } from './exercise-trend';
import type { ExerciseTrendResult } from './exercise-trend';

const PLATEAU_MAX_ABS_PERCENT_CHANGE = 2;

export interface PlateauCard {
  exerciseId: ExerciseId;
  exerciseName: string;
  trend: ExerciseTrendResult;
}

export function buildPlateauCards(
  sessions: Session[],
  exercises: Exercise[],
): PlateauCard[] {
  const cards: PlateauCard[] = [];

  for (const exercise of exercises) {
    const daily = dailyE1rmValues(sessions, exercise.id);
    const trend = computeExerciseTrend(daily);
    if (!trend) continue;
    if (Math.abs(trend.percentChange) >= PLATEAU_MAX_ABS_PERCENT_CHANGE)
      continue;

    cards.push({
      exerciseId: exercise.id,
      exerciseName: exercise.canonicalName,
      trend,
    });
  }

  return cards;
}
