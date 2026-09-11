/**
 * `DateRange` helpers for `StoragePort.listSessions`, whose `range` param
 * is mandatory — there is no unbounded "list all" overload
 * (`storage-port.ts`). research.md §4: a fixed, generously-early constant
 * is simpler and more obviously correct than deriving "the earliest
 * possible session date" from data not yet read.
 */

import type { DateRange } from '@/application/ports/storage-port';

/** Earlier than any plausible session date; not a schema/data constraint. */
const EPOCH_FLOOR = '2000-01-01T00:00:00.000Z';

/**
 * A range covering every session ever stored (spec 004 FR-001's "every
 * Session", FR-019's "all time" chart range).
 */
export function allStoredDataRange(): DateRange {
  return { from: EPOCH_FLOOR, to: new Date().toISOString() };
}

/**
 * A range spanning `months` calendar months back from now (spec 004
 * FR-019's 3/6/12-month chart range options).
 */
export function lastMonthsRange(months: 3 | 6 | 12): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - months);
  return { from: from.toISOString(), to: to.toISOString() };
}
