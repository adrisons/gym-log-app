/**
 * FR-004/005: a past session's full detail, editable after the fact.
 * Reuses spec 001's own block/exercise-entry/set-row components — see
 * `application/diary/session-editing.ts`'s doc comment for the exact
 * editable surface and why undo is out of scope here.
 *
 * Mirrors LoggingScreen's layout conventions: a `loose` block (an implicit,
 * presentation-only container for an exercise added outside any block —
 * `application/ports/logging-draft.ts`'s `DraftBlock.loose`, never part of
 * the persisted `Block`) renders `bare` (no header/menu), even while
 * empty; an explicitly created block that just hasn't been named yet is
 * never `loose` and always keeps its header (FR-2). "Add exercise"/"Add
 * block" sit at the bottom, and each exercise's set-entry template
 * (ADR-0006) is editable through its own menu.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { requireStorage } from '@/application/storage-access';
import { useLoggingSession } from '@/application/logging/logging-store';
import {
  editableToSession,
  newEditableItemId,
  sessionToEditable,
} from '@/application/diary/session-editing';
import type { EditableSession } from '@/application/diary/session-editing';
import { searchExercises } from '@/application/search/exercise-search';
import { toBlockViewModel } from '@/application/logging/view-models';
import type {
  Exercise,
  Session,
  SessionId,
} from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { BlockCard } from '../logging/block-card';
import { ExerciseEntryCard } from '../logging/exercise-entry-card';
import { ExerciseSetList } from '../logging/exercise-set-list';
import { AddExerciseControl } from '../logging/add-exercise-control';
import { ExerciseTemplatePanel } from '../logging/exercise-template-panel';
import type { DraftBlock } from '@/application/logging/draft';
import './diary.css';

/** ADR-0008: rebuilds a block without `rounds`, for clearing it — mirrors
 * `application/logging/draft.ts`'s own `withoutRounds` (this screen edits
 * an `EditableSession` locally rather than going through that module's
 * actions, so it needs its own copy of the same shape-preserving rebuild). */
function withoutRounds(block: DraftBlock): DraftBlock {
  return {
    id: block.id,
    ...(block.name !== undefined ? { name: block.name } : {}),
    ...(block.loose !== undefined ? { loose: block.loose } : {}),
    type: block.type,
    exercises: block.exercises,
  };
}

