import { describe, expect, it } from 'vitest';
import {
  computeExerciseTrend,
  dailyE1rmValues,
} from '@/application/insights/exercise-trend';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import type { Session } from '@/domain/session';

const EXERCISE_ID = 'ex-squat' as ExerciseId;

function weightSet(kg: number, reps = 5) {
  return createSet({
    volume: createVolume({ kind: 'reps', count: reps }),
    load: createLoad({ kind: 'weight', value: kg, unit: 'kg' }),
    setKind: 'working',
    completed: true,
  });
}

function sessionWith(
  id: string,
  dateTime: string,
  sets: ReturnType<typeof weightSet>[],
): Session {
  const entry: ExerciseEntry = { exerciseId: EXERCISE_ID, notes: '', sets };
  return createSession({
    id: id as SessionId,
    dateTime,
    notes: '',
    blocks: [createBlock({ type: 'straightSets', exercises: [entry] })],
  });
}

describe('dailyE1rmValues', () => {
  it('takes the max e1RM across two sessions on the same calendar day as one entry', () => {
    const sessions = [
      sessionWith('s1', '2026-01-01T08:00:00.000Z', [weightSet(80)]),
      sessionWith('s2', '2026-01-01T18:00:00.000Z', [weightSet(90)]),
    ];
    const daily = dailyE1rmValues(sessions, EXERCISE_ID);
    expect(daily).toHaveLength(1);
    expect(daily[0]!.sessionCount).toBe(2);
    expect(daily[0]!.value).toBeCloseTo(90 * (1 + 5 / 30), 10);
  });

  it('ignores sets from a different exercise or ineligible loads', () => {
    const otherExercise = 'ex-other' as ExerciseId;
    const entry: ExerciseEntry = {
      exerciseId: otherExercise,
      notes: '',
      sets: [weightSet(100)],
    };
    const session = createSession({
      id: 's1' as SessionId,
      dateTime: '2026-01-01T08:00:00.000Z',
      notes: '',
      blocks: [createBlock({ type: 'straightSets', exercises: [entry] })],
    });
    expect(dailyE1rmValues([session], EXERCISE_ID)).toHaveLength(0);
  });
});

describe('computeExerciseTrend', () => {
  it('returns undefined for fewer than 6 daily entries', () => {
    const daily = [
      { date: '2026-01-01', value: 100, sessionCount: 1 },
      { date: '2026-01-08', value: 105, sessionCount: 1 },
    ];
    expect(computeExerciseTrend(daily)).toBeUndefined();
  });

  it('computes the correct §5.4 percentage for a known 6-point fixture', () => {
    // first three: 100, 100, 100 (median 100); last three: 110, 110, 130 (median 110)
    const daily = [
      { date: '2026-01-01', value: 100, sessionCount: 1 },
      { date: '2026-01-08', value: 100, sessionCount: 1 },
      { date: '2026-01-15', value: 100, sessionCount: 1 },
      { date: '2026-01-22', value: 110, sessionCount: 1 },
      { date: '2026-01-29', value: 110, sessionCount: 1 },
      { date: '2026-02-05', value: 130, sessionCount: 1 },
    ];
    const result = computeExerciseTrend(daily);
    expect(result).toBeDefined();
    expect(result!.percentChange).toBe(10); // (110-100)/100*100
    expect(result!.distinctQualifyingDays).toBe(6);
    expect(result!.sessionCount).toBe(6);
    expect(result!.periodStart).toBe('2026-01-01');
    expect(result!.periodEnd).toBe('2026-02-05');
    expect(result!.daySpanWithinWindow).toBe(35);
  });
});
