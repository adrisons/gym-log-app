/**
 * FR-006/007: recent records — every (Exercise, metric) pair whose
 * current all-time-best value (spec 004 FR-020's exact personal-record
 * definition, ties included) was achieved within the trailing 30 days.
 * Reuses spec 004's `buildProgressionSeries` unchanged.
 */
import { buildProgressionSeries } from '@/application/progression/progression-series';
import type { ProgressionMetric } from '@/application/progression/progression-series';
import { mostRecentNumericLoad } from '@/application/progression/most-recent-load';
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';

const RECENCY_WINDOW_DAYS = 30;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export interface RecentRecordEntry {
  exerciseId: ExerciseId;
  exerciseName: string;
  metric: ProgressionMetric;
  value: number;
  dateAchieved: string;
  sessionId: SessionId;
}

function isWithinRecencyWindow(dateTime: string, asOf: Date): boolean {
  const days =
    (asOf.getTime() - new Date(dateTime).getTime()) / MILLISECONDS_PER_DAY;
  return days >= 0 && days <= RECENCY_WINDOW_DAYS;
}

export function buildRecentRecords(
  exercisesWithAllSessions: { exercise: Exercise; sessions: Session[] }[],
  asOf: Date = new Date(),
): RecentRecordEntry[] {
  const entries: RecentRecordEntry[] = [];

  for (const { exercise, sessions } of exercisesWithAllSessions) {
    if (sessions.length === 0) continue;

    const fixedLoadValue = mostRecentNumericLoad(sessions, exercise.id);
    // Determine availableMetrics once (independent of the metric/range
    // arguments passed in — progression-series.ts computes it purely
    // from e1RM eligibility across the given sessions).
    const probe = buildProgressionSeries(
      sessions,
      exercise.id,
      'topLoad',
      'all',
    );

    for (const metric of probe.availableMetrics) {
      const series = buildProgressionSeries(
        sessions,
        exercise.id,
        metric,
        'all',
        fixedLoadValue,
      );
      const recordRows = series.listRows.filter(
        (row) =>
          row.isPersonalRecord && isWithinRecencyWindow(row.dateTime, asOf),
      );
      if (recordRows.length === 0) continue;

      // FR-007: consolidate multiple in-window ties to the most recent.
      const mostRecent = recordRows.reduce((best, row) =>
        new Date(row.dateTime) > new Date(best.dateTime) ? row : best,
      );
      const point = series.chartPoints.find(
        (p) => p.sessionId === mostRecent.sessionId,
      );
      if (point?.value === undefined) continue;

      entries.push({
        exerciseId: exercise.id,
        exerciseName: exercise.canonicalName,
        metric,
        value: point.value,
        dateAchieved: mostRecent.dateTime,
        sessionId: mostRecent.sessionId,
      });
    }
  }

  return entries;
}
