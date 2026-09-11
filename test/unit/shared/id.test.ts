import { describe, expect, it } from 'vitest';
import { newId } from '@/shared/id';

describe('shared/id (research.md §2)', () => {
  it('returns a unique string on every call', () => {
    const a = newId();
    const b = newId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });
});
