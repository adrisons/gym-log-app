/**
 * FR-5 — "Merge duplicates from the catalogue screen": a dedicated
 * exercise-management screen, separate from Logging so that screen stays
 * focused on recording sets (docs/design.md §2 "one clear primary action
 * per screen"). Reads/writes storage directly via `requireStorage()` and
 * the same use-cases the logging store wraps — this screen has no draft
 * state of its own, only catalogue reads and management writes.
 *
 * ADR-0010: also creates a brand-new exercise (name + set-entry template
 * together, `CreateExercisePanel`) and edits an existing one's template
 * (`ExerciseTemplatePanel`, from the management panel's own "Edit tracked
 * fields…") — previously only reachable per-entry from Logging/
 * SessionDetail.
 */
import { useEffect, useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { useLoggingSession } from '@/application/logging/logging-store';
import { allStoredDataRange } from '@/application/date-range';
import { searchExercises } from '@/application/search/exercise-search';
import type { Exercise, Session } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { ExerciseCataloguePanel } from '../logging/exercise-catalogue-panel';
import { ExerciseTemplatePanel } from '../logging/exercise-template-panel';
import { CreateExercisePanel } from './create-exercise-panel';
import './catalogue.css';

export function ExerciseCatalogueScreen() {
  // Rename/merge/delete all go through the logging store's own actions,
  // not the bare use-case functions directly: those actions also re-sync
  // the store's in-memory `draft`/`catalogue` from storage afterward.
  // Skipping that would leave LoggingScreen showing a stale catalogue
  // (rename) or draft (merge/delete) until its next `initialize()` — long
  // enough for a quick edit there to read/write against data this screen
  // just changed underneath it (e.g. offering to create a duplicate of an
  // exercise that was just renamed, or resurrecting a reference to one
  // merged-away/deleted).
  const renameExerciseInSession = useLoggingSession(
    (s) => s.renameExerciseWithCollisionCheck,
  );
  const mergeExercisesInSession = useLoggingSession((s) => s.mergeExercises);
  const deleteExerciseCascadeInSession = useLoggingSession(
    (s) => s.deleteExerciseCascade,
  );
  // ADR-0010: creating an exercise and editing its template both go
  // through the logging store's own actions too, for the same reason
  // rename/merge/delete already do (this screen's own doc comment above) —
  // otherwise LoggingScreen could search a stale catalogue missing a
  // brand-new exercise, or keep recording sets under a template just
  // changed here.
  const createExerciseInSession = useLoggingSession((s) => s.createExercise);
  const updateExerciseTemplateInSession = useLoggingSession(
    (s) => s.updateExerciseTemplate,
  );
  const [catalogue, setCatalogue] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [query, setQuery] = useState('');
  const [managing, setManaging] = useState<Exercise | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [editingTemplateFor, setEditingTemplateFor] = useState<
    Exercise | undefined
  >(undefined);

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

      <button
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={() => setCreating(true)}
      >
        <Icon name="plus" />
        New exercise
      </button>

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

      {creating && (
        <CreateExercisePanel
          onCreate={(input) => {
            void createExerciseInSession(input).then(() => {
              setCreating(false);
              void refresh();
            });
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {editingTemplateFor && (
        <ExerciseTemplatePanel
          key={editingTemplateFor.id}
          exercise={editingTemplateFor}
          onSave={(template) => {
            updateExerciseTemplateInSession(editingTemplateFor.id, template)
              .then(() => {
                setEditingTemplateFor(undefined);
                void refresh();
              })
              .catch((error: unknown) => {
                console.error('Failed to save exercise template', error);
              });
          }}
          onClose={() => setEditingTemplateFor(undefined)}
        />
      )}

      {results.length === 0 && (
        <p className="catalogue-screen__empty">
          {catalogue.length === 0 ? (
            'No exercises in your catalogue yet.'
          ) : (
            <>No exercises match &ldquo;{query}&rdquo;.</>
          )}
        </p>
      )}

      <ul className="catalogue-screen__list">
        {results.map((exercise) => (
          <li key={exercise.id} className="catalogue-screen__row">
            <span>{exercise.canonicalName}</span>
            <button
              type="button"
              className="logging-button logging-button--icon-label"
              aria-label={`Manage ${exercise.canonicalName}`}
              onClick={() => setManaging(exercise)}
            >
              <Icon name="sliders" />
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
            const result = await renameExerciseInSession(managing.id, newName);
            if (result.status === 'renamed') await refresh();
            return result;
          }}
          onMerge={(survivorId, loserId) => {
            void mergeExercisesInSession(survivorId, loserId).then(refresh);
          }}
          onDeleteConfirm={() => {
            void deleteExerciseCascadeInSession(
              managing.id,
              hasHistory(managing.id),
              true,
            ).then(() => {
              setManaging(undefined);
              void refresh();
            });
          }}
          onEditTemplate={() => {
            setEditingTemplateFor(managing);
            setManaging(undefined);
          }}
          onClose={() => setManaging(undefined)}
        />
      )}
    </main>
  );
}
