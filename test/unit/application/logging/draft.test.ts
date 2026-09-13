import { describe, expect, it } from 'vitest';
import {
  createDraft,
  draftToSession,
  toPersistableDraft,
  addExerciseEntry,
  prefillNextSet,
  addSet,
  addBlock,
  renameBlock,
  findBlockIdForEntry,
  reorderBlockExercise,
  moveExerciseAcrossBlocks,
  deleteBlock,
  deleteExerciseEntry,
  deleteSet,
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

  it('toPersistableDraft strips the presentation-only `loose` flag so it never reaches disk/IndexedDB (undocumented-schema-field regression)', () => {
    const draft: LoggingDraft = {
      id: 'draft-1',
      dateTime: '2026-09-11T18:00:00.000Z',
      lastEditedAt: '2026-09-11T18:00:00.000Z',
      notes: '',
      blocks: [
        {
          id: 'block-1',
          loose: true,
          type: 'straightSets',
          exercises: [],
        },
        {
          id: 'block-2',
          name: 'Named block',
          type: 'straightSets',
          exercises: [],
        },
      ],
    };

    const persistable = toPersistableDraft(draft);

    expect(persistable.blocks[0]).not.toHaveProperty('loose');
    expect(persistable.blocks[1]).not.toHaveProperty('loose');
    // Every other field survives unchanged.
    expect(persistable.blocks[0]).toEqual({
      id: 'block-1',
      type: 'straightSets',
      exercises: [],
    });
    expect(persistable.blocks[1]).toEqual({
      id: 'block-2',
      name: 'Named block',
      type: 'straightSets',
      exercises: [],
    });
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

  it('with an explicit blockId, appends to that block instead of the last one', () => {
    let draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      'Legs',
      'straightSets',
    );
    draft = addBlock(draft, undefined, 'straightSets');
    const firstBlockId = draft.blocks[0]!.id;

    const updated = addExerciseEntry(draft, 'ex-1' as ExerciseId, firstBlockId);

    expect(updated.blocks[0]?.exercises).toHaveLength(1);
    expect(updated.blocks[1]?.exercises).toHaveLength(0);
  });

  it('with no blockId, starts a fresh unnamed block rather than nesting into a named last block', () => {
    let draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      'Legs',
      'straightSets',
    );
    draft = addExerciseEntry(draft, 'ex-1' as ExerciseId);

    expect(draft.blocks).toHaveLength(2);
    expect(draft.blocks[0]?.exercises).toHaveLength(0);
    expect(draft.blocks[1]?.name).toBeUndefined();
    expect(draft.blocks[1]?.exercises).toHaveLength(1);
  });

  it('is a no-op when the given blockId does not resolve', () => {
    const draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      undefined,
      'straightSets',
    );

    const updated = addExerciseEntry(draft, 'ex-1' as ExerciseId, 'missing');

    expect(updated).toBe(draft);
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

describe('addBlock/renameBlock (FR-006, FR-007)', () => {
  it('appends a block, unnamed when name is omitted', () => {
    const draft = createDraft('2026-09-11T18:00:00.000Z');

    const updated = addBlock(draft, undefined, 'straightSets');

    expect(updated.blocks).toHaveLength(1);
    expect(updated.blocks[0]?.name).toBeUndefined();
    expect(updated.blocks[0]?.type).toBe('straightSets');
  });

  it('appends a named block', () => {
    const draft = createDraft('2026-09-11T18:00:00.000Z');
    const updated = addBlock(draft, 'Squats', 'straightSets');
    expect(updated.blocks[0]?.name).toBe('Squats');
  });

  it('renameBlock updates the name, or clears it when omitted', () => {
    const draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      'Squats',
      'straightSets',
    );
    const blockId = draft.blocks[0]!.id;

    const renamed = renameBlock(draft, blockId, 'Accessories');
    expect(renamed.blocks[0]?.name).toBe('Accessories');

    const cleared = renameBlock(renamed, blockId, undefined);
    expect(cleared.blocks[0]?.name).toBeUndefined();
  });
});

describe('reorderBlockExercise/moveExerciseAcrossBlocks (FR-006)', () => {
  it('reorders an exercise entry within one block', () => {
    let draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      undefined,
      'straightSets',
    );
    const blockId = draft.blocks[0]!.id;
    // Explicit `blockId`: an explicitly created block (even unnamed) is
    // not `loose`, so a `blockId`-less add would open a fresh block of
    // its own here instead of joining this one (FR-2).
    draft = addExerciseEntry(draft, 'ex-1' as ExerciseId, blockId);
    draft = addExerciseEntry(draft, 'ex-2' as ExerciseId, blockId);
    const [first, second] = draft.blocks[0]!.exercises;

    const reordered = reorderBlockExercise(draft, blockId, 0, 1);

    expect(reordered.blocks[0]?.exercises.map((e) => e.id)).toEqual([
      second!.id,
      first!.id,
    ]);
  });

  it('moves an exercise entry from one block to another, preserving its sets', () => {
    let draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      undefined,
      'straightSets',
    );
    const fromBlockId = draft.blocks[0]!.id;
    draft = addExerciseEntry(draft, 'ex-1' as ExerciseId, fromBlockId);
    draft = addBlock(draft, undefined, 'straightSets');
    const toBlockId = draft.blocks[1]!.id;
    const entryId = draft.blocks[0]!.exercises[0]!.id;

    draft = addSet(
      draft,
      fromBlockId,
      entryId,
      {
        volume: { kind: 'reps', count: 5 },
        load: { kind: 'none' },
        setKind: 'working',
      },
      1000,
      undefined,
    );

    const moved = moveExerciseAcrossBlocks(
      draft,
      fromBlockId,
      entryId,
      toBlockId,
    );

    expect(moved.blocks[0]?.exercises).toHaveLength(0);
    expect(moved.blocks[1]?.exercises).toHaveLength(1);
    expect(moved.blocks[1]?.exercises[0]?.id).toBe(entryId);
    expect(moved.blocks[1]?.exercises[0]?.sets).toHaveLength(1);
  });
});

