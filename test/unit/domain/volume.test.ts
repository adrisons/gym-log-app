import { describe, expect, it } from 'vitest';
import { createVolume } from '@/domain/volume';
import { InvalidVolumeError } from '@/domain/errors';

describe('Volume (FR-008)', () => {
  it('constructs a reps variant', () => {
    const volume = createVolume({ kind: 'reps', count: 8 });
    expect(volume).toEqual({ kind: 'reps', count: 8 });
  });

  it('constructs a duration variant', () => {
    const volume = createVolume({ kind: 'duration', seconds: 45 });
    expect(volume).toEqual({ kind: 'duration', seconds: 45 });
  });

  it('constructs a distance variant', () => {
    const volume = createVolume({ kind: 'distance', metres: 400 });
    expect(volume).toEqual({ kind: 'distance', metres: 400 });
  });

  it('rejects a non-integer reps count (red)', () => {
    expect(() => createVolume({ kind: 'reps', count: 1.5 })).toThrow(
      InvalidVolumeError,
    );
  });

  it('rejects a non-positive reps count (red)', () => {
    expect(() => createVolume({ kind: 'reps', count: 0 })).toThrow(
      InvalidVolumeError,
    );
    expect(() => createVolume({ kind: 'reps', count: -1 })).toThrow(
      InvalidVolumeError,
    );
  });

  it('accepts a positive integer reps count (green)', () => {
    expect(createVolume({ kind: 'reps', count: 1 })).toEqual({
      kind: 'reps',
      count: 1,
    });
  });

  it('stores a decimal duration value unchanged (FR-015)', () => {
    const volume = createVolume({ kind: 'duration', seconds: 45.5 });
    expect(volume).toEqual({ kind: 'duration', seconds: 45.5 });
  });

  it('stores a decimal distance value unchanged (FR-015)', () => {
    const volume = createVolume({ kind: 'distance', metres: 42.195 });
    expect(volume).toEqual({ kind: 'distance', metres: 42.195 });
  });

  it('allows two Sets in the same exercise entry to use different Volume variants (edge case)', () => {
    // Domain-model property, not a Volume-level rejection: a 45s plank and
    // an 8-rep press are both independently valid Volumes with no forced
    // consistency between them. Full Set-level assertion lives in
    // set.test.ts (T018) — this just confirms both construct cleanly here.
    const plank = createVolume({ kind: 'duration', seconds: 45 });
    const press = createVolume({ kind: 'reps', count: 8 });
    expect(plank.kind).toBe('duration');
    expect(press.kind).toBe('reps');
  });
});
