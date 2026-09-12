import { describe, expect, it } from 'vitest';
import { buildPlateauCards } from '@/application/insights/plateau';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import type { Session } from '@/domain/session';

function exercise(id: string, canonicalName: string): Exercise {
  return {
    id: id as ExerciseId,
    canonicalName,
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  };
}

function weightSession(
  id: string,
  dateTime: string,
  exerciseId: ExerciseId,
  kg: number,
): Session {
  const entry: ExerciseEntry = {
    exerciseId,
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

describe('buildPlateauCards', () => {
  it('produces a card when 6 distinct days in 8 weeks show <2% absolute change', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 100),
      weightSession('s2', '2026-01-08T10:00:00.000Z', squat.id, 100.5),
      weightSession('s3', '2026-01-15T10:00:00.000Z', squat.id, 100),
      weightSession('s4', '2026-01-22T10:00:00.000Z', squat.id, 100.5),
      weightSession('s5', '2026-01-29T10:00:00.000Z', squat.id, 101),
      weightSession('s6', '2026-02-05T10:00:00.000Z', squat.id, 100.5),
    ];
    const cards = buildPlateauCards(sessions, [squat]);
    expect(cards).toHaveLength(1);
    expect(Math.abs(cards[0]!.trend.percentChange)).toBeLessThan(2);
  });

  it('produces no card when the change is 2% or more', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 100),
      weightSession('s2', '2026-01-08T10:00:00.000Z', squat.id, 105),
      weightSession('s3', '2026-01-15T10:00:00.000Z', squat.id, 110),
      weightSession('s4', '2026-01-22T10:00:00.000Z', squat.id, 115),
      weightSession('s5', '2026-01-29T10:00:00.000Z', squat.id, 120),
      weightSession('s6', '2026-02-05T10:00:00.000Z', squat.id, 125),
    ];
    expect(buildPlateauCards(sessions, [squat])).toHaveLength(0);
  });

  it('produces no card for fewer than 6 distinct qualifying days', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 100),
      weightSession('s2', '2026-01-08T10:00:00.000Z', squat.id, 100),
    ];
    expect(buildPlateauCards(sessions, [squat])).toHaveLength(0);
  });
});
