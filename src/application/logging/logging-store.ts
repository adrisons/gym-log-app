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
  registerWorkout as registerWorkoutUseCase,
  searchExercises as searchExercisesUseCase,
  createExercise as createExerciseUseCase,
  updateExerciseTemplate as updateExerciseTemplateUseCase,
  suggestFreeTextLoads as suggestFreeTextLoadsUseCase,
  saveBandLabels as saveBandLabelsUseCase,
  renameExerciseWithCollisionCheck as renameExerciseWithCollisionCheckUseCase,
  mergeExercises as mergeExercisesUseCase,
  deleteExerciseCascade as deleteExerciseCascadeUseCase,
} from '@/application/logging/use-cases';
import type {
  CreateExerciseInput,
  RenameExerciseResult,
  ExerciseTemplate,
} from '@/application/logging/use-cases';
import {
  addExerciseEntry as addExerciseEntryToDraft,
  addSet as addSetToDraft,
  updateSet as updateSetInDraft,
  findBlockIdForEntry,
  prefillNextSet as prefillNextSetFromDraft,
  addBlock as addBlockToDraft,
  renameBlock as renameBlockInDraft,
  setBlockRounds as setBlockRoundsInDraft,
  reorderBlockExercise as reorderBlockExerciseInDraft,
  moveExerciseAcrossBlocks as moveExerciseAcrossBlocksInDraft,
  deleteBlock as deleteBlockFromDraft,
  deleteExerciseEntry as deleteExerciseEntryFromDraft,
  deleteSet as deleteSetFromDraft,
  draftHasContent,
  repointDraftExerciseId,
  pruneDraftExerciseId,
} from '@/application/logging/draft';
import type {
  AddSetInput,
  SetPrefill,
  DraftBlock,
  UndoEntry,
  DeleteResult,
} from '@/application/logging/draft';

