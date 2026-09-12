import { describe, expect, it } from 'vitest';
import { mostRecentNumericLoad } from '@/application/progression/most-recent-load';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';

const EXERCISE_ID = 'ex-1' as ExerciseId;

function sessionWithWeight(id: string, dateTime: string, kg: number) {
  const entry: ExerciseEntry = {
    exerciseId: EXERCISE_ID,
    notes: '',
    sets: [
      createSet({
        volume: createVolume({ kind: 'reps', count: 5 }),
        load: createLoad({ kind: 'weight', value: kg, unit: 'kg' }),
        setKind: 'working',
        completed: true,
      }),
    ],
  };
  return createSession({
    id: id as SessionId,
    dateTime,
    notes: '',
    blocks: [createBlock({ type: 'straightSets', exercises: [entry] })],
  });
}

describe('mostRecentNumericLoad', () => {
  it('returns the numeric load from the most recent session', () => {
    const sessions = [
      sessionWithWeight('s1', '2026-01-01T10:00:00.000Z', 80),
      sessionWithWeight('s2', '2026-02-01T10:00:00.000Z', 90),
    ];
    expect(mostRecentNumericLoad(sessions, EXERCISE_ID)).toBe(90);
  });

  it('returns undefined when no session has a numeric load for the exercise', () => {
    expect(mostRecentNumericLoad([], EXERCISE_ID)).toBeUndefined();
  });
});
