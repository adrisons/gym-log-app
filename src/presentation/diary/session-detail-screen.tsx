/**
 * FR-004/005: a past session's full detail, editable after the fact.
 * Reuses spec 001's own block/exercise-entry/set-row components — see
 * `application/diary/session-editing.ts`'s doc comment for the exact
 * editable surface and why undo is out of scope here.
 *
 * Mirrors LoggingScreen's layout conventions: a block with no name renders
 * `bare` (no header/menu) once it has exercises, "Add exercise"/"Add
 * block" sit at the bottom, and each exercise's set-entry template
 * (ADR-0006) is editable through its own menu.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { requireStorage } from '@/application/storage-access';
import {
  editableToSession,
  newEditableItemId,
  sessionToEditable,
} from '@/application/diary/session-editing';
import type { EditableSession } from '@/application/diary/session-editing';
import { searchExercises } from '@/application/search/exercise-search';
import {
  toBlockViewModel,
  toSetSummaryViewModel,
} from '@/application/logging/view-models';
import {
  createExercise,
  updateExerciseTemplate,
} from '@/application/logging/use-cases';
import type {
  Exercise,
  Session,
  SessionId,
} from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { BlockCard } from '../logging/block-card';
import { ExerciseEntryCard } from '../logging/exercise-entry-card';
import { SetRow } from '../logging/set-row';
import { AddExerciseControl } from '../logging/add-exercise-control';
import { ExerciseTemplatePanel } from '../logging/exercise-template-panel';
import './diary.css';

export function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [original, setOriginal] = useState<Session | undefined>(undefined);
  const [editable, setEditable] = useState<EditableSession | undefined>(
    undefined,
  );
  const [catalogue, setCatalogue] = useState<Exercise[]>([]);
  const [bandLabels, setBandLabels] = useState<string[]>([]);
  const [editingTemplateFor, setEditingTemplateFor] = useState<
    Exercise | undefined
  >(undefined);

  useEffect(() => {
    if (!sessionId) return;
    void (async () => {
      const storage = requireStorage();
      const [session, exercises, labels] = await Promise.all([
        storage.getSession(sessionId as SessionId),
        storage.listExercises(),
        storage.listBandLabels(),
      ]);
      if (session) {
        setOriginal(session);
        setEditable(sessionToEditable(session));
      }
      setCatalogue(exercises);
      setBandLabels(labels);
    })();
  }, [sessionId]);

  const persist = (next: EditableSession) => {
    setEditable(next);
    if (!original) return;
    void requireStorage().saveSession(editableToSession(next, original));
  };

  const addExerciseToBlock = (blockId: string, exerciseId: Exercise['id']) => {
    if (!editable) return;
    persist({
      ...editable,
      blocks: editable.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              exercises: [
                ...b.exercises,
                {
                  id: newEditableItemId(),
                  exerciseId,
                  notes: '',
                  sets: [],
                },
              ],
            }
          : b,
      ),
    });
  };

  // Attaches to the trailing unnamed block, or creates a fresh one WITH
  // the exercise already in it and persists once — building the block and
  // its first entry in two separate `persist` calls would have the second
  // (`addExerciseToBlock`) close over the pre-first-persist `editable`
  // (React state updates aren't synchronous), so it could never find the
  // block it just asked to create and would silently drop it.
  const addExerciseAtTopLevel = (exerciseId: Exercise['id']) => {
    if (!editable) return;
    const lastBlock = editable.blocks.at(-1);
    if (lastBlock && lastBlock.name === undefined) {
      addExerciseToBlock(lastBlock.id, exerciseId);
      return;
    }
    const block = {
      id: newEditableItemId(),
      type: 'straightSets' as const,
      exercises: [{ id: newEditableItemId(), exerciseId, notes: '', sets: [] }],
    };
    persist({ ...editable, blocks: [...editable.blocks, block] });
  };

  if (!sessionId) {
    return null;
  }

  if (!editable || !original) {
    return <main className="session-detail-screen" aria-label="Session" />;
  }

  return (
    <main className="session-detail-screen" aria-label="Session detail">
      <div className="session-detail-screen__header">
        <h1>Session — {new Date(editable.dateTime).toLocaleString()}</h1>
        <button
          type="button"
          className="logging-button session-detail-screen__close"
          aria-label="Close"
          onClick={() => navigate('/diary')}
        >
          <Icon name="close" />
        </button>
      </div>

      {editingTemplateFor && (
        <ExerciseTemplatePanel
          exercise={editingTemplateFor}
          onSave={(template) => {
            void updateExerciseTemplate(
              requireStorage(),
              editingTemplateFor.id,
              template,
            ).then(() => {
              setCatalogue((current) =>
                current.map((exercise) =>
                  exercise.id === editingTemplateFor.id
                    ? { ...exercise, ...template }
                    : exercise,
                ),
              );
            });
            setEditingTemplateFor(undefined);
          }}
          onClose={() => setEditingTemplateFor(undefined)}
        />
      )}

      {editable.blocks.map((block, blockIndex) => {
        const blockVm = toBlockViewModel(block, blockIndex, catalogue);
        const totalSets = block.exercises.reduce(
          (sum, entry) => sum + entry.sets.length,
          0,
        );
        const isBare = block.name === undefined && block.exercises.length > 0;

        return (
          <BlockCard
            key={block.id}
            displayName={blockVm.displayName}
            hasName={block.name !== undefined}
            bare={isBare}
            subtitle={`${block.exercises.length} exercise${block.exercises.length === 1 ? '' : 's'} · ${totalSets} set${totalSets === 1 ? '' : 's'} logged`}
            onRename={(name) =>
              persist({
                ...editable,
                blocks: editable.blocks.map((b) =>
                  b.id === block.id
                    ? { ...b, ...(name !== undefined ? { name } : {}) }
                    : b,
                ),
              })
            }
            onDelete={() =>
              persist({
                ...editable,
                blocks: editable.blocks.filter((b) => b.id !== block.id),
              })
            }
            footer={
              isBare ? undefined : (
                <AddExerciseControl
                  buttonLabel={`Add exercise to ${blockVm.displayName}`}
                  fieldLabel={`Add exercise to ${blockVm.displayName}`}
                  search={(query) => searchExercises(query, catalogue)}
                  onSelectExercise={(exercise) =>
                    addExerciseToBlock(block.id, exercise.id)
                  }
                  onCreateExercise={(name) => {
                    void (async () => {
                      const exercise = await createExercise(requireStorage(), {
                        canonicalName: name,
                      });
                      setCatalogue((current) => [...current, exercise]);
                      addExerciseToBlock(block.id, exercise.id);
                    })();
                  }}
                />
              )
            }
          >
            {block.exercises.map((entry, entryIndex) => {
              const entryVm = blockVm.entries[entryIndex]!;
              const exercise = catalogue.find((e) => e.id === entry.exerciseId);
              return (
                <div key={entry.id}>
                  <Link to={`/exercises/${entry.exerciseId}/progression`}>
                    View {entryVm.exerciseName} progression
                  </Link>
                  <ExerciseEntryCard
                    exerciseName={entryVm.exerciseName}
                    canMoveUp={false}
                    canMoveDown={false}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                    otherBlocks={[]}
                    onMoveToBlock={() => {}}
                    onEditTemplate={
                      exercise
                        ? () => setEditingTemplateFor(exercise)
                        : undefined
                    }
                    onDelete={() =>
                      persist({
                        ...editable,
                        blocks: editable.blocks.map((b) =>
                          b.id === block.id
                            ? {
                                ...b,
                                exercises: b.exercises.filter(
                                  (e) => e.id !== entry.id,
                                ),
                              }
                            : b,
                        ),
                      })
                    }
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
                              className="logging-button logging-button--icon-label"
                              onClick={() =>
                                persist({
                                  ...editable,
                                  blocks: editable.blocks.map((b) =>
                                    b.id === block.id
                                      ? {
                                          ...b,
                                          exercises: b.exercises.map((e) =>
                                            e.id === entry.id
                                              ? {
                                                  ...e,
                                                  sets: e.sets.filter(
                                                    (s) => s.id !== vm.id,
                                                  ),
                                                }
                                              : e,
                                          ),
                                        }
                                      : b,
                                  ),
                                })
                              }
                            >
                              <Icon name="trash" />
                              Delete set
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <SetRow
                      key={`${entry.id}-${entry.sets.length}-${exercise?.defaultLoadType ?? 'none'}-${exercise?.defaultVolumeKind ?? 'reps'}-${exercise?.trackEffort ?? false}`}
                      prefill={undefined}
                      loadKind={exercise?.defaultLoadType ?? 'none'}
                      volumeKind={exercise?.defaultVolumeKind ?? 'reps'}
                      trackEffort={exercise?.trackEffort ?? false}
                      bandLabels={bandLabels}
                      freeTextSuggestions={[]}
                      onConfirm={(input) =>
                        persist({
                          ...editable,
                          blocks: editable.blocks.map((b) =>
                            b.id === block.id
                              ? {
                                  ...b,
                                  exercises: b.exercises.map((e) =>
                                    e.id === entry.id
                                      ? {
                                          ...e,
                                          sets: [
                                            ...e.sets,
                                            {
                                              id: newEditableItemId(),
                                              ...(input.volume !== undefined
                                                ? { volume: input.volume }
                                                : {}),
                                              load: input.load,
                                              ...(input.effort !== undefined
                                                ? { effort: input.effort }
                                                : {}),
                                              setKind: input.setKind,
                                              completed: true,
                                            },
                                          ],
                                        }
                                      : e,
                                  ),
                                }
                              : b,
                          ),
                        })
                      }
                      onSaveBandLabels={(labels) => setBandLabels(labels)}
                    />
                  </ExerciseEntryCard>
                </div>
              );
            })}
          </BlockCard>
        );
      })}

      <AddExerciseControl
        buttonLabel="Add exercise"
        fieldLabel="Exercise"
        search={(query) => searchExercises(query, catalogue)}
        onSelectExercise={(exercise) => addExerciseAtTopLevel(exercise.id)}
        onCreateExercise={(name) => {
          void (async () => {
            const exercise = await createExercise(requireStorage(), {
              canonicalName: name,
            });
            setCatalogue((current) => [...current, exercise]);
            addExerciseAtTopLevel(exercise.id);
          })();
        }}
      />
      <button
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={() =>
          persist({
            ...editable,
            blocks: [
              ...editable.blocks,
              { id: newEditableItemId(), type: 'straightSets', exercises: [] },
            ],
          })
        }
      >
        <Icon name="plus" />
        Add block
      </button>
    </main>
  );
}
