import { describe, expect, it } from 'vitest';
import { searchExercises } from '@/application/search/exercise-search';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';

function exercise(
  id: string,
  canonicalName: string,
  aliases: string[] = [],
): Exercise {
  return {
    id: id as ExerciseId,
    canonicalName,
    aliases,
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  };
}

describe('searchExercises', () => {
  const catalogue = [
    exercise('ex-1', 'Sentadilla'),
    exercise('ex-2', 'Peso muerto', ['deadlift']),
  ];

  it('matches case-insensitively', () => {
    expect(searchExercises('sentadilla', catalogue).map((e) => e.id)).toEqual([
      'ex-1',
    ]);
  });

  it('tolerates a one-character typo', () => {
    expect(searchExercises('sentadila', catalogue).map((e) => e.id)).toEqual([
      'ex-1',
    ]);
  });

  it('matches a prefix/partial query', () => {
    expect(searchExercises('senta', catalogue).map((e) => e.id)).toEqual([
      'ex-1',
    ]);
  });

  it('matches an alias', () => {
    expect(searchExercises('deadlift', catalogue).map((e) => e.id)).toEqual([
      'ex-2',
    ]);
  });

  it('returns an empty array, never throws, for a query matching nothing', () => {
    expect(searchExercises('zzz-no-match-zzz', catalogue)).toEqual([]);
  });

  it('returns results in under 100ms for a 500-exercise catalogue', () => {
    const bigCatalogue = Array.from({ length: 500 }, (_, i) =>
      exercise(`ex-${i}`, `Exercise number ${i} variant training movement`),
    );
    const start = performance.now();
    searchExercises('exercse nubmer 250', bigCatalogue);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
