import { describe, expect, it } from 'vitest';
import { buildDiarySessionSummary } from '@/application/diary/diary-summary';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';

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

function workingSet(): ReturnType<typeof createSet> {
  return createSet({
    volume: createVolume({ kind: 'reps', count: 8 }),
    load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
    setKind: 'working',
    completed: true,
  });
}

describe('buildDiarySessionSummary', () => {
  it('sums every set across blocks/entries (including a warm-up) and lists distinct exercises in first-referenced order', () => {
    const squat = exercise('ex-squat', 'Squat', 'squat');
    const bench = exercise('ex-bench', 'Bench Press', 'push');
    const catalogue = new Map([
      [squat.id, squat],
      [bench.id, bench],
    ]);

    const squatEntry: ExerciseEntry = {
      exerciseId: squat.id,
      notes: '',
      sets: [
        createSet({
          volume: createVolume({ kind: 'reps', count: 5 }),
          load: createLoad({ kind: 'weight', value: 40, unit: 'kg' }),
          setKind: 'warmUp',
          completed: true,
        }),
        workingSet(),
        workingSet(),
      ],
    };
    const benchEntry: ExerciseEntry = {
      exerciseId: bench.id,
      notes: '',
      sets: [workingSet(), workingSet()],
    };

    const session = createSession({
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-11T10:00:00.000Z',
      blocks: [
        createBlock({ type: 'straightSets', exercises: [squatEntry] }),
        createBlock({ type: 'straightSets', exercises: [benchEntry] }),
      ],
      notes: '',
    });

    const summary = buildDiarySessionSummary(session, catalogue);

    expect(summary.setCount).toBe(5);
    expect(summary.mainExerciseNames).toEqual(['Squat', 'Bench Press']);
    expect(summary.kindOfWork).toBe('squat, push');
  });

  it('yields kindOfWork: undefined when no referenced exercise has a movementPattern', () => {
    const deadlift = exercise('ex-deadlift', 'Deadlift');
    const catalogue = new Map([[deadlift.id, deadlift]]);
    const entry: ExerciseEntry = {
      exerciseId: deadlift.id,
      notes: '',
      sets: [workingSet()],
    };
    const session = createSession({
      id: 'sess-2' as SessionId,
      dateTime: '2026-09-11T10:00:00.000Z',
      blocks: [createBlock({ type: 'straightSets', exercises: [entry] })],
      notes: '',
    });

    const summary = buildDiarySessionSummary(session, catalogue);

    expect(summary.kindOfWork).toBeUndefined();
  });
});
