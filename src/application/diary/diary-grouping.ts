/**
 * Diary month-grouping (spec 004 FR-001, data-model.md "Derived: Diary
 * grouping"). Groups by each session's local calendar date — consistent
 * with how the logging screen already displays a session's date (spec 001
 * research.md).
 */
import type { DiarySessionSummary } from './diary-summary';

export interface DiaryMonthGroup {
  monthKey: string;
  sessions: DiarySessionSummary[];
}

function monthKeyOf(dateTime: string): string {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Groups `summaries` by calendar month, most-recent month first, sessions
 * reverse-chronological within each group.
 */
export function groupSessionsByMonth(
  summaries: DiarySessionSummary[],
): DiaryMonthGroup[] {
  const sorted = [...summaries].sort(
    (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(),
  );

  const groups = new Map<string, DiarySessionSummary[]>();
  for (const summary of sorted) {
    const key = monthKeyOf(summary.dateTime);
    const existing = groups.get(key);
    if (existing) {
      existing.push(summary);
    } else {
      groups.set(key, [summary]);
    }
  }

  return [...groups.entries()].map(([monthKey, sessions]) => ({
    monthKey,
    sessions,
  }));
}
