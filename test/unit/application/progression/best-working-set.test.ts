import { describe, expect, it } from 'vitest';
import { bestWorkingSet } from '@/application/progression/best-working-set';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';

describe('bestWorkingSet', () => {
  it('picks the highest-e1RM eligible set when any qualify', () => {
    const lighter = createSet({
      volume: createVolume({ kind: 'reps', count: 8 }),
      load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    const heavier = createSet({
      volume: createVolume({ kind: 'reps', count: 5 }),
      load: createLoad({ kind: 'weight', value: 100, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    expect(bestWorkingSet([lighter, heavier])).toBe(heavier);
  });

  it('falls back to the highest numeric load when no set is e1RM-eligible', () => {
    const lowReps = createSet({
      volume: createVolume({ kind: 'reps', count: 20 }), // outside 1-12
      load: createLoad({ kind: 'weight', value: 40, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    const heavier = createSet({
      volume: createVolume({ kind: 'reps', count: 20 }),
      load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    expect(bestWorkingSet([lowReps, heavier])).toBe(heavier);
  });

  it('falls back to the highest rep count when no set has a numeric load', () => {
    const fewer = createSet({
      volume: createVolume({ kind: 'reps', count: 10 }),
      load: createLoad({ kind: 'freeText', text: 'red band' }),
      setKind: 'working',
      completed: true,
    });
    const more = createSet({
      volume: createVolume({ kind: 'reps', count: 15 }),
      load: createLoad({ kind: 'freeText', text: 'red band' }),
      setKind: 'working',
      completed: true,
    });
    expect(bestWorkingSet([fewer, more])).toBe(more);
  });

  it('is independent of any externally-selected metric — same ranking regardless of caller intent', () => {
    const eligible = createSet({
      volume: createVolume({ kind: 'reps', count: 5 }),
      load: createLoad({ kind: 'weight', value: 80, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    // Even though tonnage (80*5=400) is lower than a hypothetical
    // higher-rep set could produce, e1RM eligibility still wins the tier.
    const highTonnageIneligible = createSet({
      volume: createVolume({ kind: 'reps', count: 20 }),
      load: createLoad({ kind: 'weight', value: 80, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    expect(bestWorkingSet([eligible, highTonnageIneligible])).toBe(eligible);
  });

  it('returns undefined for an empty or all-warm-up set list', () => {
    expect(bestWorkingSet([])).toBeUndefined();
    const warmUp = createSet({
      volume: createVolume({ kind: 'reps', count: 5 }),
      load: createLoad({ kind: 'weight', value: 20, unit: 'kg' }),
      setKind: 'warmUp',
      completed: true,
    });
    expect(bestWorkingSet([warmUp])).toBeUndefined();
  });
});
