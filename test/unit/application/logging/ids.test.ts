import { describe, expect, it } from 'vitest';
import { newSessionId, newExerciseId } from '@/application/logging/ids';
import type { SessionId, ExerciseId } from '@/domain/ids';

describe('application/logging/ids (research.md §2)', () => {
  it('newSessionId returns a unique string on every call, assignable as a SessionId', () => {
    const a: SessionId = newSessionId();
    const b: SessionId = newSessionId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });

  it('newExerciseId returns a unique string on every call, assignable as an ExerciseId', () => {
    const a: ExerciseId = newExerciseId();
    const b: ExerciseId = newExerciseId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });
});
