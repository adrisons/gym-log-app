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

  it('does not set justRegisteredWorkout merely because a set was recorded (ADR-0008)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    expect(useLoggingSession.getState().justRegisteredWorkout).toBe(false);

    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });

    expect(useLoggingSession.getState().justRegisteredWorkout).toBe(false);
  });

  it('sets justRegisteredWorkout only once registerWorkout succeeds, and initialize() resets it', async () => {
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

    await useLoggingSession.getState().registerWorkout();
    expect(useLoggingSession.getState().justRegisteredWorkout).toBe(true);

    await useLoggingSession.getState().initialize();
    expect(useLoggingSession.getState().justRegisteredWorkout).toBe(false);
  });

  it('clearJustRegisteredWorkout resets the flag without touching anything else', async () => {
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
    await useLoggingSession.getState().registerWorkout();
    expect(useLoggingSession.getState().justRegisteredWorkout).toBe(true);

    useLoggingSession.getState().clearJustRegisteredWorkout();

    expect(useLoggingSession.getState().justRegisteredWorkout).toBe(false);
  });
});

describe('useLoggingSession pending draft (FR-024, FR-027, FR-028; ADR-0008)', () => {
  it('starts empty and unpersisted; nothing is stored until the draft has a block', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

    expect(useLoggingSession.getState().pendingDraft).toBeUndefined();
    expect(await storage.getDraft()).toBeUndefined();

    await useLoggingSession
      .getState()
      .setSessionDateTime('2026-09-11T09:00:00.000Z');
    expect(await storage.getDraft()).toBeUndefined(); // date-only edit persists nothing
  });

  it('persists the draft once it gains a block, and offers it as pendingDraft on the next initialize()', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

    await useLoggingSession.getState().addBlock(undefined, 'straightSets');
    expect(await storage.getDraft()).toBeDefined();

    await useLoggingSession.getState().initialize();
    expect(useLoggingSession.getState().draft!.blocks).toEqual([]);
    expect(useLoggingSession.getState().pendingDraft?.blocks).toHaveLength(1);
  });

  it('addBlock/addExerciseEntry/addSet are no-ops while a pendingDraft is unresolved', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock(undefined, 'straightSets');
    await useLoggingSession.getState().initialize(); // re-open: now offers a pendingDraft

    expect(useLoggingSession.getState().pendingDraft).toBeDefined();

    await useLoggingSession.getState().addBlock('New', 'straightSets');
    expect(useLoggingSession.getState().draft!.blocks).toEqual([]);

    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    expect(useLoggingSession.getState().draft!.blocks).toEqual([]);
  });

  it('recoverPendingDraft loads the pending draft as the active one and clears the banner', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('Legs', 'straightSets');
    const savedId = useLoggingSession.getState().draft!.id;
    await useLoggingSession.getState().initialize();

    useLoggingSession.getState().recoverPendingDraft();

    expect(useLoggingSession.getState().pendingDraft).toBeUndefined();
    expect(useLoggingSession.getState().draft!.id).toBe(savedId);
    expect(useLoggingSession.getState().draft!.blocks[0]?.name).toBe('Legs');
  });

  it('discardPendingDraft removes it from storage and leaves the active draft untouched', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('Legs', 'straightSets');
    await useLoggingSession.getState().initialize();
    const activeId = useLoggingSession.getState().draft!.id;

    await useLoggingSession.getState().discardPendingDraft();

    expect(useLoggingSession.getState().pendingDraft).toBeUndefined();
    expect(await storage.getDraft()).toBeUndefined();
    expect(useLoggingSession.getState().draft!.id).toBe(activeId);
    expect(useLoggingSession.getState().draft!.blocks).toEqual([]);
  });
});

describe('useLoggingSession registerWorkout (FR-027; ADR-0008)', () => {
  it('is a no-op while the active draft has no block', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    const before = useLoggingSession.getState().draft;

    await useLoggingSession.getState().registerWorkout();

    expect(useLoggingSession.getState().draft).toBe(before);
    expect(
      await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
    ).toEqual([]);
  });

  it('converts the draft to a Session and resets the active draft to a fresh, empty, unpersisted one', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock(undefined, 'straightSets');
    const draftId = useLoggingSession.getState().draft!.id;

    await useLoggingSession.getState().registerWorkout();

    expect(useLoggingSession.getState().draft!.id).not.toBe(draftId);
    expect(useLoggingSession.getState().draft!.blocks).toEqual([]);
    expect(await storage.getDraft()).toBeUndefined();
    const sessions = await storage.listSessions({
      from: '2000-01-01',
      to: '2100-01-01',
    });
    expect(sessions).toHaveLength(1);
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