export function SessionDetailScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  // Routed through the logging store's own action, not the bare use-case
  // directly: LoggingScreen reads its exercise templates from
  // `useLoggingSession.catalogue`, an independent in-memory copy that
  // survives navigation — bypassing it here would leave that store
  // showing the old template (and its set-entry controls) until its next
  // `initialize()`, long enough for a quick set entry there under
  // controls the user just changed on this screen.
  const updateExerciseTemplateInSession = useLoggingSession(
    (s) => s.updateExerciseTemplate,
  );
  // Same reasoning as above: creating an exercise here must also land in
  // useLoggingSession.catalogue, or a stale search on LoggingScreen could
  // miss the new exercise or offer to create a duplicate of it.
  const createExerciseInSession = useLoggingSession((s) => s.createExercise);
  const [original, setOriginal] = useState<Session | undefined>(undefined);
  const [editable, setEditable] = useState<EditableSession | undefined>(
    undefined,
  );
  const [catalogue, setCatalogue] = useState<Exercise[]>([]);
  const [bandLabels, setBandLabels] = useState<string[]>([]);
  const [editingTemplateFor, setEditingTemplateFor] = useState<
    Exercise | undefined
  >(undefined);

  // Guards the very first `editable` a load populates from re-triggering
  // the persist effect below with an unchanged snapshot — set right
  // before that initial `setEditable`, for the mount *and* for a later
  // `sessionId` change while this screen stays mounted.
  const skipNextSaveRef = useRef(true);

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
        skipNextSaveRef.current = true;
        setOriginal(session);
        setEditable(sessionToEditable(session));
      }
      setCatalogue(exercises);
      setBandLabels(labels);
    })();
  }, [sessionId]);

  // Chains every save onto one queue, so completion always lands in call
  // order regardless of individual network timing — without this, two
  // edits fired close together could have their writes resolve out of
  // order and leave the *older* edit persisted last, clobbering the
  // newer one despite the UI already showing it.
  const saveQueueRef = useRef(Promise.resolve());

  // Persists `editable` itself (the effect below), not each individual
  // edit's own snapshot — keeps this the single place that ever calls
  // `saveSession`, so it's also the only place that needs to serialize.
  useEffect(() => {
    if (!editable || !original) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const snapshot = editable;
    const attempt = saveQueueRef.current.then(() =>
      requireStorage().saveSession(editableToSession(snapshot, original)),
    );
    // Attaches `.catch` synchronously, in this same expression, so the
    // promise stored back into the ref is one that never itself rejects —
    // logging this attempt's failure (if any) right here rather than
    // leaving it for whichever later save happens to chain onto this ref
    // next. Without this, a rejected `saveQueueRef.current` would
    // permanently short-circuit every later `.then` in the chain past its
    // own `saveSession` call, silently dropping every edit from then on;
    // and attaching the recovery only when the *next* save chains onto it
    // would still report this rejection as unhandled in the meantime,
    // since nothing observes it before then.
    saveQueueRef.current = attempt.catch((error: unknown) => {
      console.error('Failed to save session', error);
    });
  }, [editable, original]);

  // Takes an updater, not a next value: every call site (including the
  // async onCreateExercise handlers below) can run after an `await`, by
  // which point a *different* edit may already have landed — updating
  // from a `next` object built off the render-time `editable` closure
  // would silently overwrite that intervening edit. `setEditable`'s
  // functional form always receives the true latest state, so `update`
  // always runs against it. The updater stays pure (no `saveSession` side
  // effect inside it, unlike an earlier version of this function) —
  // React may invoke a `setState` updater more than once for the same
  // commit (StrictMode's own impurity check among other reasons), and a
  // side effect inside one would fire that many times.
  const persist = (update: (current: EditableSession) => EditableSession) => {
    setEditable((current) => (current ? update(current) : current));
  };

  const addExerciseToBlock = (blockId: string, exerciseId: Exercise['id']) => {
    persist((current) => ({
      ...current,
      blocks: current.blocks.map((b) =>
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
    }));
  };

  // Attaches to the trailing block only if it's itself `loose` — an
  // implicit container this same path created earlier — or creates a
  // fresh `loose` one WITH the exercise already in it. An explicitly
  // created block the user hasn't named yet is NOT `loose` and must stay
  // its own block (FR-2: an unnamed block still shows its position and
  // stays renameable/deletable), never silently absorb a loose add just
  // because it currently has no name. Computed entirely inside the
  // updater (see `persist`'s own doc comment) so both the "which block is
  // trailing" decision and the append happen against the true latest
  // state, never a stale render-time snapshot.
  const addExerciseAtTopLevel = (exerciseId: Exercise['id']) => {
    persist((current) => {
      const lastBlock = current.blocks.at(-1);
      const newEntry = {
        id: newEditableItemId(),
        exerciseId,
        notes: '',
        sets: [],
      };
      if (lastBlock && lastBlock.loose === true) {
        return {
          ...current,
          blocks: current.blocks.map((b) =>
            b.id === lastBlock.id
              ? { ...b, exercises: [...b.exercises, newEntry] }
              : b,
          ),
        };
      }
      const block = {
        id: newEditableItemId(),
        loose: true,
        type: 'straightSets' as const,
        exercises: [newEntry],
      };
      return { ...current, blocks: [...current.blocks, block] };
    });
  };

  if (!sessionId) {
    return null;
  }

  if (!editable || !original) {
    return <main className="session-detail-screen" aria-label="Session" />;
  }

  // "Block N" position labels are computed from the ordinal among
  // non-loose blocks, never the raw array index — a `loose` container
  // renders with no label at all, so counting it would misnumber the
  // first *visible* block (e.g. a loose exercise followed by the user's
  // first "Add block" press would otherwise show that sole visible block
  // as "Block 2").
  const nonLooseBlocks = editable.blocks.filter((b) => b.loose !== true);

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
          key={editingTemplateFor.id}
          exercise={editingTemplateFor}
          onSave={(template) => {
            // Unlike LoggingScreen, this screen keeps its own separate
            // `catalogue` copy alongside the logging store's — awaits the
            // storage-backed action first and only echoes the template
            // into that local copy (and closes) on success, so a storage
            // failure never leaves this screen showing/recording against
            // an unsaved template with no retry path (the panel just stays
            // open instead).
            updateExerciseTemplateInSession(editingTemplateFor.id, template)
              .then(() => {
                setCatalogue((current) =>
                  current.map((exercise) =>
                    exercise.id === editingTemplateFor.id
                      ? { ...exercise, ...template }
                      : exercise,
                  ),
                );
                setEditingTemplateFor(undefined);
              })
              .catch((error: unknown) => {
                console.error('Failed to save exercise template', error);
              });
          }}
          onClose={() => setEditingTemplateFor(undefined)}
        />
      )}

      {editable.blocks.map((block) => {
        const blockVm = toBlockViewModel(
          block,
          nonLooseBlocks.findIndex((b) => b.id === block.id),
          catalogue,
        );
        const totalSets = block.exercises.reduce(
          (sum, entry) => sum + entry.sets.length,
          0,
        );
        // No `exercises.length > 0` guard: a `loose` block stays bare even
        // once emptied by deleting its last exercise — it's still an
        // implicit container the user never asked to see as a block.
        const isBare = block.loose === true;

        return (
          <BlockCard
            key={block.id}
            displayName={blockVm.displayName}
            hasName={block.name !== undefined}
            bare={isBare}
            subtitle={`${block.exercises.length} exercise${block.exercises.length === 1 ? '' : 's'} · ${totalSets} set${totalSets === 1 ? '' : 's'} logged`}
            rounds={block.rounds}
            onRename={(name) =>
              persist((editable) => ({
                ...editable,
                blocks: editable.blocks.map((b) =>
                  b.id === block.id
                    ? { ...b, ...(name !== undefined ? { name } : {}) }
                    : b,
                ),
              }))
            }
            onSetRounds={(rounds) =>
              persist((editable) => ({
                ...editable,
                blocks: editable.blocks.map((b) =>
                  b.id !== block.id
                    ? b
                    : rounds !== undefined
                      ? { ...b, rounds }
                      : withoutRounds(b),
                ),
              }))
            }
            onDelete={() =>
              persist((editable) => ({
                ...editable,
                blocks: editable.blocks.filter((b) => b.id !== block.id),
              }))
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
                      const exercise = await createExerciseInSession({
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
                      persist((editable) => ({
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
                      }))
                    }
                  >
                    <ExerciseSetList
                      sets={entry.sets}
                      loadKind={exercise?.defaultLoadType ?? 'none'}
                      volumeKind={exercise?.defaultVolumeKind ?? 'reps'}
                      trackEffort={exercise?.trackEffort ?? false}
                      bandLabels={bandLabels}
                      freeTextSuggestions={[]}
                      prefill={undefined}
                      onAddSet={(input) =>
                        persist((editable) => ({
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
                        }))
                      }
                      onUpdateSet={(setId, input) =>
                        persist((editable) => ({
                          ...editable,
                          blocks: editable.blocks.map((b) =>
                            b.id === block.id
                              ? {
                                  ...b,
                                  exercises: b.exercises.map((e) =>
                                    e.id === entry.id
                                      ? {
                                          ...e,
                                          sets: e.sets.map((s) =>
                                            s.id === setId
                                              ? {
                                                  id: setId,
                                                  ...(input.volume !== undefined
                                                    ? { volume: input.volume }
                                                    : {}),
                                                  load: input.load,
                                                  ...(input.effort !== undefined
                                                    ? { effort: input.effort }
                                                    : {}),
                                                  setKind: input.setKind,
                                                  completed: true,
                                                }
                                              : s,
                                          ),
                                        }
                                      : e,
                                  ),
                                }
                              : b,
                          ),
                        }))
                      }
                      onDeleteSet={(setId) =>
                        persist((editable) => ({
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
                                            (s) => s.id !== setId,
                                          ),
                                        }
                                      : e,
                                  ),
                                }
                              : b,
                          ),
                        }))
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
            const exercise = await createExerciseInSession({
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
          persist((editable) => ({
            ...editable,
            blocks: [
              ...editable.blocks,
              { id: newEditableItemId(), type: 'straightSets', exercises: [] },
            ],
          }))
        }
      >
        <Icon name="plus" />
        Add block
      </button>
    </main>
  );
}
