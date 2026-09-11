/**
 * The logging screen root (FR-001). Calls `initialize` on mount; renders
 * whatever draft comes back with no loading spinner (constitution
 * Principle II, `docs/design.md` §4.4 — the fake/real port both resolve
 * fast enough that there is nothing meaningful to show a spinner for).
 *
 * Takes no `StoragePort` prop — the composition root calls
 * `useLoggingSession.getState().configure(storage)` once, before this
 * screen first renders; `presentation/` must never see a persistence type
 * (`docs/architecture.md`'s table), so every store action already knows
 * which port to use (`logging-store.ts`).
 *
 * US1 scope: a flat exercise-entry/set list, no block chrome yet (US2
 * adds `BlockList`/`BlockCard` and swaps this screen to render through
 * them instead).
 */
import { useEffect } from 'react';
import { useLoggingSession } from '@/application/logging/logging-store';
import { toSetSummaryViewModel } from '@/application/logging/view-models';
import { SessionDateTimeField } from './session-date-time-field';
import { ExerciseSearchField } from './exercise-search-field';
import { SetRow } from './set-row';
import './logging.css';

export function LoggingScreen() {
  const draft = useLoggingSession((s) => s.draft);
  const catalogue = useLoggingSession((s) => s.catalogue);
  const initialize = useLoggingSession((s) => s.initialize);
  const setSessionDateTime = useLoggingSession((s) => s.setSessionDateTime);
  const addExerciseEntry = useLoggingSession((s) => s.addExerciseEntry);
  const addSet = useLoggingSession((s) => s.addSet);
  const prefillNextSet = useLoggingSession((s) => s.prefillNextSet);
  const searchExercises = useLoggingSession((s) => s.searchExercises);
  const createExercise = useLoggingSession((s) => s.createExercise);
  const bandLabels = useLoggingSession((s) => s.bandLabels);
  const recordLoadTypeDefault = useLoggingSession(
    (s) => s.recordLoadTypeDefault,
  );
  const suggestFreeTextLoads = useLoggingSession((s) => s.suggestFreeTextLoads);
  const saveBandLabels = useLoggingSession((s) => s.saveBandLabels);

  useEffect(() => {
    void initialize();
    // initialize is a stable Zustand action reference; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!draft) {
    return <main className="logging-screen" aria-label="Log a session" />;
  }

  return (
    <main className="logging-screen" aria-label="Log a session">
      <h1>Log a session</h1>
      <SessionDateTimeField
        value={draft.dateTime}
        onChange={(iso) => void setSessionDateTime(iso)}
      />
      <ExerciseSearchField
        search={searchExercises}
        onSelectExercise={(exercise) => void addExerciseEntry(exercise.id)}
        onCreateExercise={(name) => {
          void (async () => {
            const exercise = await createExercise({ canonicalName: name });
            await addExerciseEntry(exercise.id);
          })();
        }}
      />
      <ul className="set-list">
        {draft.blocks.flatMap((block) =>
          block.exercises.map((entry) => {
            const exercise = catalogue.find((e) => e.id === entry.exerciseId);
            return (
              <li key={entry.id}>
                <h2>{exercise?.canonicalName ?? 'Exercise'}</h2>
                <ul className="set-list">
                  {entry.sets.map((set) => {
                    const vm = toSetSummaryViewModel(set);
                    return (
                      <li key={vm.id} className="set-summary">
                        <span>{vm.loadLabel}</span>
                        <span>{vm.volumeLabel}</span>
                      </li>
                    );
                  })}
                </ul>
                <SetRow
                  key={`${entry.id}-${entry.sets.length}`}
                  prefill={prefillNextSet(block.id, entry.id)}
                  defaultLoadKind={exercise?.defaultLoadType ?? 'none'}
                  bandLabels={bandLabels}
                  freeTextSuggestions={suggestFreeTextLoads(entry.exerciseId)}
                  onConfirm={(input) => void addSet(block.id, entry.id, input)}
                  onLoadTypeChange={(kind) =>
                    void recordLoadTypeDefault(entry.exerciseId, kind)
                  }
                  onSaveBandLabels={(labels) => void saveBandLabels(labels)}
                />
              </li>
            );
          }),
        )}
      </ul>
    </main>
  );
}
