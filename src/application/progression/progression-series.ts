/**
 * The progression screen's orchestrator (spec 004 FR-014/016/017/018/019/
 *020/021/022; data-model.md "Derived: Progression series"). A pure
 * function of its inputs — no hidden state, no `StoragePort` access.
 */
import type { Session } from '@/domain/session';
import type { Set } from '@/domain/set';
import type { ExerciseId, SessionId } from '@/domain/ids';
import { estimatedOneRepMax, isE1rmEligible } from './e1rm';
import { sessionTonnage } from './tonnage';
import { bestWorkingSet } from './best-working-set';

export type ProgressionMetric = 'e1rm' | 'topLoad' | 'tonnage' | 'repsAtLoad';
export type ProgressionRange = '3m' | '6m' | '12m' | 'all';

/**
 * FR-021's one-sentence explanation. Exported so `presentation/` can show
 * it whenever e1RM is unavailable for an exercise, independent of which
 * metric happens to be currently selected — the screen defaults away from
 * 'e1rm' to an available metric (FR-021's "offer the metrics that do
 * apply"), so `ProgressionSeries.metricUnavailableReason` (only populated
 * when `metric === 'e1rm'`) alone would never surface it in that case.
 */
export const E1RM_UNAVAILABLE_REASON =
  'Estimated 1RM is not shown because this exercise has no logged set with a numeric Weight or added-Bodyweight load of 1-12 reps.';

export interface ProgressionListRow {
  sessionId: SessionId;
  dateTime: string;
  bestSet: Set | undefined;
  setCount: number;
  isPersonalRecord: boolean;
}

export interface ProgressionChartPoint {
  sessionId: SessionId;
  dateTime: string;
  value: number | undefined;
  isPersonalRecord: boolean;
}

export interface ProgressionSeries {
  metric: ProgressionMetric;
  metricAvailable: boolean;
  metricUnavailableReason: string | undefined;
  availableMetrics: ProgressionMetric[];
  listRows: ProgressionListRow[];
  chartPoints: ProgressionChartPoint[];
}

function isWorkingSet(set: Set): boolean {
  return set.setKind === 'working' || set.setKind === 'toFailure';
}

function workingSetsForExercise(
  session: Session,
  exerciseId: ExerciseId,
): Set[] {
  const sets: Set[] = [];
  for (const block of session.blocks) {
    for (const entry of block.exercises) {
      if (entry.exerciseId === exerciseId) {
        sets.push(...entry.sets.filter(isWorkingSet));
      }
    }
  }
  return sets;
}

function numericLoadValue(set: Set): number | undefined {
  if (set.load.kind === 'weight') return set.load.value;
  if (
    set.load.kind === 'bodyweight' &&
    set.load.addedOrAssistedKg !== undefined
  ) {
    return set.load.addedOrAssistedKg;
  }
  return undefined;
}

function repsOf(set: Set): number {
  return set.volume?.kind === 'reps' ? set.volume.count : 0;
}

function metricValue(
  workingSets: Set[],
  metric: ProgressionMetric,
  fixedLoadValue: number | undefined,
): number | undefined {
  switch (metric) {
    case 'e1rm': {
      const eligible = workingSets.filter(isE1rmEligible);
      if (eligible.length === 0) return undefined;
      return Math.max(...eligible.map(estimatedOneRepMax));
    }
    case 'topLoad': {
      const values = workingSets
        .map(numericLoadValue)
        .filter((v): v is number => v !== undefined);
      if (values.length === 0) return undefined;
      return Math.max(...values);
    }
    case 'tonnage':
      return sessionTonnage(workingSets).value;
    case 'repsAtLoad': {
      if (fixedLoadValue === undefined) return undefined;
      const matching = workingSets.filter(
        (set) => numericLoadValue(set) === fixedLoadValue,
      );
      if (matching.length === 0) return undefined;
      return matching.reduce((sum, set) => sum + repsOf(set), 0);
    }
  }
}

function hasAnyE1rmEligibleSet(
  exerciseSessions: Session[],
  exerciseId: ExerciseId,
): boolean {
  return exerciseSessions.some((session) =>
    workingSetsForExercise(session, exerciseId).some(isE1rmEligible),
  );
}

function rangeStartMillis(range: ProgressionRange): number {
  if (range === 'all') return -Infinity;
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  return from.getTime();
}

export function buildProgressionSeries(
  exerciseSessions: Session[],
  exerciseId: ExerciseId,
  metric: ProgressionMetric,
  range: ProgressionRange,
  fixedLoadValue?: number,
): ProgressionSeries {
  const sorted = [...exerciseSessions].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
  );

  const e1rmAvailable = hasAnyE1rmEligibleSet(sorted, exerciseId);
  const availableMetrics: ProgressionMetric[] = [
    ...(e1rmAvailable ? (['e1rm'] as const) : []),
    'topLoad',
    'tonnage',
    'repsAtLoad',
  ];

  const metricAvailable = metric !== 'e1rm' || e1rmAvailable;
  const metricUnavailableReason =
    metric === 'e1rm' && !e1rmAvailable ? E1RM_UNAVAILABLE_REASON : undefined;

  const allTimeValues = sorted.map((session) => ({
    sessionId: session.id,
    value: metricValue(
      workingSetsForExercise(session, exerciseId),
      metric,
      fixedLoadValue,
    ),
  }));
  const allTimeMax = allTimeValues.reduce<number | undefined>(
    (max, entry) =>
      entry.value === undefined ? max : Math.max(max ?? -Infinity, entry.value),
    undefined,
  );
  const prSessionIds = new Set(
    allTimeMax === undefined
      ? []
      : allTimeValues
          .filter((entry) => entry.value === allTimeMax)
          .map((entry) => entry.sessionId),
  );

  const listRows: ProgressionListRow[] = sorted.map((session) => {
    const sets = workingSetsForExercise(session, exerciseId);
    return {
      sessionId: session.id,
      dateTime: session.dateTime,
      bestSet: bestWorkingSet(sets),
      setCount: sets.length,
      isPersonalRecord: prSessionIds.has(session.id),
    };
  });

  const rangeStart = rangeStartMillis(range);
  const chartPoints: ProgressionChartPoint[] = sorted
    .filter((session) => new Date(session.dateTime).getTime() >= rangeStart)
    .map((session) => ({
      sessionId: session.id,
      dateTime: session.dateTime,
      value: metricValue(
        workingSetsForExercise(session, exerciseId),
        metric,
        fixedLoadValue,
      ),
      isPersonalRecord: prSessionIds.has(session.id),
    }));

  return {
    metric,
    metricAvailable,
    metricUnavailableReason,
    availableMetrics,
    listRows,
    chartPoints,
  };
}
