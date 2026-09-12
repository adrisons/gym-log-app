import { describe, expect, it } from 'vitest';
import { buildAggregateProgressCards } from '@/application/insights/aggregate-progress';
import type { PerExerciseProgressCard } from '@/application/insights/per-exercise-progress';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';

function exercise(
  id: string,
  canonicalName: string,
  movementPattern?: string,
  muscleGroups?: string[],
): Exercise {
  return {
    id: id as ExerciseId,
    canonicalName,
    aliases: [],
    ...(movementPattern !== undefined && { movementPattern }),
    ...(muscleGroups !== undefined && { muscleGroups }),
    defaultLoadType: 'weight',
    unilateral: false,
    discipline: 'Strength',
  };
}

function card(
  exerciseId: string,
  exerciseName: string,
  percentChange: number,
  sessionCount: number,
): PerExerciseProgressCard {
  return {
    exerciseId: exerciseId as ExerciseId,
    exerciseName,
    trend: {
      percentChange,
      distinctQualifyingDays: 6,
      sessionCount,
      daySpanWithinWindow: 30,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    },
  };
}

describe('buildAggregateProgressCards', () => {
  it('aggregates two exercises sharing a movementPattern, case/accent-insensitively', () => {
    const squat = exercise('ex-squat', 'Squat', 'Legs');
    const deadlift = exercise('ex-deadlift', 'Deadlift', 'legs');
    const cards = [
      card('ex-squat', 'Squat', 10, 6),
      card('ex-deadlift', 'Deadlift', 20, 4),
    ];

    const aggregates = buildAggregateProgressCards(cards, [squat, deadlift]);
    const legsAggregate = aggregates.find(
      (a) => a.groupKind === 'movementPattern',
    );
    expect(legsAggregate).toBeDefined();
    expect(legsAggregate!.contributingExercises).toHaveLength(2);
    // weighted mean: (10*6 + 20*4) / (6+4) = 140/10 = 14
    expect(legsAggregate!.weightedPercentChange).toBe(14);
  });

  it('produces no aggregate for a group with only one qualifying exercise', () => {
    const squat = exercise('ex-squat', 'Squat', 'Legs');
    const cards = [card('ex-squat', 'Squat', 10, 6)];
    expect(buildAggregateProgressCards(cards, [squat])).toHaveLength(0);
  });

  it('lets an exercise with two muscleGroups contribute to both, plus its own movementPattern group', () => {
    const squat = exercise('ex-squat', 'Squat', 'Legs', ['quads', 'glutes']);
    const legPress = exercise('ex-leg-press', 'Leg Press', 'Legs', ['quads']);
    const hipThrust = exercise('ex-hip-thrust', 'Hip Thrust', undefined, [
      'glutes',
    ]);
    const cards = [
      card('ex-squat', 'Squat', 10, 6),
      card('ex-leg-press', 'Leg Press', 5, 6),
      card('ex-hip-thrust', 'Hip Thrust', 15, 6),
    ];

    const aggregates = buildAggregateProgressCards(cards, [
      squat,
      legPress,
      hipThrust,
    ]);
    const quadsGroup = aggregates.find(
      (a) =>
        a.groupKind === 'muscleGroup' && a.groupName.toLowerCase() === 'quads',
    );
    const glutesGroup = aggregates.find(
      (a) =>
        a.groupKind === 'muscleGroup' && a.groupName.toLowerCase() === 'glutes',
    );
    const legsGroup = aggregates.find((a) => a.groupKind === 'movementPattern');

    expect(quadsGroup?.contributingExercises).toHaveLength(2);
    expect(glutesGroup?.contributingExercises).toHaveLength(2);
    expect(legsGroup?.contributingExercises).toHaveLength(2);
  });
});
