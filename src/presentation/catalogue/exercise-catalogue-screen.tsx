/**
 * FR-5 — "Merge duplicates from the catalogue screen": a dedicated
 * exercise-management screen, separate from Logging so that screen stays
 * focused on recording sets (docs/design.md §2 "one clear primary action
 * per screen"). Reads/writes storage directly via `requireStorage()` and
 * the same use-cases the logging store wraps — this screen has no draft
 * state of its own, only catalogue reads and management writes.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requireStorage } from '@/application/storage-access';
import { allStoredDataRange } from '@/application/date-range';
import { searchExercises } from '@/application/search/exercise-search';
import {
  renameExerciseWithCollisionCheck,
  mergeExercises,
  deleteExerciseCascade,
} from '@/application/logging/use-cases';
import type { Exercise, Session } from '@/application/logging/use-cases';
import { ExerciseCataloguePanel } from '../logging/exercise-catalogue-panel';
import './catalogue.css';

export function ExerciseCatalogueScreen() {
  const [catalogue, setCatalogue] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [query, setQuery] = useState('');
  const [managing, setManaging] = useState<Exercise | undefined>(undefined);

  // Deliberately not shared with the mount effect below (react-hooks'
  // set-state-in-effect rule flags a named, externally-reusable function
  // called from an effect) — this one re-fetches after a rename/merge/
  // delete; the effect fetches once inline on its own.
  const refresh = async () => {
    const storage = requireStorage();
    const [exercises, allSessions] = await Promise.all([
      storage.listExercises(),
      storage.listSessions(allStoredDataRange()),
    ]);
    setCatalogue(exercises);
    setSessions(allSessions);
  };

  useEffect(() => {
    void (async () => {
      const storage = requireStorage();
      const [exercises, allSessions] = await Promise.all([
        storage.listExercises(),
        storage.listSessions(allStoredDataRange()),
      ]);
      setCatalogue(exercises);
      setSessions(allSessions);
    })();
  }, []);

  const results = searchExercises(query, catalogue);
  const hasHistory = (exerciseId: Exercise['id']): boolean =>
    sessions.some((session) =>
      session.blocks.some((block) =>
        block.exercises.some((entry) => entry.exerciseId === exerciseId),
      ),
    );

  return (
    <main className="catalogue-screen" aria-label="Manage exercises">
      <h1>Exercises</h1>
      <Link to="/">Back to logging</Link>

      <label className="logging-screen__field-label">
        <span>Exercise name</span>
        <input
          type="text"
          className="logging-field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the catalogue"
        />
      </label>

      <ul className="catalogue-screen__list">
        {results.map((exercise) => (
          <li key={exercise.id} className="catalogue-screen__row">
            <span>{exercise.canonicalName}</span>
            <button
              type="button"
              className="logging-button"
              aria-label={`Manage ${exercise.canonicalName}`}
              onClick={() => setManaging(exercise)}
            >
              Manage
            </button>
          </li>
        ))}
      </ul>

      {managing && (
        <ExerciseCataloguePanel
          exercise={managing}
          hasHistory={hasHistory(managing.id)}
          search={(q) => searchExercises(q, catalogue)}
          onRename={async (newName) => {
            const result = await renameExerciseWithCollisionCheck(
              requireStorage(),
              managing.id,
              newName,
            );
            if (result.status === 'renamed') await refresh();
            return result;
          }}
          onMerge={(survivorId, loserId) => {
            void mergeExercises(requireStorage(), survivorId, loserId).then(
              refresh,
            );
          }}
          onDeleteConfirm={() => {
            void deleteExerciseCascade(
              requireStorage(),
              managing.id,
              hasHistory(managing.id),
              true,
            ).then(() => {
              setManaging(undefined);
              void refresh();
            });
          }}
          onClose={() => setManaging(undefined)}
        />
      )}
    </main>
  );
}
