import { describe, expect, it } from 'vitest';
import { buildPerExerciseProgressCards } from '@/application/insights/per-exercise-progress';
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
  defaultLoadType: Exercise['defaultLoadType'] = 'weight',
): Exercise {
  return {
    id: id as ExerciseId,
    canonicalName,
    aliases: [],
    defaultLoadType,
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

function freeTextSession(
  id: string,
  dateTime: string,
  exerciseId: ExerciseId,
): Session {
  const entry: ExerciseEntry = {
    exerciseId,
    notes: '',
    sets: [
      createSet({
        volume: createVolume({ kind: 'reps', count: 10 }),
        load: createLoad({ kind: 'freeText', text: 'red band' }),
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

describe('buildPerExerciseProgressCards', () => {
  it('produces a card for an exercise with 6 distinct days spanning >=21 days', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 80),
      weightSession('s2', '2026-01-08T10:00:00.000Z', squat.id, 85),
      weightSession('s3', '2026-01-15T10:00:00.000Z', squat.id, 90),
      weightSession('s4', '2026-01-22T10:00:00.000Z', squat.id, 92),
      weightSession('s5', '2026-01-29T10:00:00.000Z', squat.id, 95),
      weightSession('s6', '2026-02-05T10:00:00.000Z', squat.id, 100),
    ];
    const cards = buildPerExerciseProgressCards(sessions, [squat]);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.exerciseName).toBe('Squat');
  });

  it('produces no card for an exercise logged only 3 times', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 80),
      weightSession('s2', '2026-01-08T10:00:00.000Z', squat.id, 85),
      weightSession('s3', '2026-01-15T10:00:00.000Z', squat.id, 90),
    ];
    expect(buildPerExerciseProgressCards(sessions, [squat])).toHaveLength(0);
  });

  it('produces no card when the 6-day span is under 21 days', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 80),
      weightSession('s2', '2026-01-02T10:00:00.000Z', squat.id, 82),
      weightSession('s3', '2026-01-03T10:00:00.000Z', squat.id, 84),
      weightSession('s4', '2026-01-04T10:00:00.000Z', squat.id, 86),
      weightSession('s5', '2026-01-05T10:00:00.000Z', squat.id, 88),
      weightSession('s6', '2026-01-06T10:00:00.000Z', squat.id, 90),
    ];
    expect(buildPerExerciseProgressCards(sessions, [squat])).toHaveLength(0);
  });

  it('produces no card for a FreeText-only exercise (no e1RM-eligible sets)', () => {
    const freeTextExercise = exercise(
      'ex-freetext',
      'Band pull-apart',
      'freeText',
    );
    const sessions = Array.from({ length: 6 }, (_, i) =>
      freeTextSession(
        `s${i}`,
        `2026-0${1 + Math.floor(i / 4)}-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        freeTextExercise.id,
      ),
    );
    expect(
      buildPerExerciseProgressCards(sessions, [freeTextExercise]),
    ).toHaveLength(0);
  });
});
