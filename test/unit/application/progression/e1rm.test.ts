import { describe, expect, it } from 'vitest';
import {
  estimatedOneRepMax,
  isE1rmEligible,
} from '@/application/progression/e1rm';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';

function set(overrides: Partial<Parameters<typeof createSet>[0]> = {}) {
  return createSet({
    volume: createVolume({ kind: 'reps', count: 8 }),
    load: createLoad({ kind: 'weight', value: 100, unit: 'kg' }),
    setKind: 'working',
    completed: true,
    ...overrides,
  });
}

describe('isE1rmEligible', () => {
  it('is true for a Weight working set with 1-12 reps', () => {
    expect(isE1rmEligible(set())).toBe(true);
  });

  it('is true for a Bodyweight set with a numeric added load', () => {
    expect(
      isE1rmEligible(
        set({
          load: createLoad({ kind: 'bodyweight', addedOrAssistedKg: 10 }),
        }),
      ),
    ).toBe(true);
  });

  it('is false for FreeText or None loads', () => {
    expect(
      isE1rmEligible(
        set({ load: createLoad({ kind: 'freeText', text: 'heavy' }) }),
      ),
    ).toBe(false);
    expect(isE1rmEligible(set({ load: createLoad({ kind: 'none' }) }))).toBe(
      false,
    );
  });

  it('is false for a zero-added-load Bodyweight set', () => {
    expect(
      isE1rmEligible(set({ load: createLoad({ kind: 'bodyweight' }) })),
    ).toBe(false);
  });

  it('is false for reps outside 1-12', () => {
    expect(
      isE1rmEligible(
        set({ volume: createVolume({ kind: 'reps', count: 15 }) }),
      ),
    ).toBe(false);
  });

  it('is false for non-reps volume', () => {
    expect(
      isE1rmEligible(
        set({ volume: createVolume({ kind: 'duration', seconds: 30 }) }),
      ),
    ).toBe(false);
  });

  it('is false for a warm-up set', () => {
    expect(isE1rmEligible(set({ setKind: 'warmUp' }))).toBe(false);
  });
});

describe('estimatedOneRepMax', () => {
  it('matches the Epley formula exactly', () => {
    // 100 * (1 + 8/30) = 126.666...
    expect(estimatedOneRepMax(set())).toBeCloseTo(100 * (1 + 8 / 30), 10);
  });
});
