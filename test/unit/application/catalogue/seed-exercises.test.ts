import { describe, expect, it } from 'vitest';
import { buildSeedCatalogue } from '../../../../src/application/catalogue/seed-exercises';

describe('buildSeedCatalogue (D9, ADR-0005; spec 006 research.md §1)', () => {
  it('returns a non-empty list of valid Strength-discipline Exercise records', () => {
    const seed = buildSeedCatalogue();
    expect(seed.length).toBeGreaterThan(0);
    for (const exercise of seed) {
      expect(exercise.discipline).toBe('Strength');
      expect(exercise.canonicalName.length).toBeGreaterThan(0);
      expect(exercise.defaultLoadType).toBe('weight');
      expect(exercise.defaultVolumeKind).toBe('reps');
      expect(exercise.trackEffort).toBe(false);
      expect(exercise.aliases).toEqual([]);
    }
  });

  it('gives every exercise a distinct id', () => {
    const seed = buildSeedCatalogue();
    expect(new Set(seed.map((e) => e.id)).size).toBe(seed.length);
  });

  it('generates fresh ids on every call (seed ids are not deterministic across installs, ADR-0005)', () => {
    const first = buildSeedCatalogue();
    const second = buildSeedCatalogue();
    expect(first.map((e) => e.id)).not.toEqual(second.map((e) => e.id));
  });

  it('covers more than one movement pattern', () => {
    const patterns = new Set(
      buildSeedCatalogue().map((e) => e.movementPattern),
    );
    expect(patterns.size).toBeGreaterThan(1);
  });
});
