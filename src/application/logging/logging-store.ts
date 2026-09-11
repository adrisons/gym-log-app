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
} from '@/application/logging/use-cases';
import type { CreateExerciseInput } from '@/application/logging/use-cases';
import {
  addExerciseEntry as addExerciseEntryToDraft,
  addSet as addSetToDraft,
  prefillNextSet as prefillNextSetFromDraft,
} from '@/application/logging/draft';
import type { AddSetInput, SetPrefill } from '@/application/logging/draft';

/**
 * data-model.md "Undo". Never persisted — an app close during the 5-second
 * window doesn't need to restore it (spec.md's own edge case: the
 * deletion is already final by then).
 */
export interface UndoEntry {
  id: string;
  kind: 'block' | 'exerciseEntry' | 'set';
  restore: (draft: LoggingDraft) => LoggingDraft;
  expiresAt: number;
}

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
}

export const useLoggingSession = create<LoggingSessionState>((set, get) => ({
  storage: undefined,
  draft: undefined,
  undoStack: [],
  catalogue: [],
  sessions: [],
  lastConfirmedAt: {},

  configure: (storage) => set({ storage }),

  initialize: async () => {
    const { storage } = get();
    if (!storage) return;
    const [draft, catalogue, sessions] = await Promise.all([
      openLoggingForm(storage),
      storage.listExercises(),
      storage.listSessions(FULL_RANGE),
    ]);
    set({ draft, catalogue, sessions });
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
}));
