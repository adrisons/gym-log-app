import { describe, expect, it } from 'vitest';
import { matchExercise } from '@/shared/fuzzy-match';

const candidates = [
  { name: 'Barbell squat', aliases: ['back squat'] },
  { name: 'Glute bridge', aliases: ['hip thrust'] },
  { name: 'Bench press', aliases: [] },
];

describe('shared/fuzzy-match (research.md §3, FR-016)', () => {
  it('ranks an exact match first', () => {
    const results = matchExercise('Bench press', candidates);
    expect(results[0]?.name).toBe('Bench press');
  });

  it('ranks a prefix match above a substring-only match', () => {
    const withPrefix = [
      { name: 'Squat', aliases: [] },
      { name: 'Barbell squat', aliases: [] },
    ];
    const results = matchExercise('squat', withPrefix);
    expect(results[0]?.name).toBe('Squat');
  });

  it('tolerates a one-character typo', () => {
    const results = matchExercise('squta', candidates);
    expect(results.map((r) => r.name)).toContain('Barbell squat');
  });

  it('is accent-insensitive', () => {
    const withAccent = [{ name: 'Sentadilla', aliases: [] }];
    const results = matchExercise('sentadílla', withAccent);
    expect(results[0]?.name).toBe('Sentadilla');
  });

  it('matches an alias, not only the canonical name (FR-016)', () => {
    const results = matchExercise('hip thrust', candidates);
    expect(results[0]?.name).toBe('Glute bridge');
  });

  it('is case-insensitive', () => {
    const results = matchExercise('BENCH PRESS', candidates);
    expect(results[0]?.name).toBe('Bench press');
  });

  it('excludes an unrelated candidate', () => {
    const results = matchExercise('zzz-nonexistent-zzz', candidates);
    expect(results).toHaveLength(0);
  });
});
