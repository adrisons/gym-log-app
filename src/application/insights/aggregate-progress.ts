/**
 * FR-004/005: aggregate progress by movement pattern or muscle group,
 * `docs/requirements.md` §5.5 — the session-count-weighted mean of the
 * per-exercise percentage changes (`per-exercise-progress.ts`) for
 * exercises sharing a group, shown only with >=2 contributing exercises.
 */
import { normalize } from '@/shared/fuzzy-match';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';
import type { PerExerciseProgressCard } from './per-exercise-progress';

const MIN_CONTRIBUTING_EXERCISES = 2;

export type GroupKind = 'movementPattern' | 'muscleGroup';

export interface AggregateProgressCard {
  groupKind: GroupKind;
  groupName: string;
  weightedPercentChange: number;
  periodStart: string;
  periodEnd: string;
  contributingExercises: PerExerciseProgressCard[];
}

interface GroupBucket {
  groupKind: GroupKind;
  displayName: string;
  cards: PerExerciseProgressCard[];
}

export function buildAggregateProgressCards(
  perExerciseCards: PerExerciseProgressCard[],
  exercises: Exercise[],
): AggregateProgressCard[] {
  const exercisesById = new Map<ExerciseId, Exercise>(
    exercises.map((exercise) => [exercise.id, exercise]),
  );
  const buckets = new Map<string, GroupBucket>();

  const addToGroup = (
    groupKind: GroupKind,
    rawName: string,
    card: PerExerciseProgressCard,
  ): void => {
    const key = `${groupKind}:${normalize(rawName)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.cards.push(card);
    } else {
      buckets.set(key, { groupKind, displayName: rawName, cards: [card] });
    }
  };

  for (const card of perExerciseCards) {
    const exercise = exercisesById.get(card.exerciseId);
    if (!exercise) continue;

    if (exercise.movementPattern) {
      addToGroup('movementPattern', exercise.movementPattern, card);
    }
    for (const muscleGroup of exercise.muscleGroups ?? []) {
      addToGroup('muscleGroup', muscleGroup, card);
    }
  }

  const result: AggregateProgressCard[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.cards.length < MIN_CONTRIBUTING_EXERCISES) continue;

    const totalWeight = bucket.cards.reduce(
      (sum, card) => sum + card.trend.sessionCount,
      0,
    );
    const weightedPercentChange =
      bucket.cards.reduce(
        (sum, card) => sum + card.trend.percentChange * card.trend.sessionCount,
        0,
      ) / totalWeight;

    const periodStart = bucket.cards.map((c) => c.trend.periodStart).sort()[0]!;
    const periodEnd = bucket.cards
      .map((c) => c.trend.periodEnd)
      .sort()
      .at(-1)!;

    result.push({
      groupKind: bucket.groupKind,
      groupName: bucket.displayName,
      weightedPercentChange,
      periodStart,
      periodEnd,
      contributingExercises: bucket.cards,
    });
  }

  return result;
}
