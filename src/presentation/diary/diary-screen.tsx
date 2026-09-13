/**
 * FR-001/002/003/006: reverse-chronological session list, grouped by
 * month, one-line summarized, with jump-to-date and an FR-006 empty
 * state. Reads `listExercises()`/`listSessions()` directly via
 * `requireStorage()`.
 *
 * `docs/requirements.md` FR-1/FR-6 (design-refinement pass): the primary
 * "Log session" action lives here as a floating action linking to `/log`
 * (there is no persistent nav tab for it — `docs/design.md` §6). Bulk
 * select is reached either by a sustained press on a row, or (keyboard/
 * screen-reader path) the "Select sessions" button, which arms selection
 * mode with nothing yet selected; once active, a tap or Enter/Space on a
 * focused row toggles its selection instead of opening it — a native `<a>`
 * dispatches `click` for Enter on its own, but not for Space (which
 * scrolls instead), so `onKeyDown` handles Space explicitly while active.
 * The press/release/cancel tracking uses Pointer Events (one event family
 * for mouse/touch/pen) rather than separate mouse+touch handlers: a real
 * touch interaction still fires *synthetic* compatibility mouse events
 * afterward, which would otherwise re-run the same start/end logic a
 * second time and could immediately toggle a just-made touch selection
 * back off. A selected row swaps to `role="button"`/`aria-pressed` while
 * active, since that's what it actually behaves as in this mode (a toggle,
 * not a navigation link) — screen-reader/assistive-tech users need that
 * exposed, not just the visual selected style. While active the FAB is
 * replaced by a floating Cancel/Delete bar. Deleting/undoing is orchestrated by
 * `deleteSessionsWithUndo` (`application/diary/diary-bulk-delete.ts`) —
 * this screen never calls a `StoragePort` write method itself
 * (`storage-access.ts` documents its instance as read-only for the diary/
 * search/progression screens); this component only applies the optimistic
 * UI update and reacts to the returned handle's outcome (rolling back
 * sessions whose delete failed) or to "Undo" (which the handle guarantees
 * waits for the original delete to finish before restoring, so the two
 * can never race for the same id). Multiple delete batches can be pending
 * at once, each with its own 5-second `UndoToast`. `SessionListItem`
 * below is inferred from `requireStorage()`'s own return type rather than
 * imported from `domain/`, so this file never crosses the
 * presentation→domain boundary (`docs/architecture.md`'s forbidden-edge
 * table) while still keeping full `Session` objects for exact restoration.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/presentation/design/icons';
import { requireStorage } from '@/application/storage-access';
import { useLoggingSession } from '@/application/logging/logging-store';
import { allStoredDataRange } from '@/application/date-range';
import { buildDiarySessionSummary } from '@/application/diary/diary-summary';
import type { DiarySessionSummary } from '@/application/diary/diary-summary';
import {
  findNearestSessionDate,
  groupSessionsByMonth,
} from '@/application/diary/diary-grouping';
import { deleteSessionsWithUndo } from '@/application/diary/diary-bulk-delete';
import type { BulkDeleteHandle } from '@/application/diary/diary-bulk-delete';
import type { Exercise, ExerciseId } from '@/application/logging/use-cases';
import { UndoToast } from '@/presentation/logging/undo-toast';
import { SessionSavedToast } from './session-saved-toast';
import './diary.css';

type SessionListItem = Awaited<
  ReturnType<ReturnType<typeof requireStorage>['listSessions']>
>[number];

const LONG_PRESS_MS = 500;
const DELETE_UNDO_MS = 5000;
/** A press that moves more than this many pixels before the long-press
 * timer fires is a scroll, not a selection gesture. */
const PRESS_MOVE_CANCEL_PX = 10;

interface PendingDeleteBatch {
  batchId: string;
  ids: Set<string>;
  snapshot: SessionListItem[];
  expiresAt: number;
  handle: BulkDeleteHandle;
  /** Set by `undoDelete` before it removes this batch, so a still-pending
   * `handle.settled` reaction (rolling back failed deletes) knows undo
   * already restored everything and skips its own, now-redundant patch. */
  undone: { current: boolean };
}

