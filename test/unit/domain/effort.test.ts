import { describe, expect, it, expectTypeOf } from 'vitest';
import type { Effort } from '@/domain/effort';

describe('Effort (ADR-0003; FR-009, FR-022)', () => {
  it('is a single canonical integer 1-5, not a pair of RPE/RIR values', () => {
    const values: Effort[] = [1, 2, 3, 4, 5];
    for (const value of values) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it('has no "none"/absent variant at the type level — Effort is always a plain 1-5 integer when it exists', () => {
    expectTypeOf<Effort>().toEqualTypeOf<1 | 2 | 3 | 4 | 5>();
  });
});
