/**
 * FR-010/011: how many of the trailing 12 weeks (or the person's full
 * history, if shorter) included at least one logged Session. Week
 * boundaries follow the `firstDayOfWeek` setting (`specs/006-settings-data`
 * FR-018) — spec 005's own Monday-start (ISO) default was a documented
 * provisional value pending that setting, which this parameter now closes.
 */
import type { Session } from '@/domain/session';

type FirstDayOfWeek = 'monday' | 'sunday';

const FIRST_DAY_INDEX: Record<FirstDayOfWeek, number> = {
  sunday: 0,
  monday: 1,
};

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

/** The first day (local date) of the week containing `date`, per `firstDayOfWeek`. */
function weekStart(date: Date, firstDayOfWeek: FirstDayOfWeek): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ...
  const startIndex = FIRST_DAY_INDEX[firstDayOfWeek];
  const diff = (day - startIndex + 7) % 7;
  result.setDate(result.getDate() - diff);
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
  firstDayOfWeek: FirstDayOfWeek = 'monday',
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
    trainedWeekKeys.add(dateKey(weekStart(date, firstDayOfWeek)));
  }

  return {
    trainedWeeks: trainedWeekKeys.size,
    totalWeeks,
    periodStart: dateKey(windowStart),
    periodEnd: dateKey(asOf),
  };
}
