import { describe, expect, it } from 'vitest';
import { allStoredDataRange, lastMonthsRange } from '@/application/date-range';

describe('allStoredDataRange', () => {
  it('spans from well before any plausible session date to today', () => {
    const range = allStoredDataRange();
    expect(new Date(range.from).getUTCFullYear()).toBeLessThanOrEqual(2000);
    const to = new Date(range.to);
    const now = new Date();
    expect(Math.abs(to.getTime() - now.getTime())).toBeLessThan(60_000);
  });
});

describe('lastMonthsRange', () => {
  it('spans exactly the requested number of calendar months back from now', () => {
    for (const months of [3, 6, 12] as const) {
      const range = lastMonthsRange(months);
      const to = new Date(range.to);
      const expectedFrom = new Date(to);
      expectedFrom.setMonth(expectedFrom.getMonth() - months);
      expect(new Date(range.from).getTime()).toBeCloseTo(
        expectedFrom.getTime(),
        -2,
      );
    }
  });
});
