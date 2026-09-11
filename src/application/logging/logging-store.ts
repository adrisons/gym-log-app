/**
 * The logging session's view-facing state — the draft, the exercise
 * catalogue/session cache used for search ranking, the 5-second undo
 * stack (FR-004/FR-023, added by US2), and the confirm-debounce guard
 * (FR-025). Zustand (research.md §5), living at the application layer per
 * `docs/architecture.md`'s "session state, view models" — `presentation/`
 * only ever renders from and dispatches to this store, never holds this
 * logic itself.
 *
 * The `StoragePort` itself is held in this store's own state, set once by
 * the composition root via `configure(storage)` before the screen first
 * renders — never threaded through component props. `presentation/` must
 * never see a persistence type at all (`docs/architecture.md`'s table:
 * `presentation` may import only `application`/`presentation-design`, not
 * `application-ports`); every action below reads `get().storage` itself
 * instead of taking it as a parameter, so no component ever needs to name
 * `StoragePort` to call one.
 *
 * Every mutating action applies its draft change to `draft` optimistically
 * *before* calling `storage.saveDraft` (constitution Principle II) — the
 * persistence call is fire-and-forget-then-confirm, never awaited before
 * the UI reflects the change.
 */

import { create } from 'zustand';
import type {
  StoragePort,
  LoggingDraft,
} from '@/application/ports/storage-port';
import type { Exercise } from '@/domain/exercise';
import type { Session } from '@/domain/session';
import type { ExerciseId } from '@/domain/ids';
import {
  openLoggingForm,
  searchExercises as searchExercisesUseCase,
  createExercise as createExerciseUseCase,
  recordLoadTypeDefault as recordLoadTypeDefaultUseCase,
  suggestFreeTextLoads as suggestFreeTextLoadsUseCase,
  saveBandLabels as saveBandLabelsUseCase,
  renameExerciseWithCollisionCheck as renameExerciseWithCollisionCheckUseCase,
  mergeExercises as mergeExercisesUseCase,
  deleteExerciseCascade as deleteExerciseCascadeUseCase,
} from '@/application/logging/use-cases';
import type {
  CreateExerciseInput,
  RenameExerciseResult,
} from '@/application/logging/use-cases';
import type { Load } from '@/domain/load';
import {
  addExerciseEntry as addExerciseEntryToDraft,
  addSet as addSetToDraft,
  prefillNextSet as prefillNextSetFromDraft,
  addBlock as addBlockToDraft,
  renameBlock as renameBlockInDraft,
  reorderBlockExercise as reorderBlockExerciseInDraft,
  moveExerciseAcrossBlocks as moveExerciseAcrossBlocksInDraft,
  deleteBlock as deleteBlockFromDraft,
  deleteExerciseEntry as deleteExerciseEntryFromDraft,
  deleteSet as deleteSetFromDraft,
} from '@/application/logging/draft';
import type {
  AddSetInput,
  SetPrefill,
  DraftBlock,
  UndoEntry,
  DeleteResult,
} from '@/application/logging/draft';

export type { UndoEntry };

const FULL_RANGE = {
  from: '0000-01-01T00:00:00.000Z',
  to: '9999-12-31T23:59:59.999Z',
};

function touch(draft: LoggingDraft): LoggingDraft {
  return { ...draft, lastEditedAt: new Date().toISOString() };
}

export interface LoggingSessionState {
  storage: StoragePort | undefined;
  draft: LoggingDraft | undefined;
  undoStack: UndoEntry[];
  catalogue: Exercise[];
  sessions: Session[];
  bandLabels: string[];
  /** entryId → ms epoch of the last confirmed set on that entry (FR-025). */
  lastConfirmedAt: Record<string, number>;

