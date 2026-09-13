import { describe, expect, it } from 'vitest';
import { groupSessionsByMonth } from '@/application/diary/diary-grouping';
import type { DiarySessionSummary } from '@/application/diary/diary-summary';
import type { SessionId } from '@/domain/ids';

function summary(id: string, dateTime: string): DiarySessionSummary {
  return {
    sessionId: id as SessionId,
    dateTime,
    mainExerciseNames: [],
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