describe('findBlockIdForEntry (stale-block-id-after-move regression)', () => {
  it("finds the entry's current block, tracking a move rather than a block id captured earlier", () => {
    let draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      'A',
      'straightSets',
    );
    const fromBlockId = draft.blocks[0]!.id;
    draft = addExerciseEntry(draft, 'ex-1' as ExerciseId, fromBlockId);
    draft = addBlock(draft, 'B', 'straightSets');
    const toBlockId = draft.blocks[1]!.id;
    const entryId = draft.blocks[0]!.exercises[0]!.id;

    expect(findBlockIdForEntry(draft, entryId)).toBe(fromBlockId);

    const moved = moveExerciseAcrossBlocks(
      draft,
      fromBlockId,
      entryId,
      toBlockId,
    );

    expect(findBlockIdForEntry(moved, entryId)).toBe(toBlockId);
  });

  it('returns undefined for an id that resolves to no entry in any block', () => {
    const draft = createDraft('2026-09-11T18:00:00.000Z');
    expect(findBlockIdForEntry(draft, 'nonexistent')).toBeUndefined();
  });
});

describe('deleteBlock/deleteExerciseEntry/deleteSet (FR-004, FR-023)', () => {
  it('deleteBlock removes the block and returns an undo that restores it at its original index', () => {
    let draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      'A',
      'straightSets',
    );
    draft = addBlock(draft, 'B', 'straightSets');
    draft = addBlock(draft, 'C', 'straightSets');
    const blockBId = draft.blocks[1]!.id;

    const { draft: afterDelete, undo } = deleteBlock(draft, blockBId);

    expect(afterDelete.blocks.map((b) => b.name)).toEqual(['A', 'C']);
    expect(undo.kind).toBe('block');

    const restored = undo.restore(afterDelete);
    expect(restored.blocks.map((b) => b.name)).toEqual(['A', 'B', 'C']);
  });

  it('a session with zero blocks after deletion is valid (FR-017, Acceptance Scenario US2-5)', () => {
    const draft = addBlock(
      createDraft('2026-09-11T18:00:00.000Z'),
      undefined,
      'straightSets',
    );
    const { draft: afterDelete } = deleteBlock(draft, draft.blocks[0]!.id);
    expect(afterDelete.blocks).toEqual([]);
  });

  it('deleteExerciseEntry/deleteSet have the same restore-at-original-index contract', () => {
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
        volume: { kind: 'reps', count: 5 },
        load: { kind: 'none' },
        setKind: 'working',
      },
      1000,
      undefined,
    );
    const setId = draft.blocks[0]!.exercises[0]!.sets[0]!.id;

    const { draft: afterSetDelete, undo: setUndo } = deleteSet(
      draft,
      blockId,
      entryId,
      setId,
    );
    expect(afterSetDelete.blocks[0]?.exercises[0]?.sets).toEqual([]);
    const restoredSet = setUndo.restore(afterSetDelete);
    expect(restoredSet.blocks[0]?.exercises[0]?.sets[0]?.id).toBe(setId);

    const { draft: afterEntryDelete, undo: entryUndo } = deleteExerciseEntry(
      draft,
      blockId,
      entryId,
    );
    expect(afterEntryDelete.blocks[0]?.exercises).toEqual([]);
    const restoredEntry = entryUndo.restore(afterEntryDelete);
    expect(restoredEntry.blocks[0]?.exercises[0]?.id).toBe(entryId);
  });

  it('overlapping undo windows: block-undo does not resurrect a set already (pending-)deleted from inside it', () => {
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
        volume: { kind: 'reps', count: 5 },
        load: { kind: 'none' },
        setKind: 'working',
      },
      1000,
      undefined,
    );
    const setId = draft.blocks[0]!.exercises[0]!.sets[0]!.id;

    // The set is deleted first (its own undo window starts)...
    const { draft: afterSetDelete } = deleteSet(draft, blockId, entryId, setId);
    // ...then, before that window elapses, the containing block is deleted too.
    const { draft: afterBlockDelete, undo: blockUndo } = deleteBlock(
      afterSetDelete,
      blockId,
    );

    // Block-undo restores the block to exactly its state at block-deletion
    // time — the set stays deleted; the two timers are independent.
    const restoredBlock = blockUndo.restore(afterBlockDelete);
    expect(restoredBlock.blocks[0]?.exercises[0]?.sets).toEqual([]);
  });
});
