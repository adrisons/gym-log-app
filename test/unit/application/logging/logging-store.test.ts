import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage } from '../../../support';
import { useLoggingSession } from '@/application/logging/logging-store';
import type { ExerciseId } from '@/domain/ids';

// Foundational: `initialize` only. Undo-stack behavior (T062) is US2's.

describe('useLoggingSession (research.md §5)', () => {
  it('starts with no draft and an empty undo stack', () => {
    const state = useLoggingSession.getState();
    expect(state.draft).toBeUndefined();
    expect(state.undoStack).toEqual([]);
  });

  it('initialize populates draft from openLoggingForm, once configured with a storage', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    const state = useLoggingSession.getState();
    expect(state.draft).toBeDefined();
    expect(state.draft?.blocks).toEqual([]);
  });

  it('does not clobber a draft mutated by a debounced commit while initialize() is still reading (Copilot review, PR #22)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;

    // Delay one of initialize()'s parallel reads so a concurrent commit —
    // simulating ADR-0007's debounce timer, deliberately not cancelled on
    // unmount — can land on `draft` while this (re-)initialize's own reads
    // are still in flight, as on a route remount before the previous
    // visit's pending commit has fired.
    let releaseRead = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const originalListExercises = storage.listExercises.bind(storage);
    vi.spyOn(storage, 'listExercises').mockImplementation(async () => {
      await gate;
      return originalListExercises();
    });

    const initializePromise = useLoggingSession.getState().initialize();

    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const committedSetId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets[0]!.id;

    releaseRead();
    await initializePromise;

    const finalSets =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets;
    expect(finalSets.map((s) => s.id)).toContain(committedSetId);
  });

  it("waits out a draft write already in flight before trusting its own storage read, even when nothing further mutates draft during initialize()'s own reads (Copilot review, PR #22)", async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;

    // Gate `saveDraft` itself (not a read) so the committed set is applied
    // to Zustand's `draft` optimistically — before initialize() even
    // starts — while its own persistence to storage is still pending, as
    // ADR-0007's debounce timer firing just before a route remount would.
    let releaseWrite = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const originalSaveDraft = storage.saveDraft.bind(storage);
    vi.spyOn(storage, 'saveDraft').mockImplementation(async (draft) => {
      await gate;
      return originalSaveDraft(draft);
    });

    const addSetPromise = useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const committedSetId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets[0]!.id;

    // initialize() starts while the write above is still gated — with no
    // further mutation during its own reads, only waiting out that
    // already-in-flight write (not the before/after identity check alone)
    // keeps its `openLoggingForm` read from racing storage.saveDraft and
    // returning the pre-write snapshot.
    const initializePromise = useLoggingSession.getState().initialize();

    releaseWrite();
    await addSetPromise;
    await initializePromise;

    const finalSets =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets;
    expect(finalSets.map((s) => s.id)).toContain(committedSetId);
  });

  it('a rejected draft write does not permanently break later initialize()/persistDraft calls (Copilot review, PR #22)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;

    const saveDraftSpy = vi
      .spyOn(storage, 'saveDraft')
      .mockImplementationOnce(() =>
        Promise.reject(new Error('simulated storage failure')),
      );

    // The failing call's own caller still sees the rejection...
    await expect(
      useLoggingSession.getState().addSet(entryId, {
        volume: { kind: 'reps', count: 8 },
        load: { kind: 'none' },
        setKind: 'working',
      }),
    ).rejects.toThrow('simulated storage failure');

    saveDraftSpy.mockRestore();

    // ...but the shared write queue itself must not stay poisoned by it —
    // otherwise every later persistDraft/initialize() call would await a
    // permanently rejected promise instead of the app's own next action.
    await expect(
      useLoggingSession.getState().initialize(),
    ).resolves.toBeUndefined();
    expect(useLoggingSession.getState().draft).toBeDefined();

    await expect(
      useLoggingSession.getState().addExerciseEntry('ex-2' as ExerciseId),
    ).resolves.toBeUndefined();
  });
});

describe('useLoggingSession undo stack (FR-004, FR-023)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushing an UndoEntry makes it available for 5000ms, then it expires', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('A', 'straightSets');
    const blockId = useLoggingSession.getState().draft!.blocks[0]!.id;

    await useLoggingSession.getState().deleteBlock(blockId);
    expect(useLoggingSession.getState().undoStack).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(useLoggingSession.getState().undoStack).toHaveLength(0);
  });

  it('undo before expiry restores the item and removes the entry', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('A', 'straightSets');
    const blockId = useLoggingSession.getState().draft!.blocks[0]!.id;

    await useLoggingSession.getState().deleteBlock(blockId);
    expect(useLoggingSession.getState().draft!.blocks).toHaveLength(0);

    await useLoggingSession.getState().undo(blockId);

    expect(useLoggingSession.getState().draft!.blocks).toHaveLength(1);
    expect(useLoggingSession.getState().undoStack).toEqual([]);
  });

  it('calling undo after expiry is a no-op', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('A', 'straightSets');
    const blockId = useLoggingSession.getState().draft!.blocks[0]!.id;

    await useLoggingSession.getState().deleteBlock(blockId);
    await vi.advanceTimersByTimeAsync(5000);

    await useLoggingSession.getState().undo(blockId);

    expect(useLoggingSession.getState().draft!.blocks).toHaveLength(0);
  });

  it('two independent undo entries coexist: restoring the block does not resurrect an already-deleted set inside it', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const blockId = useLoggingSession.getState().draft!.blocks[0]!.id;
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const setId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets[0]!.id;

    await useLoggingSession.getState().deleteSet(blockId, entryId, setId);
    await useLoggingSession.getState().deleteBlock(blockId);
    expect(useLoggingSession.getState().undoStack).toHaveLength(2);

    await useLoggingSession.getState().undo(blockId);

    const restoredEntry =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!;
    expect(restoredEntry.sets).toEqual([]);
    expect(useLoggingSession.getState().undoStack).toHaveLength(1);
  });
});