export function DiaryScreen() {
  // Read reactively, not just once at mount: `LoggingScreen`'s "Log
  // workout" control (ADR-0008) awaits `registerWorkout()` before
  // navigating here, so in practice the flag is already true by the time
  // this screen mounts — but reading it live rather than snapshotting once
  // costs nothing and stays correct if that ordering ever changes.
  // `SessionSavedToast`'s own `onDismiss` clears it once shown, so a later
  // remount of this same route (browser back/forward, or any other way of
  // arriving here) with nothing new registered since renders nothing.
  const justRegisteredWorkout = useLoggingSession(
    (s) => s.justRegisteredWorkout,
  );
  const [sessions, setSessions] = useState<SessionListItem[] | undefined>(
    undefined,
  );
  const [summaries, setSummaries] = useState<DiarySessionSummary[] | undefined>(
    undefined,
  );
  const [jumpDate, setJumpDate] = useState('');
  const [selectionActive, setSelectionActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDeletes, setPendingDeletes] = useState<PendingDeleteBatch[]>(
    [],
  );
  const exercisesByIdRef = useRef(new Map<ExerciseId, Exercise>());
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const longPressFiredRef = useRef(false);
  const pressOriginRef = useRef<{ x: number; y: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    void (async () => {
      const storage = requireStorage();
      const [exercises, loadedSessions] = await Promise.all([
        storage.listExercises(),
        storage.listSessions(allStoredDataRange()),
      ]);
      const exercisesById = new Map<ExerciseId, Exercise>(
        exercises.map((exercise) => [exercise.id, exercise]),
      );
      exercisesByIdRef.current = exercisesById;
      setSessions(loadedSessions);
      setSummaries(
        loadedSessions.map((session) =>
          buildDiarySessionSummary(session, exercisesById),
        ),
      );
    })();
  }, []);

  const bulkActive = selectionActive;

  function handlePressStart(sessionId: string, x: number, y: number) {
    longPressFiredRef.current = false;
    pressOriginRef.current = { x, y };
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setSelectionActive(true);
      setSelected((current) => new Set(current).add(sessionId));
    }, LONG_PRESS_MS);
  }

  function handlePressEnd() {
    if (pressTimerRef.current !== undefined) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = undefined;
    }
    pressOriginRef.current = undefined;
  }

  /** A scroll gesture starts the same way a long-press does (finger down,
   * held); only a scroll keeps moving. Cancels the pending timer once
   * movement crosses a small threshold, so scrolling a row past never
   * selects it. */
  function handlePressMove(x: number, y: number) {
    const origin = pressOriginRef.current;
    if (!origin) return;
    if (Math.hypot(x - origin.x, y - origin.y) > PRESS_MOVE_CANCEL_PX) {
      handlePressEnd();
    }
  }

  function toggleSelected(sessionId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function handleRowClick(event: MouseEvent, sessionId: string) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      event.preventDefault();
      return;
    }
    if (bulkActive) {
      event.preventDefault();
      toggleSelected(sessionId);
    }
  }

  /** Enter already toggles via the native `click` a `<a>` dispatches for
   * it; Space does not (it scrolls instead), so it needs its own handler
   * while selection mode is active (FR-6: keyboard-operable). */
  function handleRowKeyDown(event: KeyboardEvent, sessionId: string) {
    if (!bulkActive) return;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      toggleSelected(sessionId);
    }
  }

  /** Keyboard/screen-reader entry point into bulk-select — the long press
   * above has no keyboard equivalent on its own. Arms selection mode with
   * nothing yet picked; each row's own Enter/Space (a native `<a>`
   * dispatches `click` for both) then toggles it via `handleRowClick`. */
  function startSelection() {
    setSelectionActive(true);
  }

  function cancelSelection() {
    setSelectionActive(false);
    setSelected(new Set());
  }

  function mergeSessionsSortedDesc(
    current: SessionListItem[] | undefined,
    toAdd: SessionListItem[],
  ): SessionListItem[] {
    const restored = [...(current ?? []), ...toAdd];
    restored.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
    return restored;
  }

  function deleteSelection() {
    if (!sessions || selected.size === 0) return;
    const storage = requireStorage();
    const ids = selected;
    const toDelete = sessions.filter((session) => ids.has(session.id));
    const remaining = sessions.filter((session) => !ids.has(session.id));

    // Optimistic: the list updates before every delete is confirmed
    // (constitution Principle II).
    setSessions(remaining);
    setSummaries(
      remaining.map((session) =>
        buildDiarySessionSummary(session, exercisesByIdRef.current),
      ),
    );
    setSelectionActive(false);
    setSelected(new Set());

    const handle = deleteSessionsWithUndo(storage, toDelete);
    const batchId = handle.batchId;
    const undone = { current: false };
    setPendingDeletes((current) => [
      ...current,
      {
        batchId,
        ids: new Set(ids),
        snapshot: toDelete,
        expiresAt: Date.now() + DELETE_UNDO_MS,
        handle,
        undone,
      },
    ]);
    // `UndoToast` renders nothing once its own countdown reaches zero, but
    // this batch's own bookkeeping (its `Session` snapshot, its handle)
    // stays referenced until something removes it — undoing does, but an
    // expired, never-undone batch otherwise never would, growing this list
    // for as long as the screen stays mounted.
    setTimeout(() => {
      if (undone.current) return;
      setPendingDeletes((current) =>
        current.filter((batch) => batch.batchId !== batchId),
      );
    }, DELETE_UNDO_MS);

    void handle.settled.then(({ failures }) => {
      // Undo already restored everything for this batch — re-adding just
      // the failures now would duplicate them (finding this ran after an
      // undo is a race, not a bug: the user can act before a background
      // delete settles).
      if (undone.current || failures.length === 0) return;
      const failedIds = new Set<string>(failures.map((session) => session.id));
      setSessions((current) => {
        const restored = mergeSessionsSortedDesc(current, failures);
        setSummaries(
          restored.map((session) =>
            buildDiarySessionSummary(session, exercisesByIdRef.current),
          ),
        );
        return restored;
      });
      // Narrow the still-open undo window to the sessions that actually
      // got deleted — the ones that failed are already back above and
      // never left storage, so undoing this batch later must not touch
      // them again.
      setPendingDeletes((current) =>
        current
          .map((batch) =>
            batch.batchId === batchId
              ? {
                  ...batch,
                  ids: new Set(
                    [...batch.ids].filter((id) => !failedIds.has(id)),
                  ),
                  snapshot: batch.snapshot.filter(
                    (session) => !failedIds.has(session.id),
                  ),
                }
              : batch,
          )
          .filter((batch) => batch.ids.size > 0),
      );
    });
  }

  async function undoDelete(batchId: string) {
    const batch = pendingDeletes.find((b) => b.batchId === batchId);
    if (!batch) return;
    batch.undone.current = true;
    setPendingDeletes((current) =>
      current.filter((b) => b.batchId !== batchId),
    );
    // `restore` waits for this batch's own deletes to finish first, so it
    // can never race them for the same id even if they're still in flight.
    const { failures } = await batch.handle.restore();
    // Merge back in rather than re-fetching everything: the deletion was
    // optimistic (Principle II), so undo stays symmetric with it — the UI
    // is what's authoritative here, `restore` above is what makes storage
    // agree with it. Only the sessions `restore` actually confirmed are
    // re-added — one failed `saveSession` must never make the visible list
    // claim a session is back when storage disagrees (the rest of the
    // batch still restores normally; there's nothing to undo the undo of).
    const failedIds = new Set(failures.map((session) => session.id));
    const restoredSessions = batch.snapshot.filter(
      (session) => !failedIds.has(session.id),
    );
    setSessions((current) => {
      const restored = mergeSessionsSortedDesc(current, restoredSessions);
      setSummaries(
        restored.map((session) =>
          buildDiarySessionSummary(session, exercisesByIdRef.current),
        ),
      );
      return restored;
    });
  }

  if (summaries === undefined || sessions === undefined) {
    return <main className="diary-screen" aria-label="Diary" />;
  }

  const undoToasts = pendingDeletes.map((batch) => (
    <UndoToast
      key={batch.batchId}
      message={`${batch.ids.size} session${batch.ids.size === 1 ? '' : 's'} deleted`}
      expiresAt={batch.expiresAt}
      onUndo={() => void undoDelete(batch.batchId)}
    />
  ));

  if (summaries.length === 0) {
    return (
      <main className="diary-screen" aria-label="Diary">
        <h1>Diary</h1>
        <p className="diary-screen__empty">
          No sessions logged yet — sessions you log will show up here.
        </p>
        <Link to="/log" className="diary-screen__fab">
          <Icon name="plus" />
          Log session
        </Link>
        {undoToasts}
        {justRegisteredWorkout && (
          <SessionSavedToast
            onDismiss={() =>
              useLoggingSession.getState().clearJustRegisteredWorkout()
            }
          />
        )}
      </main>
    );
  }

  const groups = groupSessionsByMonth(summaries);
  const nearestId = jumpDate
    ? findNearestSessionDate(summaries, jumpDate)
    : undefined;

  return (
    <main className="diary-screen" aria-label="Diary">
      <h1>Diary</h1>
      <label className="diary-screen__jump">
        <span className="diary-screen__jump-label">
          <Icon name="calendar" />
          Jump to date
        </span>
        <input
          type="date"
          value={jumpDate}
          onChange={(event) => setJumpDate(event.target.value)}
        />
      </label>
      {nearestId && (
        <p>
          Nearest session: <Link to={`/diary/${nearestId}`}>{nearestId}</Link>
        </p>
      )}
      {!bulkActive && (
        <button
          type="button"
          className="diary-screen__select-button"
          onClick={startSelection}
        >
          <Icon name="check" />
          Select sessions
        </button>
      )}
      {groups.map((group) => (
        <section key={group.monthKey} aria-label={group.monthKey}>
          <h2>{group.monthKey}</h2>
          <ul className="diary-screen__session-list">
            {group.sessions.map((session) => {
              const isSelected = selected.has(session.sessionId);
              return (
                <li key={session.sessionId}>
                  <Link
                    to={`/diary/${session.sessionId}`}
                    className={`diary-screen__session-link${isSelected ? ' diary-screen__session-link--selected' : ''}`}
                    // While a selection is active this row behaves as a
                    // toggle, not a navigation link — expose that role/state
                    // for assistive tech rather than leaving only the
                    // visual `--selected` style to carry it.
                    {...(bulkActive
                      ? { role: 'button', 'aria-pressed': isSelected }
                      : {})}
                    onPointerDown={(event: PointerEvent) =>
                      handlePressStart(
                        session.sessionId,
                        event.clientX,
                        event.clientY,
                      )
                    }
                    onPointerMove={(event: PointerEvent) =>
                      handlePressMove(event.clientX, event.clientY)
                    }
                    onPointerUp={handlePressEnd}
                    onPointerLeave={handlePressEnd}
                    onPointerCancel={handlePressEnd}
                    onClick={(event) =>
                      handleRowClick(event, session.sessionId)
                    }
                    onKeyDown={(event) =>
                      handleRowKeyDown(event, session.sessionId)
                    }
                  >
                    <span className="diary-screen__session-icon">
                      <Icon name="dumbbell" />
                      {isSelected && (
                        <span
                          className="diary-screen__session-icon-check"
                          aria-hidden="true"
                        >
                          <Icon name="check" />
                        </span>
                      )}
                    </span>
                    <span className="diary-screen__session-link-body">
                      <span className="diary-screen__session-link-date">
                        {new Date(session.dateTime).toLocaleDateString()}
                      </span>
                      <span className="diary-screen__session-link-detail">
                        {session.mainExerciseNames.join(', ')}
                      </span>
                      <span className="diary-screen__session-link-detail">
                        {session.setCount} sets
                        {session.kindOfWork && ` · ${session.kindOfWork}`}
                      </span>
                    </span>
                    <Icon name="chevron-right" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!bulkActive && (
        <Link to="/log" className="diary-screen__fab">
          <Icon name="plus" />
          Log session
        </Link>
      )}

      {bulkActive && (
        <div
          className="diary-screen__bulk-bar"
          role="toolbar"
          aria-label="Selected sessions"
        >
          <span>
            {selected.size} session{selected.size === 1 ? '' : 's'} selected
          </span>
          <span className="diary-screen__bulk-bar-actions">
            <button
              type="button"
              className="diary-screen__bulk-button diary-screen__bulk-button--cancel"
              onClick={cancelSelection}
            >
              Cancel
            </button>
            <button
              type="button"
              className="diary-screen__bulk-button diary-screen__bulk-button--delete"
              disabled={selected.size === 0}
              onClick={deleteSelection}
            >
              <Icon name="trash" />
              Delete
            </button>
          </span>
        </div>
      )}

      {undoToasts}
      {justRegisteredWorkout && (
        <SessionSavedToast
          onDismiss={() =>
            useLoggingSession.getState().clearJustRegisteredWorkout()
          }
        />
      )}
    </main>
  );
}
