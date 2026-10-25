/**
 * FR-006a/FR-009a: the quick-option cutoff date arithmetic and the
 * start-of-day normalization every cutoff (quick option or explicit date)
 * resolves to before `StoragePort.deleteSessionsBefore` is called.
 *
 * `Date.prototype.setMonth`/`setFullYear` do not clamp on overflow — they
 * roll into the *next* month (e.g. Aug 31 minus 6 months lands on Mar 3,
 * not Feb 28) — the opposite of FR-006a's "clamp to the last valid day"
 * rule, so this computes the target month's length directly instead
 * (research.md §3). No date library (`docs/stack.md`'s "platform `Date`
 * is expected to suffice" for this kind of arithmetic).
 */

/** The last valid day-of-month for `year`/`monthIndex` (0-based, like
 * `Date.getMonth()`) — `new Date(year, monthIndex + 1, 0)` is the
 * standard zero-dependency idiom for "the last day of this month." */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * `from`, minus `months` calendar months, clamped (not overflowed) to the
 * target month's last valid day, with the time zeroed to local
 * start-of-day (FR-009a — every cutoff is a calendar day, never a
 * timestamp).
 */
export function cutoffMonthsAgo(from: Date, months: number): Date {
  const totalMonthIndex = from.getFullYear() * 12 + from.getMonth() - months;
  const targetYear = Math.floor(totalMonthIndex / 12);
  const targetMonthIndex = ((totalMonthIndex % 12) + 12) % 12;
  const day = Math.min(
    from.getDate(),
    lastDayOfMonth(targetYear, targetMonthIndex),
  );
  return new Date(targetYear, targetMonthIndex, day, 0, 0, 0, 0);
}

/** Zeroes `date`'s time to local start-of-day (FR-009a), without mutating
 * the input. */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
