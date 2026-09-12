/**
 * `docs/requirements.md` §5.4 "Exercise trend over a window" — shared by
 * the per-exercise progress card (90-day window) and the detected-
 * plateau card (8-week window), which differ only in which `sessions`
 * slice their caller passes in.
 */
import type { Session } from '@/domain/session';
import type { ExerciseId } from '@/domain/ids';
import {
  estimatedOneRepMax,
  isE1rmEligible,
} from '@/application/progression/e1rm';

const MEDIAN_GROUP_SIZE = 3;
const MIN_DISTINCT_DAYS = MEDIAN_GROUP_SIZE * 2;

export interface DailyE1rm {
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  /** Max estimatedOneRepMax among that day's eligible sets. */
  value: number;
  /** Distinct Sessions on this day contributing >=1 eligible set. */
  sessionCount: number;
}

export interface ExerciseTrendResult {
  /** §5.4, rounded to the nearest integer. */
  percentChange: number;
  distinctQualifyingDays: number;
  sessionCount: number;
  daySpanWithinWindow: number;
  periodStart: string;
  periodEnd: string;
}

function localDateKey(dateTime: string): string {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * One entry per distinct calendar day with at least one e1RM-eligible
 * working set for `exerciseId`, ascending by date. A day with more than
 * one Session (`docs/requirements.md` §3.1 allows this) takes the
 * maximum e1RM across all of that day's eligible sets, mirroring spec
 * 004's own "a session's e1RM is the maximum across its qualifying
 * working sets" rule one level up.
 */
export function dailyE1rmValues(
  sessions: Session[],
  exerciseId: ExerciseId,
): DailyE1rm[] {
  const byDate = new Map<string, { value: number; sessionIds: Set<string> }>();

  for (const session of sessions) {
    const dateKey = localDateKey(session.dateTime);
    let bestForSessionThisDay: number | undefined;

    for (const block of session.blocks) {
      for (const entry of block.exercises) {
        if (entry.exerciseId !== exerciseId) continue;
        for (const set of entry.sets) {
          if (!isE1rmEligible(set)) continue;
          const value = estimatedOneRepMax(set);
          if (
            bestForSessionThisDay === undefined ||
            value > bestForSessionThisDay
          ) {
            bestForSessionThisDay = value;
          }
        }
      }
    }

    if (bestForSessionThisDay === undefined) continue;

    const existing = byDate.get(dateKey);
    if (!existing) {
      byDate.set(dateKey, {
        value: bestForSessionThisDay,
        sessionIds: new Set([session.id]),
      });
    } else {
      existing.value = Math.max(existing.value, bestForSessionThisDay);
      existing.sessionIds.add(session.id);
    }
  }

  return [...byDate.entries()]
    .map(([date, { value, sessionIds }]) => ({
      date,
      value,
      sessionCount: sessionIds.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * `undefined` when `daily.length < 6` — insufficient to form two
 * non-overlapping groups of 3 (FR-002/FR-008's distinct-day requirement).
 */
export function computeExerciseTrend(
  daily: DailyE1rm[],
): ExerciseTrendResult | undefined {
  if (daily.length < MIN_DISTINCT_DAYS) return undefined;

  const first = daily.slice(0, MEDIAN_GROUP_SIZE).map((d) => d.value);
  const last = daily.slice(-MEDIAN_GROUP_SIZE).map((d) => d.value);
  const initialMedian = median(first);
  const finalMedian = median(last);
  const percentChange = Math.round(
    ((finalMedian - initialMedian) / initialMedian) * 100,
  );

  const periodStart = daily[0]!.date;
  const periodEnd = daily[daily.length - 1]!.date;
  const daySpanWithinWindow = Math.round(
    (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const sessionCount = daily.reduce((sum, d) => sum + d.sessionCount, 0);

  return {
    percentChange,
    distinctQualifyingDays: daily.length,
    sessionCount,
    daySpanWithinWindow,
    periodStart,
    periodEnd,
  };
}
