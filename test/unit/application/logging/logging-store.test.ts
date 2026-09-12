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
    await useLoggingSession.getState().addSet(blockId, entryId, {
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
