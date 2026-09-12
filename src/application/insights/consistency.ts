/**
 * FR-010/011: how many of the trailing 12 ISO weeks (or the person's
 * full history, if shorter) included at least one logged Session.
 * ISO week (Monday-start) is a documented provisional default — see
 * spec.md Assumptions — pending `docs/requirements.md` FR-11's future
 * first-day-of-week setting.
 */
import type { Session } from '@/domain/session';

const MIN_HISTORY_WEEKS = 4;
const MAX_REPORTED_WEEKS = 12;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_WEEK = 7;

export interface ConsistencyResult {
  trainedWeeks: number;
  totalWeeks: number;
  periodStart: string;
  periodEnd: string;
}

/** The Monday (local date, "YYYY-MM-DD") of the ISO week containing `date`. */
function isoWeekStart(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  return result;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeConsistency(
  sessions: Session[],
  asOf: Date = new Date(),
): ConsistencyResult | undefined {
  if (sessions.length === 0) return undefined;

  const sessionDates = sessions.map((s) => new Date(s.dateTime));
  const earliestSession = new Date(
    Math.min(...sessionDates.map((d) => d.getTime())),
  );

  const weeksOfHistory =
    Math.floor(
      (asOf.getTime() - earliestSession.getTime()) /
        (MILLISECONDS_PER_DAY * DAYS_PER_WEEK),
    ) + 1;
  if (weeksOfHistory < MIN_HISTORY_WEEKS) return undefined;

  const totalWeeks = Math.min(MAX_REPORTED_WEEKS, weeksOfHistory);
  const windowStart = new Date(asOf);
  windowStart.setDate(windowStart.getDate() - totalWeeks * DAYS_PER_WEEK);

  const trainedWeekKeys = new Set<string>();
  for (const date of sessionDates) {
    if (date < windowStart || date > asOf) continue;
    trainedWeekKeys.add(dateKey(isoWeekStart(date)));
  }

  return {
    trainedWeeks: trainedWeekKeys.size,
    totalWeeks,
    periodStart: dateKey(windowStart),
    periodEnd: dateKey(asOf),
  };
}