describe('useLoggingSession.addSet (ADR-0007 debounce / stale-block-id regression)', () => {
  it("resolves the entry's current block by id, not one the caller might have had in mind before a move", async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('A', 'straightSets');
    await useLoggingSession.getState().addBlock('B', 'straightSets');
    const blockA = useLoggingSession.getState().draft!.blocks[0]!.id;
    const blockB = useLoggingSession.getState().draft!.blocks[1]!.id;
    await useLoggingSession
      .getState()
      .addExerciseEntry('ex-1' as ExerciseId, blockA);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;

    // Simulates a commit that was scheduled while the entry lived in
    // block A, but only actually fires (this call) after the entry has
    // since been moved to block B — the exact ADR-0007 debounce-vs-move
    // race a fixed-at-schedule-time block id would get wrong.
    await useLoggingSession
      .getState()
      .moveExerciseAcrossBlocks(blockA, entryId, blockB);
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });

    const draft = useLoggingSession.getState().draft!;
    expect(draft.blocks[0]!.exercises).toHaveLength(0);
    expect(draft.blocks[1]!.exercises[0]!.sets).toHaveLength(1);
  });

  it('is a no-op when the entry no longer resolves to any block (deleted in the meantime)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const blockId = useLoggingSession.getState().draft!.blocks[0]!.id;
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;

    await useLoggingSession.getState().deleteExerciseEntry(blockId, entryId);

    await expect(
      useLoggingSession.getState().addSet(entryId, {
        volume: { kind: 'reps', count: 8 },
        load: { kind: 'none' },
        setKind: 'working',
      }),
    ).resolves.toBeUndefined();
  });

  it('sets justLoggedASet only once a set is actually recorded, and initialize() resets it', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    expect(useLoggingSession.getState().justLoggedASet).toBe(false);

    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });

    expect(useLoggingSession.getState().justLoggedASet).toBe(true);

    await useLoggingSession.getState().initialize();
    expect(useLoggingSession.getState().justLoggedASet).toBe(false);
  });

  it('lastAddedSetId tracks whichever set was most recently committed, and resets on initialize() (PR #22 Copilot review — set-summary-enter animation scope)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    expect(useLoggingSession.getState().lastAddedSetId).toBeUndefined();

    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const firstSetId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets[0]!.id;
    expect(useLoggingSession.getState().lastAddedSetId).toBe(firstSetId);

    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const sets =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets;
    expect(sets).toHaveLength(2);
    // The marker moves to the newest set, not the one committed earlier.
    expect(useLoggingSession.getState().lastAddedSetId).toBe(sets[1]!.id);
    expect(useLoggingSession.getState().lastAddedSetId).not.toBe(firstSetId);

    await useLoggingSession.getState().initialize();
    expect(useLoggingSession.getState().lastAddedSetId).toBeUndefined();
  });

  it('clearLastAddedSetId resets the marker without touching the draft (Copilot review, PR #22)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    expect(useLoggingSession.getState().lastAddedSetId).toBeDefined();

    useLoggingSession.getState().clearLastAddedSetId();

    expect(useLoggingSession.getState().lastAddedSetId).toBeUndefined();
    expect(
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets,
    ).toHaveLength(1);
  });

  it('deleting the marked set clears lastAddedSetId, so undoing that same delete does not replay its entrance animation (Copilot review, PR #22)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const blockId = useLoggingSession.getState().draft!.blocks[0]!.id;
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const setId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets[0]!.id;
    expect(useLoggingSession.getState().lastAddedSetId).toBe(setId);

    await useLoggingSession.getState().deleteSet(blockId, entryId, setId);
    expect(useLoggingSession.getState().lastAddedSetId).toBeUndefined();

    await useLoggingSession.getState().undo(setId);
    // The undo restores a set with the same id, but it is no longer the
    // one that was actually just logged — the marker must stay cleared.
    expect(
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets,
    ).toHaveLength(1);
    expect(useLoggingSession.getState().lastAddedSetId).toBeUndefined();
  });

  it('deleting an unrelated set leaves lastAddedSetId pointing at the still-present marked set', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const blockId = useLoggingSession.getState().draft!.blocks[0]!.id;
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const firstSetId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    const secondSetId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets[1]!.id;
    expect(useLoggingSession.getState().lastAddedSetId).toBe(secondSetId);

    await useLoggingSession.getState().deleteSet(blockId, entryId, firstSetId);

    expect(useLoggingSession.getState().lastAddedSetId).toBe(secondSetId);
  });

  it('clearJustLoggedASet resets the flag without touching anything else', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    expect(useLoggingSession.getState().justLoggedASet).toBe(true);

    useLoggingSession.getState().clearJustLoggedASet();

    expect(useLoggingSession.getState().justLoggedASet).toBe(false);
    expect(
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.sets,
    ).toHaveLength(1);
  });
});

