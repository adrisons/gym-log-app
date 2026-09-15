import { describe, expect, it } from 'vitest';
import {
  sessionToEditable,
  editableToSession,
} from '@/application/diary/session-editing';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import type { SessionId, ExerciseId } from '@/domain/ids';

describe('sessionToEditable/editableToSession round-trip a Block.name', () => {
  it('carries a name (or its absence) through sessionToEditable and back via editableToSession unchanged', () => {
    const exerciseId = 'ex-1' as ExerciseId;
    const original = createSession({
      id: 'session-1' as SessionId,
      dateTime: '2026-09-11T18:00:00.000Z',
      notes: '',
      blocks: [
        createBlock({ type: 'circuit', name: 'Circuit A', exercises: [] }),
        createBlock({
          type: 'straightSets',
          exercises: [{ exerciseId, notes: '', sets: [] }],
        }),
      ],
    });

    const editable = sessionToEditable(original);
    expect(editable.blocks[0]?.name).toBe('Circuit A');
    expect(editable.blocks[1]?.name).toBeUndefined();

    const roundTripped = editableToSession(editable, original);
    expect(roundTripped.blocks[0]?.name).toBe('Circuit A');
    expect(roundTripped.blocks[1]).not.toHaveProperty('name');
  });
});
