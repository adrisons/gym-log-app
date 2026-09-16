/**
 * Tracks whether at least one add/edit-set form (`presentation/logging/
 * set-row.tsx`) is currently open and unconfirmed anywhere in the app —
 * on the logging screen (`/log`) or on a past session's detail view
 * (`/diary/:sessionId`, `SessionDetailScreen` also uses `SetRow` for
 * FR-3/D17's edit-in-place), both under `AppShell` or `LoggingShell`.
 * `presentation/pwa/update-notice.tsx` (spec 009 FR-002/FR-018) reads this
 * to never apply an update while true.
 *
 * A ref-count, not a boolean, because more than one exercise's `SetRow`
 * can be open at once (different blocks/entries). Deliberately
 * conservative: incremented for the whole time a form is mounted, not
 * only once a field actually holds a value — an open-but-still-blank
 * form costs nothing to keep protected, and tracking the finer-grained
 * "empty vs. touched" distinction per load/volume/effort field shape
 * would add real complexity for a benefit (applying an update a few
 * seconds sooner) `docs/requirements.md` Principle II doesn't ask for.
 */
import { create } from 'zustand';

interface UnconfirmedEntryTrackerState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useUnconfirmedEntryTracker = create<UnconfirmedEntryTrackerState>(
  (set) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
    decrement: () => set((state) => ({ count: Math.max(0, state.count - 1) })),
  }),
);

export function hasUnconfirmedEntry(): boolean {
  return useUnconfirmedEntryTracker.getState().count > 0;
}
