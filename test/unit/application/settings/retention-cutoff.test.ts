import { describe, expect, it } from 'vitest';
import {
  cutoffMonthsAgo,
  startOfDay,
} from '@/application/settings/retention-cutoff';

describe('cutoffMonthsAgo (FR-006a, research.md §3)', () => {
  it('subtracts whole months with no overflow when every day exists', () => {
    const result = cutoffMonthsAgo(new Date(2026, 5, 15), 3); // 15 Jun 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(15);
  });

  it('subtracts 12 months (the "1 year" quick option) across a year boundary', () => {
    const result = cutoffMonthsAgo(new Date(2026, 2, 10), 12); // 10 Mar 2026
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(10);
  });

  it('clamps to the last valid day instead of overflowing into the next month (Aug 31 minus 6 months)', () => {
    // 31 Aug 2026 minus 6 months lands on a Feb that only has 28 days in
    // 2026 (not a leap year) — Date.setMonth alone would roll over to
    // Mar 3 instead.
    const result = cutoffMonthsAgo(new Date(2026, 7, 31), 6);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
  });

  it('clamps a leap-day start to the last valid day of a non-leap target February', () => {
    // 29 Feb 2028 (leap year) minus 12 months lands on Feb 2027, which has
    // only 28 days.
    const result = cutoffMonthsAgo(new Date(2028, 1, 29), 12);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
  });

  it('zeroes the time to local start-of-day', () => {
    const result = cutoffMonthsAgo(new Date(2026, 5, 15, 20, 30, 0), 3);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe('startOfDay (FR-009a)', () => {
  it('zeroes the time without mutating the input', () => {
    const input = new Date(2026, 5, 15, 20, 30, 45);
    const result = startOfDay(input);

    expect(result.getHours()).toBe(0);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
    // Input itself is unchanged.
    expect(input.getHours()).toBe(20);
  });
});
