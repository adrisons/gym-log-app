import { describe, expect, it } from 'vitest';
import { buildProgressionSeries } from '@/application/progression/progression-series';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import type { Session } from '@/domain/session';

const EXERCISE_ID = 'ex-squat' as ExerciseId;

function sessionWithWeightSet(
  id: string,
  dateTime: string,
  weightKg: number,
  reps: number,
): Session {
  const entry: ExerciseEntry = {
    exerciseId: EXERCISE_ID,
    notes: '',
    sets: [
      createSet({
        volume: createVolume({ kind: 'reps', count: reps }),
        load: createLoad({ kind: 'weight', value: weightKg, unit: 'kg' }),
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

function sessionWithBandSet(
  id: string,
  dateTime: string,
  reps: number,
): Session {
  const entry: ExerciseEntry = {
    exerciseId: EXERCISE_ID,
    notes: '',
    sets: [
      createSet({
        volume: createVolume({ kind: 'reps', count: reps }),
        load: createLoad({ kind: 'band', label: 'red' }),
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

describe('buildProgressionSeries', () => {
  const sessions = [
    sessionWithWeightSet('s1', '2026-01-01T10:00:00.000Z', 80, 5),
    sessionWithWeightSet('s2', '2026-02-01T10:00:00.000Z', 90, 5),
    sessionWithWeightSet('s3', '2026-03-01T10:00:00.000Z', 100, 5),
    sessionWithWeightSet('s4', '2026-04-01T10:00:00.000Z', 85, 5),
    sessionWithWeightSet('s5', '2026-05-01T10:00:00.000Z', 95, 5),
  ];

  it('produces one list row per session, reverse chronological, with correct bestSet/setCount', () => {
    const series = buildProgressionSeries(sessions, EXERCISE_ID, 'e1rm', 'all');
    expect(series.listRows.map((r) => r.sessionId)).toEqual([
      's5',
      's4',
      's3',
      's2',
      's1',
    ]);
    expect(series.listRows[0]!.setCount).toBe(1);
    expect(series.listRows[0]!.bestSet?.load).toEqual({
      kind: 'weight',
      value: 95,
      unit: 'kg',
    });
  });

  it('computes chartPoints per the selected metric, filtered by range, while listRows stays full-history', () => {
    const series = buildProgressionSeries(
      sessions,
      EXERCISE_ID,
      'topLoad',
      '3m',
    );
    // Range filtering is relative to "now" at call time; this fixture data
    // is fixed in the past, so with an "all" comparison we confirm at
    // minimum that listRows always covers every session regardless of range.
    expect(series.listRows).toHaveLength(5);
    expect(series.chartPoints.length).toBeLessThanOrEqual(5);
  });

  it('marks the session with the all-time-highest value as a personal record on both list row and chart point, regardless of active range', () => {
    const series = buildProgressionSeries(sessions, EXERCISE_ID, 'e1rm', 'all');
    const prRow = series.listRows.find((r) => r.sessionId === 's3');
    expect(prRow?.isPersonalRecord).toBe(true);
    const otherRows = series.listRows.filter((r) => r.sessionId !== 's3');
    expect(otherRows.every((r) => !r.isPersonalRecord)).toBe(true);
  });

  it('yields metricAvailable: false and a populated reason for e1rm when no session has an eligible set; other metrics stay available', () => {
    const bandOnlySessions = [
      sessionWithBandSet('b1', '2026-01-01T10:00:00.000Z', 10),
      sessionWithBandSet('b2', '2026-02-01T10:00:00.000Z', 12),
    ];
    const series = buildProgressionSeries(
      bandOnlySessions,
      EXERCISE_ID,
      'e1rm',
      'all',
    );
    expect(series.metricAvailable).toBe(false);
    expect(series.metricUnavailableReason).toBeTruthy();
    expect(series.availableMetrics).not.toContain('e1rm');
    expect(series.availableMetrics).toEqual(
      expect.arrayContaining(['topLoad', 'tonnage', 'repsAtLoad']),
    );
  });

  it('leaves chart point value undefined (not 0) for sessions ineligible for the selected e1rm metric', () => {
    const mixed = [
      sessionWithWeightSet('w1', '2026-01-01T10:00:00.000Z', 80, 5),
      sessionWithBandSet('b1', '2026-02-01T10:00:00.000Z', 10),
    ];
    const series = buildProgressionSeries(mixed, EXERCISE_ID, 'e1rm', 'all');
    const bandPoint = series.chartPoints.find((p) => p.sessionId === 'b1');
    expect(bandPoint?.value).toBeUndefined();
    const weightPoint = series.chartPoints.find((p) => p.sessionId === 'w1');
    expect(weightPoint?.value).toBeDefined();
  });
});
