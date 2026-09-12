/**
 * FR-001/002/003/006: reverse-chronological session list, grouped by
 * month, one-line summarized, with jump-to-date and an FR-006 empty
 * state. Reads `listExercises()`/`listSessions()` directly via
 * `requireStorage()`.
 *
 * `docs/requirements.md` FR-1/FR-6 (design-refinement pass): the primary
 * "Log session" action lives here as a floating action linking to `/log`
 * (there is no persistent nav tab for it — `docs/design.md` §6). A
 * sustained press on a row enters bulk-select (long-press timer below);
 * while a selection is active the FAB is replaced by a floating Cancel/
 * Delete bar and a normal tap toggles a row's selection instead of
 * opening it. Deleting calls `storage.deleteSession` per id (optimistic —
 * constitution Principle II) and keeps the deleted `Session`s in memory
 * for a 5-second `UndoToast` window, restoring each via
 * `storage.saveSession` exactly as it was if undone (FR-6's extension of
 * FR-004's undo guarantee to sessions). `SessionListItem` below is
 * inferred from `requireStorage()`'s own return type rather than imported
 * from `domain/`, so this file never crosses the presentation→domain
 * boundary (`docs/architecture.md`'s forbidden-edge table) while still
 * keeping full `Session` objects for exact restoration.
 */
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/presentation/design/icons';
import { requireStorage } from '@/application/storage-access';
import { allStoredDataRange } from '@/application/date-range';
import { buildDiarySessionSummary } from '@/application/diary/diary-summary';
import type { DiarySessionSummary } from '@/application/diary/diary-summary';
import {
  findNearestSessionDate,
  groupSessionsByMonth,
} from '@/application/diary/diary-grouping';
import type { Exercise, ExerciseId } from '@/application/logging/use-cases';
import { UndoToast } from '@/presentation/logging/undo-toast';
import { SessionSavedToast } from './session-saved-toast';
import './diary.css';

type SessionListItem = Awaited<
  ReturnType<ReturnType<typeof requireStorage>['listSessions']>
>[number];

const LONG_PRESS_MS = 500;
const DELETE_UNDO_MS = 5000;

interface PendingDelete {
  ids: Set<string>;
  snapshot: SessionListItem[];
  expiresAt: number;
}

export function DiaryScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  // Captured once, at mount, from the router state the "‹ Diary" link
  // navigated here with — never updated afterward, so it stays stable
  // across the state-clearing navigate() call below (a fresh navigation
  // back to this route always remounts DiaryScreen, so a lazy initializer
  // is enough; no effect needs to set this).
  const [justLogged] = useState(
    () =>
      (location.state as { justLogged?: boolean } | null)?.justLogged === true,
  );
  const [sessions, setSessions] = useState<SessionListItem[] | undefined>(
    undefined,
  );
  const [summaries, setSummaries] = useState<DiarySessionSummary[] | undefined>(
    undefined,
  );
  const [jumpDate, setJumpDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | undefined>(
    undefined,
  );
  const exercisesByIdRef = useRef(new Map<ExerciseId, Exercise>());
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const longPressFiredRef = useRef(false);

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

  useEffect(() => {
    // Clears the nav state so returning here via browser back/forward
    // doesn't replay the toast for a visit that never happened
    // (docs/design.md §1.1's exception is "immediately after logging a
    // session", not "any time this route is entered").
    if (justLogged) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bulkActive = selected.size > 0;

  function handlePressStart(sessionId: string) {
    longPressFiredRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setSelected((current) => new Set(current).add(sessionId));
    }, LONG_PRESS_MS);
  }

  function handlePressEnd() {
    if (pressTimerRef.current !== undefined) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = undefined;
    }
  }

  function handleRowClick(event: MouseEvent, sessionId: string) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      event.preventDefault();
      return;
    }
    if (bulkActive) {
      event.preventDefault();
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(sessionId)) next.delete(sessionId);
        else next.add(sessionId);
        return next;
      });
    }
  }

  function cancelSelection() {
    setSelected(new Set());
  }

  async function deleteSelection() {
    if (!sessions) return;
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
    setSelected(new Set());
    setPendingDelete({
      ids: new Set(ids),
      snapshot: toDelete,
      expiresAt: Date.now() + DELETE_UNDO_MS,
    });

    await Promise.all(
      toDelete.map((session) => storage.deleteSession(session.id)),
    );
  }

  async function undoDelete() {
    const pending = pendingDelete;
    if (!pending) return;
    const storage = requireStorage();
    setPendingDelete(undefined);
    await Promise.all(
      pending.snapshot.map((session) => storage.saveSession(session)),
    );
    // Merge back in rather than re-fetching everything: the deletion was
    // optimistic (Principle II), so undo stays symmetric with it — the UI
    // is what's authoritative here, `saveSession` above is what makes
    // storage agree with it.
    setSessions((current) => {
      const restored = [...(current ?? []), ...pending.snapshot];
      restored.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
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

  const undoToast = pendingDelete && (
    <UndoToast
      message={`${pendingDelete.ids.size} session${pendingDelete.ids.size === 1 ? '' : 's'} deleted`}
      expiresAt={pendingDelete.expiresAt}
      onUndo={() => void undoDelete()}
    />
  );

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
        {undoToast}
        {justLogged && <SessionSavedToast />}
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
                    onMouseDown={() => handlePressStart(session.sessionId)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={() => handlePressStart(session.sessionId)}
                    onTouchEnd={handlePressEnd}
                    onClick={(event) =>
                      handleRowClick(event, session.sessionId)
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
              onClick={() => void deleteSelection()}
            >
              <Icon name="trash" />
              Delete
            </button>
          </span>
        </div>
      )}

      {undoToast}
      {justLogged && <SessionSavedToast />}
    </main>
  );
}
