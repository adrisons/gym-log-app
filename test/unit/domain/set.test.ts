import { describe, expect, it } from 'vitest';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import { InvalidSetError } from '@/domain/errors';

describe('Set (FR-005)', () => {
  it('constructs a Set with a Weight load and a Reps volume, equal to an independently-constructed value with the same fields', () => {
    const a = createSet({
      volume: createVolume({ kind: 'reps', count: 8 }),
      load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    const b = createSet({
      volume: createVolume({ kind: 'reps', count: 8 }),
      load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    expect(a).toEqual(b);
    // No persistence concept anywhere in this type or this test.
  });
});

describe('Set construction rule (§3.3; FR-010)', () => {
  it('rejects a Set with neither Volume nor a non-none Load (red)', () => {
    expect(() =>
      createSet({
        load: createLoad({ kind: 'none' }),
        setKind: 'working',
        completed: false,
      }),
    ).toThrow(InvalidSetError);
  });

  it('accepts a Set with only a Volume (green)', () => {
    const set = createSet({
      volume: createVolume({ kind: 'reps', count: 10 }),
      load: createLoad({ kind: 'none' }),
      setKind: 'working',
      completed: true,
    });
    expect(set.volume).toEqual({ kind: 'reps', count: 10 });
  });

  it('accepts a Set with only a Load (green)', () => {
    const set = createSet({
      load: createLoad({ kind: 'bodyweight' }),
      setKind: 'working',
      completed: true,
    });
    expect(set.load).toEqual({ kind: 'bodyweight' });
  });

  it('accepts a Set with both a Volume and a Load (green)', () => {
    const set = createSet({
      volume: createVolume({ kind: 'reps', count: 5 }),
      load: createLoad({ kind: 'weight', value: 100, unit: 'kg' }),
      setKind: 'working',
      completed: true,
    });
    expect(set.volume).toBeDefined();
    expect(set.load.kind).toBe('weight');
  });

  it('allows two Sets in the same exercise entry to use different Volume variants (edge case)', () => {
    const plank = createSet({
      volume: createVolume({ kind: 'duration', seconds: 45 }),
      load: createLoad({ kind: 'none' }),
      setKind: 'working',
      completed: true,
    });
    const press = createSet({
      volume: createVolume({ kind: 'reps', count: 8 }),
      load: createLoad({ kind: 'none' }),
      setKind: 'working',
      completed: true,
    });
    expect(plank.volume?.kind).toBe('duration');
    expect(press.volume?.kind).toBe('reps');
  });
});
