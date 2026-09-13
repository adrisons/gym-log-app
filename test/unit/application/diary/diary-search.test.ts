import { describe, expect, it } from 'vitest';
import { filterSessionsByExerciseName } from '@/application/diary/diary-search';
import type { DiarySessionSummary } from '@/application/diary/diary-summary';
import type { SessionId } from '@/domain/ids';

function summary(id: string, exerciseNames: string[]): DiarySessionSummary {
  return {
    sessionId: id as SessionId,
    dateTime: '2026-09-11T10:00:00.000Z',
    mainExerciseNames: exerciseNames,
    kindOfWork: undefined,
  };
}

describe('filterSessionsByExerciseName (ADR-0009)', () => {
  const summaries = [
    summary('bench', ['Bench press']),
    summary('squat', ['Barbell squat']),
    summary('both', ['Bench press', 'Barbell squat']),
  ];

  it('returns every session for an empty/whitespace-only query', () => {
    expect(filterSessionsByExerciseName(summaries, '')).toHaveLength(3);
    expect(filterSessionsByExerciseName(summaries, '   ')).toHaveLength(3);
  });

  it('matches sessions containing the exercise, case/accent-insensitive substring', () => {
    const result = filterSessionsByExerciseName(summaries, 'bench');
    expect(result.map((s) => s.sessionId)).toEqual(['bench', 'both']);
  });

  it('tolerates a typo (reuses FR-7 matching)', () => {
    const result = filterSessionsByExerciseName(summaries, 'squta');
    expect(result.map((s) => s.sessionId)).toEqual(['squat', 'both']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterSessionsByExerciseName(summaries, 'deadlift')).toEqual([]);
  });
});
