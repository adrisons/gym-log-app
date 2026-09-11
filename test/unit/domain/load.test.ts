import { describe, expect, it } from 'vitest';
import { createLoad } from '@/domain/load';
import { InvalidLoadError } from '@/domain/errors';

describe('Load (FR-007)', () => {
  it('constructs a weight variant, stored exactly as entered (FR-015)', () => {
    const load = createLoad({ kind: 'weight', value: 1.2, unit: 'kg' });
    expect(load).toEqual({ kind: 'weight', value: 1.2, unit: 'kg' });
  });

  it('constructs a band variant', () => {
    const load = createLoad({
      kind: 'band',
      label: 'red',
      estimatedResistanceKg: 15,
    });
    expect(load).toEqual({
      kind: 'band',
      label: 'red',
      estimatedResistanceKg: 15,
    });
  });

  it('constructs a bodyweight variant with a signed component', () => {
    const load = createLoad({ kind: 'bodyweight', addedOrAssistedKg: -20 });
    expect(load).toEqual({ kind: 'bodyweight', addedOrAssistedKg: -20 });
  });

  it('constructs a bodyweight variant with no component', () => {
    const load = createLoad({ kind: 'bodyweight' });
    expect(load).toEqual({ kind: 'bodyweight' });
  });

  it('constructs a freeText variant', () => {
    const load = createLoad({ kind: 'freeText', text: 'purple kettlebell' });
    expect(load).toEqual({ kind: 'freeText', text: 'purple kettlebell' });
  });

  it('constructs a none variant', () => {
    const load = createLoad({ kind: 'none' });
    expect(load).toEqual({ kind: 'none' });
  });

  // A compile-time check that the Load union type itself rejects a sixth
  // variant (e.g. a `@ts-expect-error` fixture) is a separate concern from
  // this runtime test — Vitest cannot observe type-level rejection. Tracked
  // as part of load.ts's own type authoring, not asserted here.

  it('rejects an out-of-range bodyweight component (red)', () => {
    expect(() =>
      createLoad({ kind: 'bodyweight', addedOrAssistedKg: 301 }),
    ).toThrow(InvalidLoadError);
    expect(() =>
      createLoad({ kind: 'bodyweight', addedOrAssistedKg: -301 }),
    ).toThrow(InvalidLoadError);
  });

  it('rejects a non-finite bodyweight component — NaN is not "in range" (red)', () => {
    // Regression: `NaN < -300` and `NaN > 300` both evaluate false, so a
    // bounds check alone lets NaN through unless finiteness is checked
    // explicitly first.
    expect(() =>
      createLoad({ kind: 'bodyweight', addedOrAssistedKg: Number.NaN }),
    ).toThrow(InvalidLoadError);
    expect(() =>
      createLoad({
        kind: 'bodyweight',
        addedOrAssistedKg: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(InvalidLoadError);
  });

  it('accepts the boundary values -300 and +300 (green)', () => {
    expect(createLoad({ kind: 'bodyweight', addedOrAssistedKg: 300 })).toEqual({
      kind: 'bodyweight',
      addedOrAssistedKg: 300,
    });
    expect(createLoad({ kind: 'bodyweight', addedOrAssistedKg: -300 })).toEqual(
      { kind: 'bodyweight', addedOrAssistedKg: -300 },
    );
  });

  it('canonicalizes a bodyweight component of exactly 0 to "no component"', () => {
    const load = createLoad({ kind: 'bodyweight', addedOrAssistedKg: 0 });
    expect(load).toEqual({ kind: 'bodyweight' });
    expect('addedOrAssistedKg' in load).toBe(false);
  });

  it('stores a decimal weight value unchanged — no rounding, no unit conversion (FR-015)', () => {
    const load = createLoad({ kind: 'weight', value: 1.2, unit: 'kg' });
    expect(load).toEqual({ kind: 'weight', value: 1.2, unit: 'kg' });
    if (load.kind === 'weight') {
      expect(load.value).toBe(1.2);
      expect(load.unit).toBe('kg');
    }
  });

  it('models "load does not apply" via the none variant, distinct from Effort having no such variant (FR-022)', () => {
    const load = createLoad({ kind: 'none' });
    expect(load.kind).toBe('none');
    // Effort has no equivalent — see effort.test.ts.
  });
});
