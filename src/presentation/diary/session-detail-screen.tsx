/**
 * FR-004/005: a past session's full detail, editable after the fact.
 * Reuses spec 001's own block/exercise-entry/set-row components — see
 * `application/diary/session-editing.ts`'s doc comment for the exact
 * editable surface and why undo is out of scope here.
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
import type {
  Exercise,
  Session,
  SessionId,
} from '@/application/logging/use-cases';
import { BlockCard } from '../logging/block-card';
import { ExerciseEntryCard } from '../logging/exercise-entry-card';
import { SetRow } from '../logging/set-row';
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
          ×
        </button>
      </div>

      <button
        type="button"
        className="logging-button"
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
        Add block
      </button>

      {editable.blocks.map((block, blockIndex) => {
        const blockVm = toBlockViewModel(block, blockIndex, catalogue);
        return (
          <BlockCard
            key={block.id}
            displayName={blockVm.displayName}
            hasName={block.name !== undefined}
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
              <label className="logging-screen__field-label">
                <span>Add exercise</span>
                <select
                  className="logging-field-input"
                  value=""
                  onChange={(event) => {
                    const exerciseId = event.target.value;
                    if (!exerciseId) return;
                    persist({
                      ...editable,
                      blocks: editable.blocks.map((b) =>
                        b.id === block.id
                          ? {
                              ...b,
                              exercises: [
                                ...b.exercises,
                                {
                                  id: newEditableItemId(),
                                  exerciseId: exerciseId as Exercise['id'],
                                  notes: '',
                                  sets: [],
                                },
                              ],
                            }
                          : b,
                      ),
                    });
                  }}
                >
                  <option value="" disabled>
                    Search…
                  </option>
                  {searchExercises('', catalogue).map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.canonicalName}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            {block.exercises.map((entry, entryIndex) => {
              const entryVm = blockVm.entries[entryIndex]!;
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
                              className="logging-button"
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
                              Delete set
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <SetRow
                      key={`${entry.id}-${entry.sets.length}`}
                      prefill={undefined}
                      defaultLoadKind={
                        catalogue.find((e) => e.id === entry.exerciseId)
                          ?.defaultLoadType ?? 'none'
                      }
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
                      onLoadTypeChange={() => {}}
                      onSaveBandLabels={(labels) => setBandLabels(labels)}
                    />
                  </ExerciseEntryCard>
                </div>
              );
            })}
          </BlockCard>
        );
      })}
    </main>
  );
}
