import { describe, expect, it } from 'vitest';
import { computePushPullBalance } from '@/application/insights/push-pull-balance';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import type { Session } from '@/domain/session';

function exercise(
  id: string,
  canonicalName: string,
  movementPattern?: string,
): Exercise {
  return {
    id: id as ExerciseId,
    canonicalName,
    aliases: [],
    ...(movementPattern !== undefined && { movementPattern }),
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  };
}

function workingSet() {
  return createSet({
    volume: createVolume({ kind: 'reps', count: 5 }),
    load: createLoad({ kind: 'weight', value: 50, unit: 'kg' }),
    setKind: 'working',
    completed: true,
  });
}

function sessionWith(
  id: string,
  exerciseId: ExerciseId,
  setCount: number,
): Session {
  const entry: ExerciseEntry = {
    exerciseId,
    notes: '',
    sets: Array.from({ length: setCount }, () => workingSet()),
  };
  return createSession({
    id: id as SessionId,
    dateTime: '2026-05-01T10:00:00.000Z',
    notes: '',
    blocks: [createBlock({ type: 'straightSets', exercises: [entry] })],
  });
}

describe('computePushPullBalance', () => {
  it('reports the correct split for 20+ classified sets', () => {
    const bench = exercise('ex-bench', 'Bench Press', 'push');
    const row = exercise('ex-row', 'Barbell Row', 'pull');
    const sessions = [
      sessionWith('s1', bench.id, 12),
      sessionWith('s2', row.id, 10),
    ];

    const result = computePushPullBalance(sessions, [bench, row]);
    expect(result).toEqual(
      expect.objectContaining({ pushCount: 12, pullCount: 10 }),
    );
  });

  it('returns undefined for fewer than 20 classified sets', () => {
    const bench = exercise('ex-bench', 'Bench Press', 'push');
    const sessions = [sessionWith('s1', bench.id, 5)];
    expect(computePushPullBalance(sessions, [bench])).toBeUndefined();
  });

  it('excludes sets whose exercise has no or an unrecognized movementPattern from both counts and the threshold', () => {
    const bench = exercise('ex-bench', 'Bench Press', 'push');
    const squat = exercise('ex-squat', 'Squat', 'squat'); // neither push nor pull
    const sessions = [
      sessionWith('s1', bench.id, 15),
      sessionWith('s2', squat.id, 20),
    ];

    // Only bench's 15 push sets are classified; squat's 20 are excluded,
    // so total classified (15) is still under the 20-set threshold.
    expect(computePushPullBalance(sessions, [bench, squat])).toBeUndefined();
  });
});
