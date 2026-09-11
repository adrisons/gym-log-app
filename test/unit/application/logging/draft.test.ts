import { describe, expect, it } from 'vitest';
import {
  createDraft,
  draftToSession,
  addExerciseEntry,
  prefillNextSet,
  addSet,
} from '@/application/logging/draft';
import type { LoggingDraft } from '@/application/logging/draft';
import type { SessionId, ExerciseId } from '@/domain/ids';
import { InvalidSetError } from '@/domain/errors';

describe('LoggingDraft (data-model.md "LoggingDraft")', () => {
  it('createDraft returns an empty draft dated `now`, with a fresh id every call', () => {
    const now = '2026-09-11T18:00:00.000Z';
    const a = createDraft(now);
    const b = createDraft(now);
    expect(a.blocks).toEqual([]);
    expect(a.dateTime).toBe(now);
    expect(a.lastEditedAt).toBe(now);
    expect(a.notes).toBe('');
    expect(a.id).not.toBe(b.id);
  });

  it('draftToSession strips every draft-local id and matches an independently-constructed Session', () => {
    const exerciseId = 'exercise-1' as ExerciseId;
    const sessionId = 'session-1' as SessionId;
    const draft: LoggingDraft = {
      id: 'draft-1',
      dateTime: '2026-09-11T18:00:00.000Z',
      lastEditedAt: '2026-09-11T18:05:00.000Z',
      notes: 'felt good',
      overallFeeling: 4,
      durationSeconds: 3600,
      blocks: [
        {
          id: 'block-1',
          name: 'Squats',
          type: 'straightSets',
          exercises: [
            {
              id: 'entry-1',
              exerciseId,
              notes: '',
              sets: [
                {
                  id: 'set-1',
                  volume: { kind: 'reps', count: 8 },
                  load: { kind: 'weight', value: 60, unit: 'kg' },
                  effort: 3,
                  setKind: 'working',
                  completed: true,
                },
              ],
            },
          ],
        },
      ],
    };

    const session = draftToSession(draft, sessionId);

    expect(session).toEqual({
      id: sessionId,
      dateTime: draft.dateTime,
      notes: draft.notes,
      overallFeeling: 4,
      durationSeconds: 3600,
      blocks: [
        {
          name: 'Squats',
          type: 'straightSets',
          exercises: [
            {
              exerciseId,
              notes: '',
              sets: [
                {
                  volume: { kind: 'reps', count: 8 },
                  load: { kind: 'weight', value: 60, unit: 'kg' },
                  effort: 3,
                  setKind: 'working',
                  completed: true,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('draftToSession handles a draft with zero blocks (FR-017 applies to a submitted draft too)', () => {
    const draft = createDraft('2026-09-11T18:00:00.000Z');
    const session = draftToSession(draft, 'session-2' as SessionId);
    expect(session.blocks).toEqual([]);
  });
});

describe('addExerciseEntry (FR-002; keeps US1 a flat single running list)', () => {
  it('creates a default straightSets block when the draft has none yet', () => {
    const draft = createDraft('2026-09-11T18:00:00.000Z');
    const exerciseId = 'ex-1' as ExerciseId;

    const updated = addExerciseEntry(draft, exerciseId);

    expect(updated.blocks).toHaveLength(1);
    expect(updated.blocks[0]?.type).toBe('straightSets');
    expect(updated.blocks[0]?.exercises).toHaveLength(1);
    expect(updated.blocks[0]?.exercises[0]?.exerciseId).toBe(exerciseId);
    expect(updated.blocks[0]?.exercises[0]?.sets).toEqual([]);
  });

  it('appends to the last existing block rather than creating another', () => {
    const draft = createDraft('2026-09-11T18:00:00.000Z');
    const withFirst = addExerciseEntry(draft, 'ex-1' as ExerciseId);

    const withSecond = addExerciseEntry(withFirst, 'ex-2' as ExerciseId);

    expect(withSecond.blocks).toHaveLength(1);
    expect(withSecond.blocks[0]?.exercises).toHaveLength(2);
  });
});

describe('prefillNextSet (FR-008)', () => {
  it('returns undefined for an entry with no sets', () => {
    const draft = addExerciseEntry(
      createDraft('2026-09-11T18:00:00.000Z'),
      'ex-1' as ExerciseId,
    );
    const blockId = draft.blocks[0]!.id;
    const entryId = draft.blocks[0]!.exercises[0]!.id;

    expect(prefillNextSet(draft, blockId, entryId)).toBeUndefined();
  });

  it("returns the last set's volume/load, never its effort", () => {
    let draft = addExerciseEntry(
      createDraft('2026-09-11T18:00:00.000Z'),
      'ex-1' as ExerciseId,
    );
    const blockId = draft.blocks[0]!.id;
    const entryId = draft.blocks[0]!.exercises[0]!.id;

    draft = addSet(
      draft,
      blockId,
      entryId,
      {
        volume: { kind: 'reps', count: 8 },
        load: { kind: 'weight', value: 60, unit: 'kg' },
        effort: 3,
        setKind: 'working',
      },
      1000,
      undefined,
    );

    const prefill = prefillNextSet(draft, blockId, entryId);
    expect(prefill).toEqual({
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'weight', value: 60, unit: 'kg' },
    });
    expect(prefill && 'effort' in prefill).toBe(false);
  });
});

describe('addSet (FR-003, FR-008, FR-019, FR-025, FR-026)', () => {
  function draftWithEntry() {
    const draft = addExerciseEntry(
      createDraft('2026-09-11T18:00:00.000Z'),
      'ex-1' as ExerciseId,
    );
    return {
      draft,
      blockId: draft.blocks[0]!.id,
      entryId: draft.blocks[0]!.exercises[0]!.id,
    };
  }

  it('appends a new set with a Weight load and a reps volume', () => {
    const { draft, blockId, entryId } = draftWithEntry();

    const updated = addSet(
      draft,
      blockId,
      entryId,
      {
        volume: { kind: 'reps', count: 5 },
        load: { kind: 'weight', value: 100, unit: 'kg' },
        setKind: 'working',
      },
      1000,
      undefined,
    );

    const sets = updated.blocks[0]?.exercises[0]?.sets;
    expect(sets).toHaveLength(1);
    expect(sets?.[0]?.load).toEqual({ kind: 'weight', value: 100, unit: 'kg' });
    expect(sets?.[0]?.volume).toEqual({ kind: 'reps', count: 5 });
  });

  it('throws InvalidSetError, leaving the draft unchanged in spirit, when neither volume nor a non-none load is given (FR-019)', () => {
    const { draft, blockId, entryId } = draftWithEntry();

    expect(() =>
      addSet(
        draft,
        blockId,
        entryId,
        { load: { kind: 'none' }, setKind: 'working' },
        1000,
        undefined,
      ),
    ).toThrow(InvalidSetError);
  });

  it('ignores an identical confirm repeated within 1000ms of the previous one (FR-025)', () => {
    const { draft, blockId, entryId } = draftWithEntry();
    const input = {
      volume: { kind: 'reps' as const, count: 5 },
      load: { kind: 'weight' as const, value: 100, unit: 'kg' as const },
      setKind: 'working' as const,
    };

    const afterFirst = addSet(draft, blockId, entryId, input, 1000, undefined);
    const afterSecond = addSet(afterFirst, blockId, entryId, input, 1500, 1000);

    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.blocks[0]?.exercises[0]?.sets).toHaveLength(1);
  });

  it('records a new identical set once the debounce window has passed', () => {
    const { draft, blockId, entryId } = draftWithEntry();
    const input = {
      volume: { kind: 'reps' as const, count: 5 },
      load: { kind: 'weight' as const, value: 100, unit: 'kg' as const },
      setKind: 'working' as const,
    };

    const afterFirst = addSet(draft, blockId, entryId, input, 1000, undefined);
    const afterSecond = addSet(afterFirst, blockId, entryId, input, 3000, 1000);

    expect(afterSecond).not.toBe(afterFirst);
    expect(afterSecond.blocks[0]?.exercises[0]?.sets).toHaveLength(2);
  });
});
