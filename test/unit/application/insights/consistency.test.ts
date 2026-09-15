import { describe, expect, it } from 'vitest';
import { computeConsistency } from '@/application/insights/consistency';
import { createSession } from '@/domain/session';
import type { SessionId } from '@/domain/ids';

const ASOF = new Date('2026-06-01T00:00:00.000Z'); // a Monday

function session(id: string, dateTime: string) {
  return createSession({
    id: id as SessionId,
    dateTime,
    notes: '',
    blocks: [],
  });
}

describe('computeConsistency', () => {
  it('reports 6 trained weeks out of a trailing 12-week window with >=12 weeks of history', () => {
    // One session in each of 6 distinct weeks within the last 12 weeks,
    // spread far enough back that overall history exceeds 12 weeks.
    const sessions = [
      session('s1', '2026-01-05T10:00:00.000Z'), // ~21 weeks back — establishes long history
      session('s2', '2026-03-16T10:00:00.000Z'),
      session('s3', '2026-03-30T10:00:00.000Z'),
      session('s4', '2026-04-13T10:00:00.000Z'),
      session('s5', '2026-04-27T10:00:00.000Z'),
      session('s6', '2026-05-11T10:00:00.000Z'),
      session('s7', '2026-05-25T10:00:00.000Z'),
    ];
    const result = computeConsistency(sessions, 'monday', ASOF);
    expect(result).toBeDefined();
    expect(result!.totalWeeks).toBe(12);
    expect(result!.trainedWeeks).toBe(6);
  });

  it('clips totalWeeks to the actual history span when shorter than 12 weeks', () => {
    const sessions = [
      session('s1', '2026-04-27T10:00:00.000Z'), // ~5 weeks before ASOF
      session('s2', '2026-05-25T10:00:00.000Z'),
    ];
    const result = computeConsistency(sessions, 'monday', ASOF);
    expect(result).toBeDefined();
    expect(result!.totalWeeks).toBeLessThan(12);
    expect(result!.totalWeeks).toBeGreaterThanOrEqual(4);
  });

  it('returns undefined when total history spans fewer than 4 weeks', () => {
    const sessions = [
      session('s1', '2026-05-20T10:00:00.000Z'),
      session('s2', '2026-05-28T10:00:00.000Z'),
    ];
    expect(computeConsistency(sessions, 'monday', ASOF)).toBeUndefined();
  });

  it('returns undefined for no sessions at all', () => {
    expect(computeConsistency([], 'monday', ASOF)).toBeUndefined();
  });

  describe('firstDayOfWeek (spec 006 FR-018)', () => {
    it('buckets a Sunday-dated session into a different week than Monday-start would', () => {
      // 2026-05-31 is a Sunday; under Monday-start it belongs to the week
      // starting 2026-05-25, but under Sunday-start it starts its own new
      // week (2026-05-31), separate from a session on that same Monday.
      const sessions = [
        session('s1', '2026-01-05T10:00:00.000Z'), // long history anchor
        session('s2', '2026-03-16T10:00:00.000Z'),
        session('s3', '2026-03-30T10:00:00.000Z'),
        session('s4', '2026-04-13T10:00:00.000Z'),
        session('s5', '2026-04-27T10:00:00.000Z'),
        session('s6', '2026-05-25T10:00:00.000Z'), // Monday
        session('s7', '2026-05-31T10:00:00.000Z'), // the following Sunday
      ];
      const mondayStart = computeConsistency(sessions, 'monday', ASOF);
      const sundayStart = computeConsistency(sessions, 'sunday', ASOF);
      // Same underlying in-window sessions either way (the trailing window
      // itself doesn't depend on firstDayOfWeek) — only the week bucketing
      // differs, so Sunday-start counts exactly one more distinct week
      // than Monday-start: s6 (Monday) and s7 (the following Sunday) share
      // one Monday-start week but land in two different Sunday-start weeks.
      expect(sundayStart!.trainedWeeks).toBe(mondayStart!.trainedWeeks + 1);
    });

    it('defaults to monday-start when firstDayOfWeek is omitted', () => {
      const sessions = [
        session('s1', '2026-01-05T10:00:00.000Z'),
        session('s2', '2026-05-25T10:00:00.000Z'),
        session('s3', '2026-05-31T10:00:00.000Z'),
      ];
      expect(computeConsistency(sessions, undefined, ASOF)).toEqual(
        computeConsistency(sessions, 'monday', ASOF),
      );
    });
  });
});
