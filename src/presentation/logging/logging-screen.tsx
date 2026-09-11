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
 * US2: renders through `BlockCard`/`ExerciseEntryCard` — blocks are now
 * user-visible/manageable (create, rename, reorder, delete-with-undo),
 * replacing US1's flat list.
 */
import { useEffect, useState } from 'react';
import { useLoggingSession } from '@/application/logging/logging-store';
import {
  toBlockViewModel,
  toSetSummaryViewModel,
} from '@/application/logging/view-models';
import type { Exercise } from '@/application/logging/use-cases';
import { SessionDateTimeField } from './session-date-time-field';
import { ExerciseSearchField } from './exercise-search-field';
import { SetRow } from './set-row';
import { BlockCard } from './block-card';
import { ExerciseEntryCard } from './exercise-entry-card';
import { UndoToast } from './undo-toast';
import { ExerciseCataloguePanel } from './exercise-catalogue-panel';
import './logging.css';

const UNDO_MESSAGES = {
  block: 'Block deleted',
  exerciseEntry: 'Exercise deleted',
  set: 'Set deleted',
} as const;

export function LoggingScreen() {
  const draft = useLoggingSession((s) => s.draft);
  const catalogue = useLoggingSession((s) => s.catalogue);
  const undoStack = useLoggingSession((s) => s.undoStack);
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
  const addBlock = useLoggingSession((s) => s.addBlock);
  const renameBlock = useLoggingSession((s) => s.renameBlock);
  const reorderBlockExercise = useLoggingSession((s) => s.reorderBlockExercise);
  const moveExerciseAcrossBlocks = useLoggingSession(
    (s) => s.moveExerciseAcrossBlocks,
  );
  const deleteBlock = useLoggingSession((s) => s.deleteBlock);
  const deleteExerciseEntry = useLoggingSession((s) => s.deleteExerciseEntry);
  const deleteSet = useLoggingSession((s) => s.deleteSet);
  const undo = useLoggingSession((s) => s.undo);
  const sessions = useLoggingSession((s) => s.sessions);
  const renameExerciseWithCollisionCheck = useLoggingSession(
    (s) => s.renameExerciseWithCollisionCheck,
  );
  const mergeExercises = useLoggingSession((s) => s.mergeExercises);
  const deleteExerciseCascade = useLoggingSession(
    (s) => s.deleteExerciseCascade,
  );

  const [managingExercise, setManagingExercise] = useState<
    Exercise | undefined
  >(undefined);

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
        onManageExercise={setManagingExercise}
      />

      {managingExercise &&
        (() => {
          const hasHistory = sessions.some((session) =>
            session.blocks.some((block) =>
              block.exercises.some(
                (entry) => entry.exerciseId === managingExercise.id,
              ),
            ),
          );
          return (
            <ExerciseCataloguePanel
              exercise={managingExercise}
              hasHistory={hasHistory}
              search={searchExercises}
              onRename={(newName) =>
                renameExerciseWithCollisionCheck(managingExercise.id, newName)
              }
              onMerge={(survivorId, loserId) =>
                void mergeExercises(survivorId, loserId)
              }
              onDeleteConfirm={() => {
                void deleteExerciseCascade(
                  managingExercise.id,
                  hasHistory,
                  true,
                );
                setManagingExercise(undefined);
              }}
              onClose={() => setManagingExercise(undefined)}
            />
          );
        })()}

      <button
        type="button"
        className="logging-button"
        onClick={() => void addBlock(undefined, 'straightSets')}
      >
        Add block
      </button>

      {draft.blocks.map((block, blockIndex) => {
        const blockVm = toBlockViewModel(block, blockIndex, catalogue);
        const otherBlocks = draft.blocks
          .map((b, i) => toBlockViewModel(b, i, catalogue))
          .filter((vm) => vm.id !== block.id)
          .map((vm) => ({ id: vm.id, displayName: vm.displayName }));

        return (
          <BlockCard
            key={block.id}
            displayName={blockVm.displayName}
            hasName={block.name !== undefined}
            onRename={(name) => void renameBlock(block.id, name)}
            onDelete={() => void deleteBlock(block.id)}
          >
            {block.exercises.map((entry, entryIndex) => {
              const entryVm = blockVm.entries[entryIndex]!;
              return (
                <ExerciseEntryCard
                  key={entry.id}
                  exerciseName={entryVm.exerciseName}
                  canMoveUp={entryIndex > 0}
                  canMoveDown={entryIndex < block.exercises.length - 1}
                  onMoveUp={() =>
                    void reorderBlockExercise(
                      block.id,
                      entryIndex,
                      entryIndex - 1,
                    )
                  }
                  onMoveDown={() =>
                    void reorderBlockExercise(
                      block.id,
                      entryIndex,
                      entryIndex + 1,
                    )
                  }
                  otherBlocks={otherBlocks}
                  onMoveToBlock={(toBlockId) =>
                    void moveExerciseAcrossBlocks(block.id, entry.id, toBlockId)
                  }
                  onDelete={() => void deleteExerciseEntry(block.id, entry.id)}
                >
                  <ul className="set-list">
                    {entry.sets.map((set) => {
                      const vm = toSetSummaryViewModel(set);
                      return (
                        <li key={vm.id} className="set-summary">
                          <span>{vm.loadLabel}</span>
                          <span>{vm.volumeLabel}</span>
                          <button
                            type="button"
                            className="logging-button"
                            onClick={() =>
                              void deleteSet(block.id, entry.id, vm.id)
                            }
                          >
                            Delete set
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <SetRow
                    key={`${entry.id}-${entry.sets.length}`}
                    prefill={prefillNextSet(block.id, entry.id)}
                    defaultLoadKind={
                      catalogue.find((e) => e.id === entry.exerciseId)
                        ?.defaultLoadType ?? 'none'
                    }
                    bandLabels={bandLabels}
                    freeTextSuggestions={suggestFreeTextLoads(entry.exerciseId)}
                    onConfirm={(input) =>
                      void addSet(block.id, entry.id, input)
                    }
                    onLoadTypeChange={(kind) =>
                      void recordLoadTypeDefault(entry.exerciseId, kind)
                    }
                    onSaveBandLabels={(labels) => void saveBandLabels(labels)}
                  />
                </ExerciseEntryCard>
              );
            })}
          </BlockCard>
        );
      })}

      <div aria-live="polite">
        {undoStack.map((entry) => (
          <UndoToast
            key={entry.id}
            message={UNDO_MESSAGES[entry.kind]}
            expiresAt={entry.expiresAt}
            onUndo={() => void undo(entry.id)}
          />
        ))}
      </div>
    </main>
  );
}
