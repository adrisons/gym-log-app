import { describe, expect, it } from 'vitest';
import { formatDiaryDate } from '@/presentation/design/format-date';

describe('formatDiaryDate (ADR-0009)', () => {
  it('formats as "D Mon YYYY" regardless of the runtime locale', () => {
    expect(formatDiaryDate('2026-09-12T10:00:00.000Z')).toBe('12 Sep 2026');
  });

  it('never zero-pads the day', () => {
    expect(formatDiaryDate('2026-01-05T10:00:00.000Z')).toBe('5 Jan 2026');
  });
});
