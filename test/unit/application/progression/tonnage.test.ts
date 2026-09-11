import { describe, expect, it } from 'vitest';
import { sessionTonnage } from '@/application/progression/tonnage';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';

describe('sessionTonnage', () => {
  it('sums load x reps across numeric-load working sets', () => {
    const sets = [
      createSet({
        volume: createVolume({ kind: 'reps', count: 10 }),
        load: createLoad({ kind: 'weight', value: 50, unit: 'kg' }),
        setKind: 'working',
        completed: true,
      }),
      createSet({
        volume: createVolume({ kind: 'reps', count: 8 }),
        load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
        setKind: 'working',
        completed: true,
      }),
    ];
    expect(sessionTonnage(sets)).toEqual({
      value: 10 * 50 + 8 * 60,
      unit: 'kg',
    });
  });

  it('falls back to total reps, unit "reps", when no set has a numeric load', () => {
    const sets = [
      createSet({
        volume: createVolume({ kind: 'reps', count: 12 }),
        load: createLoad({ kind: 'band', label: 'red' }),
        setKind: 'working',
        completed: true,
      }),
      createSet({
        volume: createVolume({ kind: 'reps', count: 15 }),
        load: createLoad({ kind: 'freeText', text: 'level 4' }),
        setKind: 'working',
        completed: true,
      }),
    ];
    expect(sessionTonnage(sets)).toEqual({ value: 27, unit: 'reps' });
  });
});
