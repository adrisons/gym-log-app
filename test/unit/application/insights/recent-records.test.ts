import { describe, expect, it } from 'vitest';
import { buildRecentRecords } from '@/application/insights/recent-records';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import type { Session } from '@/domain/session';

const NOW = new Date('2026-06-01T00:00:00.000Z');

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
  reps: number,
): Session {
  const entry: ExerciseEntry = {
    exerciseId,
    notes: '',
    sets: [
      createSet({
        volume: createVolume({ kind: 'reps', count: reps }),
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

describe('buildRecentRecords', () => {
  it('produces an entry for a session within 30 days that ties/beats the all-time-best e1RM', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 80),
      weightSession('s2', '2026-05-25T10:00:00.000Z', squat.id, 100),
    ];
    const entries = buildRecentRecords([{ exercise: squat, sessions }], NOW);
    const e1rmEntry = entries.find((e) => e.metric === 'e1rm');
    expect(e1rmEntry).toBeDefined();
    expect(e1rmEntry!.sessionId).toBe('s2');
  });

  it('produces no entry when the all-time-best was set more than 30 days ago with nothing since', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-01-01T10:00:00.000Z', squat.id, 100),
      weightSession('s2', '2026-01-15T10:00:00.000Z', squat.id, 90),
    ];
    const entries = buildRecentRecords([{ exercise: squat, sessions }], NOW);
    expect(entries.find((e) => e.metric === 'e1rm')).toBeUndefined();
  });

  it('consolidates two in-window ties for the same (exercise, metric) pair to the most recent', () => {
    const squat = exercise('ex-squat', 'Squat');
    const sessions = [
      weightSession('s1', '2026-05-10T10:00:00.000Z', squat.id, 100),
      weightSession('s2', '2026-05-20T10:00:00.000Z', squat.id, 100),
    ];
    const entries = buildRecentRecords([{ exercise: squat, sessions }], NOW);
    const e1rmEntries = entries.filter((e) => e.metric === 'e1rm');
    expect(e1rmEntries).toHaveLength(1);
    expect(e1rmEntries[0]!.sessionId).toBe('s2');
  });

  it('never produces an e1rm entry for a FreeText-only exercise', () => {
    const freeTextEx = exercise('ex-freetext', 'Band Row', 'freeText');
    const sessions = [
      freeTextSession('s1', '2026-05-25T10:00:00.000Z', freeTextEx.id, 15),
    ];
    const entries = buildRecentRecords(
      [{ exercise: freeTextEx, sessions }],
      NOW,
    );
    expect(entries.find((e) => e.metric === 'e1rm')).toBeUndefined();
  });
});