export { draftHasContent };

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
  /** FR-028 (ADR-0009): a draft found already stored when the form was
   * opened, offered as a recovery banner — never auto-loaded into `draft`.
   * `undefined` once resolved (recovered or discarded) or when none was
   * stored to begin with. Adding a block, exercise, or set to `draft` is
   * refused by this store while this is set (see `addBlock`/
   * `addExerciseEntry`/`addSet`), so an unresolved pending draft can never
   * be silently overwritten by unrelated new input. */
  pendingDraft: LoggingDraft | undefined;
  undoStack: UndoEntry[];
  catalogue: Exercise[];
  sessions: Session[];
  bandLabels: string[];
  /** entryId → ms epoch of the last confirmed set on that entry (FR-025). */
  lastConfirmedAt: Record<string, number>;
  /** Set true only by `registerWorkout`'s success (ADR-0009) — the one
   * reliable signal for "this visit registered a workout", which
   * `DiaryScreen`'s save-acknowledgement toast reads once and clears
   * (`clearJustRegisteredWorkout`). Recording a set no longer sets this on
   * its own: a set can be safely recorded in a draft for a long time
   * before (or without ever) being registered as a Session. */
  justRegisteredWorkout: boolean;
  /** The id of the set `addSet` most recently appended — `undefined` once
   * consumed or before any set has been added this visit. `LoggingScreen`
   * reads this once per commit to mark only that one `.set-summary` row
   * for the entrance animation, not every row already on screen, and
   * clears it itself (`clearLastAddedSetId`) once that one animation has
   * had time to play — left set indefinitely, a later, unrelated remount
   * of the same route (or a delete-then-undo restoring a set under its
   * original id) would replay the animation for a row that isn't actually
   * new anymore (Copilot review, PR #22). */
  lastAddedSetId: string | undefined;

  /** Called once by the composition root before the screen first renders. */
  configure: (storage: StoragePort) => void;
  initialize: () => Promise<void>;
  setSessionDateTime: (iso: string) => Promise<void>;
  /** FR-028: a no-op while `pendingDraft` is set — the user must recover or
   * discard it first. */
  addExerciseEntry: (exerciseId: ExerciseId, blockId?: string) => Promise<void>;
  /** Resolves the entry's *current* block itself (entry ids are globally
   * unique — `findBlockIdForEntry`), rather than taking one from the
   * caller: a caller that scheduled this call before the entry was moved
   * to a different block (`moveExerciseAcrossBlocks`) would otherwise bake
   * in a block id the entry no longer lives under by the time a debounced
   * commit (ADR-0007) actually fires. A no-op if the entry no longer
   * resolves to any block at all (deleted in the meantime), or while
   * `pendingDraft` is set (FR-028). */
  addSet: (entryId: string, input: AddSetInput) => Promise<void>;
  /** ADR-0010: edits an already-recorded set in place, resolving the
   * entry's *current* block the same way `addSet` does (`findBlockIdForEntry`).
   * A no-op if the entry no longer resolves to any block, or while
   * `pendingDraft` is set (FR-028). No debounce — this is always an
   * explicit, single confirm-button tap, not an edit-triggered auto-commit. */
  updateSet: (
    entryId: string,
    setId: string,
    input: AddSetInput,
  ) => Promise<void>;
  clearJustRegisteredWorkout: () => void;
  clearLastAddedSetId: () => void;
  /** FR-028: loads `pendingDraft` as the active `draft` and clears it,
   * queued against `discardPendingDraft` (below) so whichever of the two
   * runs first wins and the other becomes a no-op — never both. A no-op
   * if there is none. */
  recoverPendingDraft: () => Promise<void>;
  /** FR-028: removes `pendingDraft` from storage and clears it, leaving the
   * active `draft` untouched; queued against `recoverPendingDraft` (same
   * reason). A no-op if there is none. */
  discardPendingDraft: () => Promise<void>;
  /** FR-027: the only way a Session is created from this screen. Queued
   * behind any outstanding draft write and re-checks the active draft's
   * identity once its turn comes up, so a debounced commit still in
   * flight can't be resurrected by this call, and a double-tap can't
   * register the same draft twice (Copilot review, PR #25). A no-op
   * while the active draft has no block at all (`draftHasContent`) —
   * callers/UI must not offer this control until then, per FR-019's
   * "unavailable rather than rejected" convention. */
  registerWorkout: () => Promise<void>;
  prefillNextSet: (blockId: string, entryId: string) => SetPrefill | undefined;
  searchExercises: (query: string) => Exercise[];
  createExercise: (input: CreateExerciseInput) => Promise<Exercise>;
  updateExerciseTemplate: (
    exerciseId: ExerciseId,
    template: ExerciseTemplate,
  ) => Promise<void>;
  suggestFreeTextLoads: (exerciseId: ExerciseId) => string[];
  saveBandLabels: (labels: string[]) => Promise<void>;
  addBlock: (
    name: string | undefined,
    type: DraftBlock['type'],
  ) => Promise<void>;
  renameBlock: (blockId: string, name: string | undefined) => Promise<void>;
  setBlockRounds: (
    blockId: string,
    rounds: number | undefined,
  ) => Promise<void>;
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
  // Two independent queues, not one shared queue for every storage
  // operation: draft writes/reads (`enqueueDraftOp`) and catalogue/
  // band-label writes/reads (`enqueueCatalogueOp`) are unrelated most of
  // the time (an `addSet` commit has no reason to wait on an unrelated
  // `createExercise`'s call, or on `initialize()`'s `listExercises` read),
  // and forcing them through one shared queue serializes them anyway —
  // this deadlocked in exactly the case a test caught: `initialize()`'s
  // (queued) catalogue read left gated mid-flight, with a concurrent
  // `addSet`'s own draft write stuck behind it on the same shared queue,
  // each awaiting the other. `enqueueOnBoth` (below) is the one place
  // that deliberately joins both queues, for the two operations that
  // genuinely touch both slices at once.
  //
  // Each queue is kept *always-settled* (the trailing `.then(ok, ok)`
  // below): if a queue instead held the last operation's own promise, one
  // rejected operation would leave every later queued call — including a
  // future `initialize()` — permanently awaiting a rejected promise
  // (Copilot review, PR #22). The caller-facing promise `enqueue*` returns
  // still rejects normally.
  let pendingDraftOp: Promise<void> = Promise.resolve();
  let pendingCatalogueOp: Promise<void> = Promise.resolve();
  function enqueueDraftOp<T>(operation: () => Promise<T>): Promise<T> {
    const attempt = pendingDraftOp.then(operation, operation);
    pendingDraftOp = attempt.then(
      () => undefined,
      () => undefined,
    );
    return attempt;
  }
  function enqueueCatalogueOp<T>(operation: () => Promise<T>): Promise<T> {
    const attempt = pendingCatalogueOp.then(operation, operation);
    pendingCatalogueOp = attempt.then(
      () => undefined,
      () => undefined,
    );
    return attempt;
  }
  // `mergeExercises`/`deleteExerciseCascade` rewrite the draft *and* the
  // catalogue in one call (contracts/storage-port-extension.md §1) — this
  // joins both queues instead of picking one, so a draft write queued
  // behind it still waits for it, and so does a catalogue write, without
  // making either queue wait on the *other's* unrelated backlog the way a
  // single shared queue would.
  function enqueueOnBoth<T>(operation: () => Promise<T>): Promise<T> {
    const gate = Promise.all([pendingDraftOp, pendingCatalogueOp]).then(
      () => undefined,
      () => undefined,
    );
    const attempt = gate.then(operation, operation);
    const settled = attempt.then(
      () => undefined,
      () => undefined,
    );
    pendingDraftOp = settled;
    pendingCatalogueOp = settled;
    return attempt;
  }
  // FR-024 (ADR-0009): persists the active draft once it has content
  // (`draftHasContent`), or removes it from storage once it no longer does
  // (e.g. the user deletes its last block) — the single rule that makes
  // both "no data ⇒ nothing stored" and "some data ⇒ recoverable draft"
  // fall out of *when* this is called, rather than a separate check at
  // every call site. Editing only the session's date-time on an
  // otherwise-empty draft therefore persists nothing (FR-024's explicit
  // carve-out). Queued (`enqueueDraftOp`) the same as every other draft
  // write, so it's always ordered against `registerWorkout`/
  // `recoverPendingDraft`/`discardPendingDraft` below.
  const persistDraft = (
    storage: StoragePort,
    draft: LoggingDraft,
  ): Promise<void> =>
    enqueueDraftOp(() =>
      draftHasContent(draft)
        ? storage.saveDraft(draft)
        : storage.discardDraft(),
    );
  const readDraft = (
    storage: StoragePort,
  ): Promise<{ draft: LoggingDraft; pendingDraft: LoggingDraft | undefined }> =>
    enqueueDraftOp(() => openLoggingForm(storage));

  /**
   * Shared by `deleteBlock`/`deleteExerciseEntry`/`deleteSet`: applies the
   * draft change immediately (Principle II — never held pending), persists
   * it, pushes the resulting `UndoEntry`, and schedules its own removal
   * from `undoStack` once its 5-second window elapses (FR-004/FR-023).
   */
  const applyDelete = async (
    operation: (draft: LoggingDraft) => DeleteResult,
  ): Promise<void> => {
    const { storage, draft: current, lastAddedSetId } = get();
    if (!storage || !current) return;
    const { draft: updated, undo: undoEntry } = operation(current);
    if (updated === current) return; // id didn't resolve — noopUndo, nothing to push
    const touched = touch(updated);
    // If the set this delete just removed was the one-shot "just added"
    // marker, clear it here — otherwise undoing this same delete restores
    // a set with that id and replays its entrance animation, even though
    // it's no longer the set that was actually just logged (Copilot
    // review, PR #22).
    const markedSetStillPresent =
      lastAddedSetId === undefined ||
      touched.blocks.some((block) =>
        block.exercises.some((entry) =>
          entry.sets.some((s) => s.id === lastAddedSetId),
        ),
      );
    set((state) => ({
      draft: touched,
      undoStack: [...state.undoStack, undoEntry],
      ...(markedSetStillPresent ? {} : { lastAddedSetId: undefined }),
    }));
    await persistDraft(storage, touched);
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
    pendingDraft: undefined,
    undoStack: [],
    catalogue: [],
    sessions: [],
    bandLabels: [],
    lastConfirmedAt: {},
    justRegisteredWorkout: false,
    lastAddedSetId: undefined,

    configure: (storage) => set({ storage }),

    initialize: async () => {
      const { storage } = get();
      if (!storage) return;
      // Reset before the reads below, not after they resolve — a pending
      // debounced commit from a previous visit (ADR-0007's timer is
      // deliberately not cancelled on unmount) can still fire and
      // legitimately set these while this visit's own reads are in
      // flight; resetting afterward would silently erase that signal
      // (Copilot review, PR #22).
      set({ justRegisteredWorkout: false, lastAddedSetId: undefined });
      // Captured synchronously, before awaiting anything below — a
      // concurrent action's own optimistic `set()` call (e.g. `addSet`,
      // or `recoverPendingDraft`/`discardPendingDraft` resolving their own
      // queued turn) always runs synchronously too, so capturing these any
      // later (after the queue wait just below, say) risks absorbing that
      // same mutation into "before" instead of detecting it as a change.
      const draftBeforeReads = get().draft;
      const pendingDraftBeforeReads = get().pendingDraft;
      const catalogueBeforeReads = get().catalogue;
      const bandLabelsBeforeReads = get().bandLabels;
      // `readDraft` (not calling `openLoggingForm` directly) queues this
      // read behind whatever draft write is already pending — a debounced
      // commit (ADR-0007's timer outlives unmount) can be mid-write right
      // as this runs, and reading around it can otherwise return the
      // pre-write snapshot even though nothing further mutates `draft` in
      // our own window, which the before/after identity check right after
      // can't catch on its own (Copilot review, PR #22).
      //
      // `catalogue`/`bandLabels` below are deliberately *not* queued the
      // same way: unlike the single draft, `createExercise`/
      // `updateExerciseTemplate` are designed to run concurrently against
      // each other (each keeps its own optimistic entry by reference —
      // see `updateExerciseTemplate`'s rollback below — precisely so one
      // slow write can't block or corrupt another), and queuing this read
      // behind them would either serialize writes that must stay
      // concurrent or still race a write that hasn't reached the queue
      // yet. The before/after identity check right after this still
      // catches a write that lands *during* this read; a write already in
      // flight before it started remains a narrower, unclosed gap here
      // (Copilot review, PR #22) — closing it needs per-exercise
      // conflict tracking on the read side, not a write-side queue.
      const [{ draft, pendingDraft }, catalogue, sessions, bandLabels] =
        await Promise.all([
          readDraft(storage),
          storage.listExercises(),
          storage.listSessions(FULL_RANGE),
          storage.listBandLabels(),
        ]);
      // Same reasoning as `draft` above, for the other slices these reads
      // can also race: `createExercise`/`updateExerciseTemplate` against
      // `catalogue`, `saveBandLabels` against `bandLabels`,
      // `recoverPendingDraft`/`discardPendingDraft` against `pendingDraft`
      // (Copilot review, PR #22 and PR #25) — only overwrite a slice if
      // nothing else already did while we were reading.
      set((state) => ({
        draft: state.draft === draftBeforeReads ? draft : state.draft,
        pendingDraft:
          state.pendingDraft === pendingDraftBeforeReads
            ? pendingDraft
            : state.pendingDraft,
        catalogue:
          state.catalogue === catalogueBeforeReads
            ? catalogue
            : state.catalogue,
        sessions,
        bandLabels:
          state.bandLabels === bandLabelsBeforeReads
            ? bandLabels
            : state.bandLabels,
      }));
    },

    clearJustRegisteredWorkout: () => set({ justRegisteredWorkout: false }),

    // `recoverPendingDraft`/`discardPendingDraft` both go through
    // `enqueueDraftOp` and re-check `pendingDraft`'s identity once their
    // turn comes up: whichever the user actually clicked first wins that
    // race and clears `pendingDraft`, so the other sees it already gone
    // and no-ops, instead of both racing to act on the same banner
    // (Copilot review, PR #25) — e.g. Discard's `storage.discardDraft()`
    // can no longer land *after* Recover has already adopted that same
    // draft as the active one and moved on.
    recoverPendingDraft: async () => {
      const target = get().pendingDraft;
      if (!target) return;
      await enqueueDraftOp(async () => {
        if (get().pendingDraft !== target) return;
        set({ draft: target, pendingDraft: undefined });
      });
    },

    discardPendingDraft: async () => {
      const { storage } = get();
      const target = get().pendingDraft;
      if (!storage || !target) return;
      await enqueueDraftOp(async () => {
        if (get().pendingDraft !== target) return;
        await storage.discardDraft();
        set({ pendingDraft: undefined });
      });
    },

    // Queued behind any outstanding draft write (`persistDraft` uses the
    // same `enqueueDraftOp`), so an older `addSet`/`addBlock` save already
    // in flight is guaranteed to land *before* this reads/clears the
    // draft — never after, which would otherwise resurrect the just-
    // registered workout in storage (Copilot review, PR #25). The
    // identity re-check once this call's turn comes up also makes a
    // double-tap safe: the second call's `current` is the same draft
    // object as the first's, but by the time its turn arrives `draft` has
    // already moved on to the fresh one the first call produced, so it
    // no-ops instead of registering the same content twice.
    registerWorkout: async () => {
      const { storage, draft: current } = get();
      if (!storage || !current || !draftHasContent(current)) return;
      await enqueueDraftOp(async () => {
        if (get().draft !== current) return;
        const { draft: fresh } = await registerWorkoutUseCase(storage, current);
        set({
          draft: fresh,
          pendingDraft: undefined,
          justRegisteredWorkout: true,
        });
      });
    },

    clearLastAddedSetId: () => set({ lastAddedSetId: undefined }),

    setSessionDateTime: async (iso) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch({ ...current, dateTime: iso });
      set({ draft: updated });
      await persistDraft(storage, updated);
    },

    addExerciseEntry: async (exerciseId, blockId) => {
      const { storage, draft: current, pendingDraft } = get();
      if (!storage || !current || pendingDraft) return;
      const updated = touch(
        addExerciseEntryToDraft(current, exerciseId, blockId),
      );
      set({ draft: updated });
      await persistDraft(storage, updated);
    },

    addSet: async (entryId, input) => {
      const { storage, draft: current, pendingDraft, lastConfirmedAt } = get();
      if (!storage || !current || pendingDraft) return;
      const blockId = findBlockIdForEntry(current, entryId);
      if (!blockId) return; // entry no longer exists — nothing to commit to
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

      // `addSetToDraft` always appends, so the new set is whichever one is
      // now last on this entry — used to animate only the set that was
      // actually just added (`logging.css`'s `.set-summary--new`), not
      // every historical row `LoggingScreen` happens to remount alongside it.
      const committedEntry = result.blocks
        .find((b) => b.id === blockId)
        ?.exercises.find((e) => e.id === entryId);
      const newSetId = committedEntry?.sets.at(-1)?.id;

      const updated = touch(result);
      set((state) => ({
        draft: updated,
        lastConfirmedAt: { ...state.lastConfirmedAt, [entryId]: nowMs },
        lastAddedSetId: newSetId,
      }));
      await persistDraft(storage, updated);
    },

    updateSet: async (entryId, setId, input) => {
      const { storage, draft: current, pendingDraft } = get();
      if (!storage || !current || pendingDraft) return;
      const blockId = findBlockIdForEntry(current, entryId);
      if (!blockId) return; // entry no longer exists — nothing to update
      const result = updateSetInDraft(current, blockId, entryId, setId, input);
      if (result === current) return; // setId didn't resolve — no-op

      const updated = touch(result);
      set({ draft: updated });
      await persistDraft(storage, updated);
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
      // Not queued — deliberately concurrent with `updateExerciseTemplate`
      // (see that action's own comment below).
      const exercise = await createExerciseUseCase(storage, input);
      set((state) => ({ catalogue: [...state.catalogue, exercise] }));
      return exercise;
    },

    updateExerciseTemplate: async (exerciseId, template) => {
      const { storage } = get();
      if (!storage) return;
      const before = get().catalogue.find((e) => e.id === exerciseId);
      // A cold cache (e.g. a direct `/exercises` visit — ADR-0010 —
      // reaching this before this store's own `initialize()` has ever
      // populated `catalogue`, which `ExerciseCatalogueScreen` doesn't
      // call) has nothing to optimistically update yet, but the write
      // itself doesn't depend on the local cache
      // (`updateExerciseTemplateUseCase` re-fetches from storage) — it
      // must still happen, not silently no-op. Skip the optimistic
      // update/rollback dance below and adopt the fresh exercise into the
      // cache once the write lands instead.
      if (!before) {
        await updateExerciseTemplateUseCase(storage, exerciseId, template);
        const updated = await storage.getExercise(exerciseId);
        if (updated) {
          set((state) => ({
            catalogue: state.catalogue.some((e) => e.id === exerciseId)
              ? state.catalogue.map((e) => (e.id === exerciseId ? updated : e))
              : [...state.catalogue, updated],
          }));
        }
        return;
      }
      const optimistic = { ...before, ...template };
      set((state) => ({
        catalogue: state.catalogue.map((exercise) =>
          exercise.id === exerciseId ? optimistic : exercise,
        ),
      }));
      try {
        // Not queued against `createExercise`/another concurrent
        // `updateExerciseTemplate` call — each keeps and rolls back only
        // its own optimistic entry by reference (below), so two of these
        // are designed to run concurrently without corrupting each
        // other's result; serializing them here would only add latency
        // for no correctness gain, and would block a `createExercise`
        // behind an unrelated slow write it has no relation to.
        await updateExerciseTemplateUseCase(storage, exerciseId, template);
      } catch (error) {
        // Roll back only this call's own optimistic entry, by reference —
        // never the whole captured catalogue: doing that would also erase
        // any *other* exercise that arrived (e.g. via `createExercise`)
        // while this write was pending. The `=== optimistic` check is a
        // per-exercise revision guard: if a newer call already replaced
        // this same entry with a different optimistic value (or it was
        // merged/deleted away) since we set it, that identity check fails
        // and this older, now-irrelevant failure leaves it alone instead
        // of clobbering whatever superseded it. Re-thrown so a caller that
        // keeps its own copy of the catalogue (`SessionDetailScreen`) can
        // also undo its echo of this same optimistic update and keep its
        // editor open to retry.
        set((state) => ({
          catalogue: state.catalogue.map((exercise) =>
            exercise.id === exerciseId && exercise === optimistic
              ? before
              : exercise,
          ),
        }));
        throw error;
      }
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
      const { storage, draft: current, pendingDraft } = get();
      if (!storage || !current || pendingDraft) return;
      const updated = touch(addBlockToDraft(current, name, type));
      set({ draft: updated });
      await persistDraft(storage, updated);
    },

    renameBlock: async (blockId, name) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(renameBlockInDraft(current, blockId, name));
      set({ draft: updated });
      await persistDraft(storage, updated);
    },

    setBlockRounds: async (blockId, rounds) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(setBlockRoundsInDraft(current, blockId, rounds));
      set({ draft: updated });
      await persistDraft(storage, updated);
    },

    reorderBlockExercise: async (blockId, fromIndex, toIndex) => {
      const { storage, draft: current } = get();
      if (!storage || !current) return;
      const updated = touch(
        reorderBlockExerciseInDraft(current, blockId, fromIndex, toIndex),
      );
      set({ draft: updated });
      await persistDraft(storage, updated);
    },

    moveExerciseAcrossBlocks: async (
      fromBlockId,
      entryId,
      toBlockId,
      toIndex,
    ) => {
      const { storage, draft: current, lastAddedSetId } = get();
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
      // Moving an entry to a different block remounts its set rows under a
      // new `BlockCard` — a different parent, even with the same `key` —
      // so if the marked "just added" set lives in this entry, that remount
      // would replay its entrance animation even though nothing was
      // actually just logged (Copilot review, PR #22).
      const movedEntryHadMarkedSet =
        lastAddedSetId !== undefined &&
        (current.blocks
          .find((block) => block.id === fromBlockId)
          ?.exercises.find((entry) => entry.id === entryId)
          ?.sets.some((s) => s.id === lastAddedSetId) ??
          false);
      set({
        draft: updated,
        ...(movedEntryHadMarkedSet ? { lastAddedSetId: undefined } : {}),
      });
      await persistDraft(storage, updated);
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
      await persistDraft(storage, restored);
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

    // Merge/cascade-delete repoint or prune the *stored* draft too
    // (contracts/storage-port-extension.md §1) — but the active `draft`
    // being edited (ADR-0009) is not necessarily the stored one at all
    // (it may still be unpersisted), so it is repointed/pruned directly,
    // in memory, with the same pure transforms `infrastructure/draft-
    // cascade.ts` applies to the stored copy (`application/` cannot import
    // `infrastructure/` — docs/architecture.md's layer table — hence the
    // small duplication in `application/logging/draft.ts`). `pendingDraft`
    // *is* the stored draft, so it's simply re-fetched (queued — see
    // below), which also refreshes an already-rendered recovery banner if
    // the merge/delete just rewrote it (FR-024).
    //
    // The rewrite itself joins *both* queues (`enqueueOnBoth`) since it
    // touches both slices; the catalogue re-fetch and the `pendingDraft`
    // re-fetch then each queue on their own matching queue. Run unqueued,
    // an unrelated in-flight write (e.g. a debounced commit, or
    // `registerWorkout`) could land between the rewrite and the re-fetch,
    // or after either, and silently overwrite the rewrite's own result
    // (Copilot review, PR #22).
    //
    // `draft` itself is (re-)read *after* awaiting the gated rewrite
    // above, not captured at the top of this action — a concurrent
    // optimistic update (e.g. `addExerciseEntry`) can land in memory
    // while the rewrite is still in flight, and repointing/pruning a
    // stale pre-rewrite snapshot capture would silently discard it once
    // this action's own `set()` below overwrites `draft` with that stale
    // result (Copilot review, PR #25). The identity check on `set()`
    // closes the remaining, narrower gap the same way `initialize()`'s
    // own does: something mutating `draft` again in the brief window
    // between that re-read and this `set()` call.
    mergeExercises: async (survivorId, loserId) => {
      const { storage, pendingDraft: pendingBefore } = get();
      if (!storage) return;
      await enqueueOnBoth(() =>
        mergeExercisesUseCase(storage, survivorId, loserId),
      );
      const draftBeforeRepoint = get().draft;
      const draft = draftBeforeRepoint
        ? repointDraftExerciseId(draftBeforeRepoint, loserId, survivorId)
        : draftBeforeRepoint;
      // Only refresh the banner if one was already showing — this must
      // never fabricate a pending draft where none existed, since
      // `storage.getDraft()` may just be re-describing the active `draft`
      // itself once it has been persisted.
      const [pendingDraft, catalogue] = await Promise.all([
        pendingBefore ? enqueueDraftOp(() => storage.getDraft()) : undefined,
        enqueueCatalogueOp(() => storage.listExercises()),
      ]);
      set((state) => ({
        draft: state.draft === draftBeforeRepoint ? draft : state.draft,
        pendingDraft,
        catalogue,
      }));
    },

    deleteExerciseCascade: async (exerciseId, hasHistory, confirmed) => {
      const { storage, pendingDraft: pendingBefore } = get();
      if (!storage) return;
      await enqueueOnBoth(() =>
        deleteExerciseCascadeUseCase(
          storage,
          exerciseId,
          hasHistory,
          confirmed,
        ),
      );
      const draftBeforePrune = get().draft;
      const draft = draftBeforePrune
        ? pruneDraftExerciseId(draftBeforePrune, exerciseId)
        : draftBeforePrune;
      const [pendingDraft, catalogue] = await Promise.all([
        pendingBefore ? enqueueDraftOp(() => storage.getDraft()) : undefined,
        enqueueCatalogueOp(() => storage.listExercises()),
      ]);
      set((state) => ({
        draft: state.draft === draftBeforePrune ? draft : state.draft,
        pendingDraft,
        catalogue,
      }));
    },
  };
});