describe('useLoggingSession.updateExerciseTemplate (docs/requirements.md §7.1)', () => {
  it('rolls the optimistic catalogue update back when the storage write fails (failed-template-save regression)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    const original = {
      id: exerciseId,
      canonicalName: 'Back squat',
      aliases: [],
      defaultLoadType: 'weight' as const,
      defaultVolumeKind: 'reps' as const,
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength' as const,
    };
    await storage.saveExercise(original);
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

    const failure = new Error('disk full');
    storage.saveExercise = vi.fn().mockRejectedValue(failure);

    await expect(
      useLoggingSession.getState().updateExerciseTemplate(exerciseId, {
        defaultLoadType: 'weight',
        defaultVolumeKind: 'reps',
        trackEffort: true,
      }),
    ).rejects.toThrow(failure);

    // Storage never got the new template — the in-memory catalogue must
    // match it exactly, not the optimistic (now-abandoned) update.
    const catalogueEntry = useLoggingSession
      .getState()
      .catalogue.find((e) => e.id === exerciseId);
    expect(catalogueEntry?.trackEffort).toBe(false);
  });

  it('a rollback undoes only its own exercise, never a different one added while the write was pending (concurrent-update regression)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    const original = {
      id: exerciseId,
      canonicalName: 'Back squat',
      aliases: [],
      defaultLoadType: 'weight' as const,
      defaultVolumeKind: 'reps' as const,
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength' as const,
    };
    await storage.saveExercise(original);
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

    const realSaveExercise = storage.saveExercise.bind(storage);
    let rejectTemplateWrite: (error: Error) => void;
    const pendingTemplateWrite = new Promise<void>((_, reject) => {
      rejectTemplateWrite = reject;
    });
    storage.saveExercise = vi.fn((exercise) =>
      exercise.id === exerciseId
        ? pendingTemplateWrite
        : realSaveExercise(exercise),
    );

    const templateUpdate = useLoggingSession
      .getState()
      .updateExerciseTemplate(exerciseId, {
        defaultLoadType: 'weight',
        defaultVolumeKind: 'reps',
        trackEffort: true,
      });

    // A second, unrelated exercise is fully created — and lands in the
    // catalogue — while the template write above is still pending.
    const created = await useLoggingSession
      .getState()
      .createExercise({ canonicalName: 'Bench press' });
    expect(
      useLoggingSession.getState().catalogue.some((e) => e.id === created.id),
    ).toBe(true);

    rejectTemplateWrite!(new Error('disk full'));
    await expect(templateUpdate).rejects.toThrow('disk full');

    // The failed template write's rollback must undo only its own
    // exercise, not the whole catalogue snapshot it started from — which
    // predates (and therefore lacks) the concurrently created exercise.
    const catalogue = useLoggingSession.getState().catalogue;
    expect(catalogue.some((e) => e.id === created.id)).toBe(true);
    expect(catalogue.find((e) => e.id === exerciseId)?.trackEffort).toBe(false);
  });
});

describe('useLoggingSession.mergeExercises (Copilot review, PR #22)', () => {
  it('queues a concurrent draft write behind an in-flight merge, instead of letting it land unordered against the merge’s own draft rewrite', async () => {
    const storage = new InMemoryStorage();
    const survivorId = 'ex-survivor' as ExerciseId;
    const loserId = 'ex-loser' as ExerciseId;
    await storage.saveExercise({
      id: survivorId,
      canonicalName: 'Back squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await storage.saveExercise({
      id: loserId,
      canonicalName: 'Barbell squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

    let releaseMerge = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseMerge = resolve;
    });
    const originalMergeExercises = storage.mergeExercises.bind(storage);
    vi.spyOn(storage, 'mergeExercises').mockImplementation(async (a, b) => {
      await gate;
      return originalMergeExercises(a, b);
    });

    const mergePromise = useLoggingSession
      .getState()
      .mergeExercises(survivorId, loserId);

    let addExerciseEntryResolved = false;
    const addExerciseEntryPromise = useLoggingSession
      .getState()
      .addExerciseEntry(survivorId)
      .then(() => {
        addExerciseEntryResolved = true;
      });

    // Give any not-actually-queued microtasks a chance to run — if
    // `addExerciseEntry` weren't queued behind the gated merge, its own
    // (ungated) storage write would have already resolved by now.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(addExerciseEntryResolved).toBe(false);

    releaseMerge();
    await mergePromise;
    await addExerciseEntryPromise;

    expect(addExerciseEntryResolved).toBe(true);
    expect(
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.exerciseId,
    ).toBe(survivorId);
  });
});