  /** Called once by the composition root before the screen first renders. */
  configure: (storage: StoragePort) => void;
  initialize: () => Promise<void>;
  setSessionDateTime: (iso: string) => Promise<void>;
  addExerciseEntry: (exerciseId: ExerciseId) => Promise<void>;
  addSet: (
    blockId: string,
    entryId: string,
    input: AddSetInput,
  ) => Promise<void>;
  prefillNextSet: (blockId: string, entryId: string) => SetPrefill | undefined;
  searchExercises: (query: string) => Exercise[];
  createExercise: (input: CreateExerciseInput) => Promise<Exercise>;
  recordLoadTypeDefault: (
    exerciseId: ExerciseId,
    loadType: Load['kind'],
  ) => Promise<void>;
  suggestFreeTextLoads: (exerciseId: ExerciseId) => string[];
  saveBandLabels: (labels: string[]) => Promise<void>;
  addBlock: (
    name: string | undefined,
    type: DraftBlock['type'],
  ) => Promise<void>;
  renameBlock: (blockId: string, name: string | undefined) => Promise<void>;
  reorderBlockExercise: (
    blockId: string,
    fromIndex: number,
    toIndex: number,
  ) => Promise<void>;
  moveExerciseAcrossBlocks: (
    fromBlockId: string,
    entryId: string,
    toBlockId: string,
    toIndex?: number,
  ) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  deleteExerciseEntry: (blockId: string, entryId: string) => Promise<void>;
  deleteSet: (blockId: string, entryId: string, setId: string) => Promise<void>;
  undo: (id: string) => Promise<void>;
  renameExerciseWithCollisionCheck: (
    exerciseId: ExerciseId,
    newName: string,
  ) => Promise<RenameExerciseResult>;
  mergeExercises: (
    survivorId: ExerciseId,
    loserId: ExerciseId,
  ) => Promise<void>;
  deleteExerciseCascade: (
    exerciseId: ExerciseId,
    hasHistory: boolean,
    confirmed: boolean,
  ) => Promise<void>;
}

