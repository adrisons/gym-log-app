/**
 * FR-004/005: a past session's full detail, editable after the fact.
 * Reuses spec 001's own block/exercise-entry/set-row components — see
 * `application/diary/session-editing.ts`'s doc comment for the exact
 * editable surface and why undo is out of scope here.
 *
 * Mirrors LoggingScreen's layout conventions (ADR-0011): every exercise
 * belongs to a real block — there is no implicit "loose" container any
 * more. "Add block" sits at the bottom; each block has its own "Add
 * exercise to …" footer control, and each exercise's set-entry template
 * (ADR-0006) is editable through its own menu.
 *
 * Saving is explicit (design-refinement request), the same as creating a
 * new session (`LoggingScreen`'s own "Log workout"): every edit here only
 * touches this screen's local `editable` state, and nothing reaches
 * `StoragePort.saveSession` until "Save session" is pressed. "Discard
 * changes" navigates away without saving instead. Both then leave for the
 * diary — there is nothing left on this screen to keep looking at once
 * either one runs. Scope note: "Discard changes" only ever covers this
 * screen's own block/exercise-entry/set edits (`editable`) — an exercise
 * *template* edit (`ExerciseTemplatePanel`'s own "Save changes") persists
 * immediately, the same as it does from `LoggingScreen`, since ADR-0006
 * already treats a template as catalogue-level and independent of any
 * particular session's edit history (Copilot review, PR #42).
 *
 * `dirtyRef` tracks whether `editable` has actually been edited since load
 * (or since the last save) — `backGuard` below reads it to ask for
 * confirmation before the navbar's own back arrow (reachable from
 * anywhere on this screen, unlike "Discard changes") would otherwise
 * silently drop those edits (Copilot review, PR #42).
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
import { useSettingsStore } from '@/application/settings-store';
import type {
  Exercise,
  Session,
  SessionId,
} from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { useSetScreenTitle } from '@/presentation/nav/screen-title';
import { BlockCard } from '../logging/block-card';
import { ExerciseEntryCard } from '../logging/exercise-entry-card';
import { ExerciseSetList } from '../logging/exercise-set-list';
import { AddExerciseControl } from '../logging/add-exercise-control';
import { ExerciseTemplatePanel } from '../logging/exercise-template-panel';
import './diary.css';

export function SessionDetailScreen() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
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
  const settings = useSettingsStore((s) => s.settings);
  const [editingTemplateFor, setEditingTemplateFor] = useState<
    Exercise | undefined
  >(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Not state: read only inside `backGuard`/`handleDiscard`, both called
  // from an event handler rather than during render, so there's nothing
  // for a `useState` here to ever cause a re-render for.
  const dirtyRef = useRef(false);
  // Every in-flight `createExerciseInSession` call (the two `onCreateExercise`
  // handlers below) — gates "Save session" shut while any is pending, so a
  // quick tap can't serialize `editable` from *before* that call's own
  // `addExerciseToBlock` lands, silently dropping the new entry (Copilot
  // review, PR #42).
  const [pendingCreates, setPendingCreates] = useState(0);

  useSetScreenTitle(
    editable
      ? `Session — ${new Date(editable.dateTime).toLocaleString()}`
      : 'Session',
    '/diary',
    () =>
      !dirtyRef.current ||
      window.confirm('Discard your unsaved changes to this session?'),
  );

  useEffect(() => {
    if (!sessionId) return;
    void (async () => {
      const storage = requireStorage();
      const [session, exercises] = await Promise.all([
        storage.getSession(sessionId as SessionId),
        storage.listExercises(),
      ]);
      if (session) {
        dirtyRef.current = false;
        setOriginal(session);
        setEditable(sessionToEditable(session));
      }
      setCatalogue(exercises);
    })();
  }, [sessionId]);

  const handleSave = () => {
    if (!editable || !original || pendingCreates > 0) return;
    setSaving(true);
    setSaveError(false);
    void requireStorage()
      .saveSession(editableToSession(editable, original))
      .then(() => {
        dirtyRef.current = false;
        navigate('/diary');
      })
      .catch((error: unknown) => {
        console.error('Failed to save session', error);
        setSaving(false);
        setSaveError(true);
      });
  };

  const handleDiscard = () => {
    if (
      dirtyRef.current &&
      !window.confirm('Discard your unsaved changes to this session?')
    ) {
      return;
    }
    navigate('/diary');
  };

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
    dirtyRef.current = true;
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

  const moveBlock = (fromIndex: number, toIndex: number) => {
    persist((current) => {
      const blocks = [...current.blocks];
      const [moved] = blocks.splice(fromIndex, 1);
      if (!moved) return current;
      blocks.splice(toIndex, 0, moved);
      return { ...current, blocks };
    });
  };

  const moveExerciseWithinBlock = (
    blockId: string,
    fromIndex: number,
    toIndex: number,
  ) => {
    persist((current) => ({
      ...current,
      blocks: current.blocks.map((b) => {
        if (b.id !== blockId) return b;
        const exercises = [...b.exercises];
        const [moved] = exercises.splice(fromIndex, 1);
        if (!moved) return b;
        exercises.splice(toIndex, 0, moved);
        return { ...b, exercises };
      }),
    }));
  };

  const moveExerciseAcrossBlocks = (
    fromBlockId: string,
    entryId: string,
    toBlockId: string,
  ) => {
    persist((current) => {
      const fromBlock = current.blocks.find((b) => b.id === fromBlockId);
      const entry = fromBlock?.exercises.find((e) => e.id === entryId);
      if (!entry) return current;
      return {
        ...current,
        blocks: current.blocks.map((b) => {
          if (b.id === fromBlockId) {
            return {
              ...b,
              exercises: b.exercises.filter((e) => e.id !== entryId),
            };
          }
          if (b.id === toBlockId) {
            return { ...b, exercises: [...b.exercises, entry] };
          }
          return b;
        }),
      };
    });
  };

  if (!sessionId) {
    return null;
  }

  if (!editable || !original) {
    return <main className="session-detail-screen" aria-label="Session" />;
  }

  return (
    <main className="session-detail-screen" aria-label="Session detail">
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

      {editable.blocks.map((block, blockIndex) => {
        const blockVm = toBlockViewModel(block, blockIndex, catalogue);
        const otherBlocks = editable.blocks
          .filter((b) => b.id !== block.id)
          .map((b) =>
            toBlockViewModel(
              b,
              editable.blocks.findIndex((x) => x.id === b.id),
              catalogue,
            ),
          )
          .map((vm) => ({ id: vm.id, displayName: vm.displayName }));

        return (
          <BlockCard
            key={block.id}
            displayName={blockVm.displayName}
            hasName={block.name !== undefined}
            subtitle={`${block.exercises.length} exercise${block.exercises.length === 1 ? '' : 's'}`}
            canMoveUp={blockIndex > 0}
            canMoveDown={blockIndex < editable.blocks.length - 1}
            onMoveUp={() => moveBlock(blockIndex, blockIndex - 1)}
            onMoveDown={() => moveBlock(blockIndex, blockIndex + 1)}
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
            onDelete={() =>
              persist((editable) => ({
                ...editable,
                blocks: editable.blocks.filter((b) => b.id !== block.id),
              }))
            }
            footer={
              <AddExerciseControl
                buttonLabel={`Add exercise to ${blockVm.displayName}`}
                fieldLabel={`Add exercise to ${blockVm.displayName}`}
                search={(query) => searchExercises(query, catalogue)}
                onSelectExercise={(exercise) =>
                  addExerciseToBlock(block.id, exercise.id)
                }
                onCreateExercise={(name) => {
                  setPendingCreates((n) => n + 1);
                  void (async () => {
                    try {
                      const exercise = await createExerciseInSession({
                        canonicalName: name,
                      });
                      setCatalogue((current) => [...current, exercise]);
                      addExerciseToBlock(block.id, exercise.id);
                    } finally {
                      setPendingCreates((n) => n - 1);
                    }
                  })();
                }}
              />
            }
          >
            {block.exercises.map((entry, entryIndex) => {
              const entryVm = blockVm.entries[entryIndex]!;
              const exercise = catalogue.find((e) => e.id === entry.exerciseId);
              return (
                <div key={entry.id}>
                  <ExerciseEntryCard
                    exerciseName={entryVm.exerciseName}
                    canMoveUp={entryIndex > 0}
                    canMoveDown={entryIndex < block.exercises.length - 1}
                    onMoveUp={() =>
                      moveExerciseWithinBlock(
                        block.id,
                        entryIndex,
                        entryIndex - 1,
                      )
                    }
                    onMoveDown={() =>
                      moveExerciseWithinBlock(
                        block.id,
                        entryIndex,
                        entryIndex + 1,
                      )
                    }
                    otherBlocks={otherBlocks}
                    onMoveToBlock={(toBlockId) =>
                      moveExerciseAcrossBlocks(block.id, entry.id, toBlockId)
                    }
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
                      freeTextSuggestions={[]}
                      prefill={undefined}
                      unit={settings.defaultUnit}
                      quickIncrements={settings.quickIncrements}
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
                                          // FR-029's editable surface is
                                          // load/volume/effort only —
                                          // `setKind`/`completed` are kept
                                          // from `s` itself, not taken
                                          // from `input` (which always
                                          // carries the add-form's fixed
                                          // `setKind: 'working'`), so
                                          // correcting e.g. a warm-up set's
                                          // weight doesn't silently turn it
                                          // into a completed working set.
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
                                                  setKind: s.setKind,
                                                  completed: s.completed,
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
                    />
                  </ExerciseEntryCard>
                </div>
              );
            })}
          </BlockCard>
        );
      })}

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

      {saveError && (
        <p className="session-detail-screen__save-error" role="alert">
          Couldn&apos;t save your changes — check your connection and try again.
          Nothing here has been lost.
        </p>
      )}

      <div className="session-detail-screen__actions">
        <button
          type="button"
          className="logging-button logging-button--primary"
          disabled={saving || pendingCreates > 0}
          onClick={handleSave}
        >
          Save session
        </button>
        <button
          type="button"
          className="logging-button"
          disabled={saving}
          onClick={handleDiscard}
        >
          Discard changes
        </button>
      </div>
    </main>
  );
}
