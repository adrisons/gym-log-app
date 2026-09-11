/**
 * The logging session's view-facing state — the draft, the 5-second undo
 * stack (FR-004/FR-023), and (added in US1) the confirm-debounce guard
 * (FR-025). Zustand (research.md §5), living at the application layer per
 * `docs/architecture.md`'s "session state, view models" — `presentation/`
 * only ever renders from and dispatches to this store, never holds this
 * logic itself.
 *
 * Every action here applies its draft change to `draft` optimistically
 * *before* calling `storage.saveDraft` (constitution Principle II) — the
 * persistence call is fire-and-forget-then-confirm, never awaited before
 * the UI reflects the change.
 */

import { create } from 'zustand';
import type {
  StoragePort,
  LoggingDraft,
} from '@/application/ports/storage-port';
import { openLoggingForm } from '@/application/logging/use-cases';

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

export interface LoggingSessionState {
  draft: LoggingDraft | undefined;
  undoStack: UndoEntry[];
  initialize: (storage: StoragePort) => Promise<void>;
}

export const useLoggingSession = create<LoggingSessionState>((set) => ({
  draft: undefined,
  undoStack: [],
  initialize: async (storage) => {
    const draft = await openLoggingForm(storage);
    set({ draft });
  },
}));