export const useLoggingSession = create<LoggingSessionState>((set, get) => {
  /**
   * Shared by `deleteBlock`/`deleteExerciseEntry`/`deleteSet`: applies the
   * draft change immediately (Principle II — never held pending), persists
   * it, pushes the resulting `UndoEntry`, and schedules its own removal
   * from `undoStack` once its 5-second window elapses (FR-004/FR-023).
   */
  const applyDelete = async (
    operation: (draft: LoggingDraft) => DeleteResult,
  ): Promise<void> => {
    const { storage, draft: current } = get();
    if (!storage || !current) return;
    const { draft: updated, undo: undoEntry } = operation(current);
    if (updated === current) return; // id didn't resolve — noopUndo, nothing to push
    const touched = touch(updated);
    set((state) => ({
      draft: touched,
      undoStack: [...state.undoStack, undoEntry],
    }));
    await storage.saveDraft(touched);
    setTimeout(
      () => {
        set((state) => ({
          undoStack: state.undoStack.filter((e) => e.id !== undoEntry.id),
        }));
      },
      Math.max(0, undoEntry.expiresAt - Date.now()),
    );
  };

  return {
    storage: undefined,
    draft: undefined,
    undoStack: [],
    catalogue: [],
    sessions: [],
    bandLabels: [],
    lastConfirmedAt: {},

    configure: (storage) => set({ storage }),

    initialize: async () => {
      const { storage } = get();
      if (!storage) return;
      const [draft, catalogue, sessions, bandLabels] = await Promise.all([
        openLoggingForm(storage),
        storage.listExercises(),
        storage.listSessions(FULL_RANGE),
        storage.listBandLabels(),
      ]);
      set({ draft, catalogue, sessions, bandLabels });
    },

    setSessionDateTime: async (iso) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch({ ...current, dateTime: iso });
      set({ draft: updated });
      await storage.saveDraft(updated);
    },

    addExerciseEntry: async (exerciseId) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(addExerciseEntryToDraft(current, exerciseId));
      set({ draft: updated });
      await storage.saveDraft(updated);
    },

    addSet: async (blockId, entryId, input) => {
      const { storage, draft: current, lastConfirmedAt } = get();
      if (!storage || !current) return;
      const nowMs = Date.now();
      const lastConfirmedAtMs = lastConfirmedAt[entryId];
      const result = addSetToDraft(
        current,
        blockId,
        entryId,
        input,
        nowMs,
        lastConfirmedAtMs,
      );
      if (result === current) return; // FR-025: debounced no-op

      const updated = touch(result);
      set((state) => ({
        draft: updated,
        lastConfirmedAt: { ...state.lastConfirmedAt, [entryId]: nowMs },
      }));
      await storage.saveDraft(updated);
    },

    prefillNextSet: (blockId, entryId) => {
      const current = get().draft;
      if (!current) return undefined;
      return prefillNextSetFromDraft(current, blockId, entryId);
    },

    searchExercises: (query) => {
      const { catalogue, sessions } = get();
      return searchExercisesUseCase(query, catalogue, sessions);
    },

    createExercise: async (input) => {
      const { storage } = get();
      if (!storage) throw new Error('useLoggingSession: not configured yet.');
      const exercise = await createExerciseUseCase(storage, input);
      set((state) => ({ catalogue: [...state.catalogue, exercise] }));
      return exercise;
    },

    recordLoadTypeDefault: async (exerciseId, loadType) => {
      const { storage } = get();
      if (!storage) return;
      await recordLoadTypeDefaultUseCase(storage, exerciseId, loadType);
      set((state) => ({
        catalogue: state.catalogue.map((exercise) =>
          exercise.id === exerciseId
            ? { ...exercise, defaultLoadType: loadType }
            : exercise,
        ),
      }));
    },

    suggestFreeTextLoads: (exerciseId) => {
      const { sessions } = get();
      return suggestFreeTextLoadsUseCase(exerciseId, sessions);
    },

    saveBandLabels: async (labels) => {
      const { storage } = get();
      if (!storage) return;
      set({ bandLabels: labels });
      await saveBandLabelsUseCase(storage, labels);
    },

    addBlock: async (name, type) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(addBlockToDraft(current, name, type));
      set({ draft: updated });
      await storage.saveDraft(updated);
    },

    renameBlock: async (blockId, name) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(renameBlockInDraft(current, blockId, name));
      set({ draft: updated });
      await storage.saveDraft(updated);
    },

    reorderBlockExercise: async (blockId, fromIndex, toIndex) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(
        reorderBlockExerciseInDraft(current, blockId, fromIndex, toIndex),
      );
      set({ draft: updated });
      await storage.saveDraft(updated);
    },

    moveExerciseAcrossBlocks: async (
      fromBlockId,
      entryId,
      toBlockId,
      toIndex,
    ) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(
        moveExerciseAcrossBlocksInDraft(
          current,
          fromBlockId,
          entryId,
          toBlockId,
          toIndex,
        ),
      );
      set({ draft: updated });
      await storage.saveDraft(updated);
    },

    deleteBlock: async (blockId) => {
      await applyDelete((draft) => deleteBlockFromDraft(draft, blockId));
    },

    deleteExerciseEntry: async (blockId, entryId) => {
      await applyDelete((draft) =>
        deleteExerciseEntryFromDraft(draft, blockId, entryId),
      );
    },

    deleteSet: async (blockId, entryId, setId) => {
      await applyDelete((draft) =>
        deleteSetFromDraft(draft, blockId, entryId, setId),
      );
    },

    undo: async (id) => {
      const { storage, draft: current, undoStack } = get();
      const entry = undoStack.find((e) => e.id === id);
      if (!storage || !current || !entry) return;
      const restored = touch(entry.restore(current));
      set((state) => ({
        draft: restored,
        undoStack: state.undoStack.filter((e) => e.id !== id),
      }));
      await storage.saveDraft(restored);
    },

    renameExerciseWithCollisionCheck: async (exerciseId, newName) => {
      const { storage } = get();
      if (!storage) {
        throw new Error('useLoggingSession: not configured yet.');
      }
      const result = await renameExerciseWithCollisionCheckUseCase(
        storage,
        exerciseId,
        newName,
      );
      if (result.status === 'renamed') {
        set((state) => ({
          catalogue: state.catalogue.map((exercise) =>
            exercise.id === exerciseId ? result.exercise : exercise,
          ),
        }));
      }
      return result;
    },

    // Merge/cascade-delete repoint or prune the stored draft too
    // (contracts/storage-port-extension.md §1) — this store's own
    // in-memory `draft` copy is stale once that happens server-side, so
    // both actions re-fetch draft + catalogue from storage afterward
    // rather than trying to replicate the repoint/prune logic locally.
    mergeExercises: async (survivorId, loserId) => {
      const { storage } = get();
      if (!storage) return;
      await mergeExercisesUseCase(storage, survivorId, loserId);
      const [draft, catalogue] = await Promise.all([
        storage.getDraft(),
        storage.listExercises(),
      ]);
      set({ draft, catalogue });
    },

    deleteExerciseCascade: async (exerciseId, hasHistory, confirmed) => {
      const { storage } = get();
      if (!storage) return;
      await deleteExerciseCascadeUseCase(
        storage,
        exerciseId,
        hasHistory,
        confirmed,
      );
      const [draft, catalogue] = await Promise.all([
        storage.getDraft(),
        storage.listExercises(),
      ]);
      set({ draft, catalogue });
    },
  };
});
