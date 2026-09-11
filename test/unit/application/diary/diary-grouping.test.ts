import { describe, expect, it } from 'vitest';
import {
  findNearestSessionDate,
  groupSessionsByMonth,
} from '@/application/diary/diary-grouping';
import type { DiarySessionSummary } from '@/application/diary/diary-summary';
import type { SessionId } from '@/domain/ids';

function summary(id: string, dateTime: string): DiarySessionSummary {
  return {
    sessionId: id as SessionId,
    dateTime,
    mainExerciseNames: [],
    setCount: 0,
    kindOfWork: undefined,
  };
}

describe('groupSessionsByMonth', () => {
  it('groups sessions into reverse-chronological months, sessions reverse-chronological within each', () => {
    const groups = groupSessionsByMonth([
      summary('a', '2026-07-01T10:00:00.000Z'),
      summary('b', '2026-09-05T10:00:00.000Z'),
      summary('c', '2026-09-15T10:00:00.000Z'),
      summary('d', '2026-08-10T10:00:00.000Z'),
    ]);

    expect(groups.map((g) => g.monthKey)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
    ]);
    expect(groups[0]!.sessions.map((s) => s.sessionId)).toEqual(['c', 'b']);
  });
});

describe('findNearestSessionDate', () => {
  const summaries = [
    summary('early', '2026-01-01T10:00:00.000Z'),
    summary('mid', '2026-06-01T10:00:00.000Z'),
    summary('late', '2026-12-01T10:00:00.000Z'),
  ];

  it('returns the exact match when a session is on the target date', () => {
    expect(findNearestSessionDate(summaries, '2026-06-01T10:00:00.000Z')).toBe(
      'mid',
    );
  });

  it('returns the nearest session dated after the target when none is exact', () => {
    expect(findNearestSessionDate(summaries, '2026-03-01T00:00:00.000Z')).toBe(
      'mid',
    );
  });

  it('returns the nearest session before the target when none exists on or after it', () => {
    expect(findNearestSessionDate(summaries, '2026-12-15T00:00:00.000Z')).toBe(
      'late',
    );
  });

  it('returns undefined for an empty list', () => {
    expect(
      findNearestSessionDate([], '2026-01-01T00:00:00.000Z'),
    ).toBeUndefined();
  });
});
