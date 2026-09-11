/**
 * FR-001/002/003/006: reverse-chronological session list, grouped by
 * month, one-line summarized, with jump-to-date and an FR-006 empty
 * state. Reads `listExercises()`/`listSessions()` directly via
 * `requireStorage()` — this screen has no draft/undo state, only reads.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requireStorage } from '@/application/storage-access';
import { allStoredDataRange } from '@/application/date-range';
import { buildDiarySessionSummary } from '@/application/diary/diary-summary';
import type { DiarySessionSummary } from '@/application/diary/diary-summary';
import {
  findNearestSessionDate,
  groupSessionsByMonth,
} from '@/application/diary/diary-grouping';
import type { Exercise, ExerciseId } from '@/application/logging/use-cases';
import './diary.css';

export function DiaryScreen() {
  const [summaries, setSummaries] = useState<DiarySessionSummary[] | undefined>(
    undefined,
  );
  const [jumpDate, setJumpDate] = useState('');

  useEffect(() => {
    void (async () => {
      const storage = requireStorage();
      const [exercises, sessions] = await Promise.all([
        storage.listExercises(),
        storage.listSessions(allStoredDataRange()),
      ]);
      const exercisesById = new Map<ExerciseId, Exercise>(
        exercises.map((exercise) => [exercise.id, exercise]),
      );
      setSummaries(
        sessions.map((session) =>
          buildDiarySessionSummary(session, exercisesById),
        ),
      );
    })();
  }, []);

  if (summaries === undefined) {
    return <main className="diary-screen" aria-label="Diary" />;
  }

  if (summaries.length === 0) {
    return (
      <main className="diary-screen" aria-label="Diary">
        <h1>Diary</h1>
        <p className="diary-screen__empty">
          No sessions logged yet — sessions you log will show up here.
        </p>
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
      <Link to="/search">Search exercises</Link>
      <label className="diary-screen__jump">
        <span>Jump to date</span>
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
            {group.sessions.map((session) => (
              <li key={session.sessionId}>
                <Link
                  to={`/diary/${session.sessionId}`}
                  className="diary-screen__session-link"
                >
                  <span>{new Date(session.dateTime).toLocaleDateString()}</span>
                  <span>{session.mainExerciseNames.join(', ')}</span>
                  <span>{session.setCount} sets</span>
                  {session.kindOfWork && <span>{session.kindOfWork}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
