/**
 * Orchestrates the diary's bulk delete + undo (`docs/requirements.md`
 * FR-6, extending FR-004/FR-023's undo guarantee to sessions). Pulled out
 * of `presentation/diary/diary-screen.tsx` so that screen never calls
 * `StoragePort` methods directly for a write — `storage-access.ts`
 * documents its `StoragePort` instance as read-only for the diary, search
 * and progression screens; this module is the one write path bulk-delete
 * needs, kept at the application layer per `docs/architecture.md`'s table
 * (`presentation` → `application` only, never → `application-ports`).
 *
 * `deleteSessionsWithUndo` starts every delete immediately (Principle
 * II — the caller applies its own optimistic UI update before or right
 * after calling this) and returns a handle rather than a single `Promise`:
 * - `settled` resolves once every delete for this batch has finished,
 *   succeeded or not, and carries which ones failed (`failures`) so the
 *   caller can roll its optimistic removal back for exactly those.
 * - `restore` (the "Undo" action) always awaits `settled` first, so it
 *   can never race an in-flight delete for the same id — writing the
 *   restored session back only after the delete that removed it has
 *   actually finished, whichever way it finished. Restoring a session
 *   whose delete had already failed (so it was never really gone) is a
 *   harmless, idempotent overwrite with its own unchanged content.
 *   Returns its own `BulkDeleteOutcome` too: one `saveSession` rejecting
 *   must never stop the others (`Promise.allSettled`, not `Promise.all`)
 *   or leave the caller unable to tell which ones actually made it back —
 *   the caller only re-adds the sessions that are confirmed restored, so
 *   the visible list never claims a session is back when storage disagrees.
 */
import type { StoragePort } from '@/application/ports/storage-port';
import type { Session } from '@/domain/session';
import { newId } from '@/shared/id';

export interface BulkDeleteOutcome {
  failures: Session[];
}

export interface BulkDeleteHandle {
  /** Identifies this batch for its `UndoToast`/pending-list bookkeeping —
   * generated here, not in `presentation/`, since `presentation` may not
   * import `shared` directly (`docs/architecture.md`'s table). */
  batchId: string;
  settled: Promise<BulkDeleteOutcome>;
  restore: () => Promise<BulkDeleteOutcome>;
}

export function deleteSessionsWithUndo(
  storage: StoragePort,
  sessions: Session[],
): BulkDeleteHandle {
  const settled = Promise.allSettled(
    sessions.map((session) => storage.deleteSession(session.id)),
  ).then((results) => ({
    failures: sessions.filter(
      (_, index) => results[index]!.status === 'rejected',
    ),
  }));

  return {
    batchId: newId(),
    settled,
    restore: async () => {
      await settled;
      const results = await Promise.allSettled(
        sessions.map((session) => storage.saveSession(session)),
      );
      return {
        failures: sessions.filter(
          (_, index) => results[index]!.status === 'rejected',
        ),
      };
    },
  };
}
