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
 * replacing US1's flat list. Exercise catalogue management (rename/merge/
 * delete) lives on its own `/exercises` screen so this one stays focused
 * on the single primary action of recording a set (docs/design.md §2).
 *
 * A `loose` block (`DraftBlock.loose`, presentation-only — never part of
 * the persisted `Block`) renders `bare` — no header, no menu, its
 * exercises shown directly, even while empty — so an exercise added
 * without ever tapping "Add block" never looks like it's sitting inside a
 * block the user didn't ask for. `loose` is distinct from having no name:
 * an explicitly created block that hasn't been named yet is never `loose`
 * and always keeps its header (position label, rename, delete — FR-2).
 * "Add exercise"/"Add block" sit at the bottom of the screen, after
 * whatever's already there, matching the natural order of adding to
 * something you can already see.
 *
 * `docs/requirements.md` FR-1 (design-refinement pass): reached from a
 * floating action on the diary rather than a nav tab, so a "‹ Diary" link
 * replaces what used to be implicit (the logging screen no longer lives
 * at the app's root). `DiaryScreen`'s one-shot save acknowledgement
 * (`docs/design.md` §1.1's bounded exception) reads
 * `useLoggingSession`'s own `justLoggedASet` flag rather than router state
 * handed off by this link — a plain "‹ Diary" `Link` with no `state` at
 * all works for every way of leaving this screen (this link, a browser
 * back/swipe gesture, …), where router state only ever covered the one
 * explicit link. `justLoggedASet` is set the moment `addSet` actually
 * records a set (not merely whether the draft *currently has* any — a
 * same-day draft reopened with sets already in it must not falsely claim
 * this visit saved something) and reset on the next `initialize()`. This
 * is presentation-only signaling between two screens, not a change to
 * D6/FR-024's draft lifecycle: the draft itself is already saved
 * continuously and keeps no open/closed state.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoggingSession } from '@/application/logging/logging-store';
import {
  toBlockViewModel,
  toSetSummaryViewModel,
} from '@/application/logging/view-models';
import type { Exercise } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { prefersReducedMotion } from '@/presentation/design/motion';
import { SessionDateTimeField } from './session-date-time-field';
import { AddExerciseControl } from './add-exercise-control';
import { SetRow } from './set-row';
import { BlockCard } from './block-card';
import { ExerciseEntryCard } from './exercise-entry-card';
import { ExerciseTemplatePanel } from './exercise-template-panel';
import { OverflowMenu } from './overflow-menu';
import { UndoToast } from './undo-toast';
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
  const lastAddedSetId = useLoggingSession((s) => s.lastAddedSetId);
  const clearLastAddedSetId = useLoggingSession((s) => s.clearLastAddedSetId);
  const prefillNextSet = useLoggingSession((s) => s.prefillNextSet);
  const searchExercises = useLoggingSession((s) => s.searchExercises);
  const createExercise = useLoggingSession((s) => s.createExercise);
  const bandLabels = useLoggingSession((s) => s.bandLabels);
  const updateExerciseTemplate = useLoggingSession(
    (s) => s.updateExerciseTemplate,
  );
  const suggestFreeTextLoads = useLoggingSession((s) => s.suggestFreeTextLoads);
  const saveBandLabels = useLoggingSession((s) => s.saveBandLabels);
  const addBlock = useLoggingSession((s) => s.addBlock);
  const renameBlock = useLoggingSession((s) => s.renameBlock);
  const setBlockRounds = useLoggingSession((s) => s.setBlockRounds);
  const reorderBlockExercise = useLoggingSession((s) => s.reorderBlockExercise);
  const moveExerciseAcrossBlocks = useLoggingSession(
    (s) => s.moveExerciseAcrossBlocks,
  );
  const deleteBlock = useLoggingSession((s) => s.deleteBlock);
  const deleteExerciseEntry = useLoggingSession((s) => s.deleteExerciseEntry);
  const deleteSet = useLoggingSession((s) => s.deleteSet);
  const undo = useLoggingSession((s) => s.undo);

  const [editingTemplateFor, setEditingTemplateFor] = useState<
    Exercise | undefined
  >(undefined);

  useEffect(() => {
    void initialize();
    // initialize is a stable Zustand action reference; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-shot consumption: `lastAddedSetId` marks exactly one `.set-summary`
  // row (`set-summary--new` below) for the entrance animation. Left set
  // indefinitely, an unrelated remount of this same route — or a
  // delete-then-undo that restores a set under its original id — would
  // reapply that animation to a row that isn't actually new anymore
  // (Copilot review, PR #22). The marked row's own `onAnimationEnd`
  // consumes it in the normal case (below) — no separate duration
  // constant to keep in sync with logging.css's `set-summary-enter`,
  // which would silently drift the moment either one changes. Reduced
  // motion never fires that animation at all, so it's consumed
  // immediately here instead.
  useEffect(() => {
    if (lastAddedSetId !== undefined && prefersReducedMotion()) {
      clearLastAddedSetId();
    }
  }, [lastAddedSetId, clearLastAddedSetId]);

  // Unmounting (navigating away) before the marked row's own
  // `onAnimationEnd` fires must still consume the marker — otherwise a
  // later remount of this same route, before initialize() resolves, could
  // replay the animation for a row left over from a previous visit.
  // Empty deps deliberately: this must run only on true unmount, reading
  // whatever is live in the store at that moment, never on every
  // lastAddedSetId change (which would just be re-added a moment later).
  useEffect(() => {
    return () => {
      useLoggingSession.getState().clearLastAddedSetId();
    };
  }, []);

  if (!draft) {
    return <main className="logging-screen" aria-label="Log a session" />;
  }

  // Position labels ("Block N") and "Move to block" targets are both
  // computed from the ordinal among non-loose blocks, never the raw array
  // index — a `loose` container renders with no label at all, so counting
  // it would misnumber the first *visible* block (e.g. a loose exercise
  // followed by the user's first "Add block" press would otherwise show
  // that sole visible block as "Block 2") and would also offer it as a
  // synthetic, headerless move target.
  const nonLooseBlocks = draft.blocks.filter((b) => b.loose !== true);

  return (
    <main className="logging-screen" aria-label="Log a session">
      <Link to="/diary" className="logging-button logging-button--icon-label">
        <Icon name="chevron-right" style={{ transform: 'rotate(180deg)' }} />
        Diary
      </Link>
      <h1>Log a session</h1>
      <SessionDateTimeField
        value={draft.dateTime}
        onChange={(iso) => void setSessionDateTime(iso)}
      />

      {editingTemplateFor && (
        <ExerciseTemplatePanel
          key={editingTemplateFor.id}
          exercise={editingTemplateFor}
          onSave={(template) => {
            // Closes immediately either way (every logging interaction
            // responds immediately — docs/requirements.md §7.1): the store
            // action already rolls its own optimistic update back on a
            // storage failure, so this only needs to keep that rejection
            // from surfacing as an unhandled one.
            updateExerciseTemplate(editingTemplateFor.id, template).catch(
              (error: unknown) => {
                console.error('Failed to save exercise template', error);
              },
            );
            setEditingTemplateFor(undefined);
          }}
          onClose={() => setEditingTemplateFor(undefined)}
        />
      )}

      {draft.blocks.map((block) => {
        const blockVm = toBlockViewModel(
          block,
          nonLooseBlocks.findIndex((b) => b.id === block.id),
          catalogue,
        );
        const otherBlocks = nonLooseBlocks
          .filter((b) => b.id !== block.id)
          .map((b) =>
            toBlockViewModel(
              b,
              nonLooseBlocks.findIndex((x) => x.id === b.id),
              catalogue,
            ),
          )
          .map((vm) => ({ id: vm.id, displayName: vm.displayName }));
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
            onRename={(name) => void renameBlock(block.id, name)}
            onSetRounds={(rounds) => void setBlockRounds(block.id, rounds)}
            onDelete={() => void deleteBlock(block.id)}
            footer={
              isBare ? undefined : (
                <AddExerciseControl
                  buttonLabel={`Add exercise to ${blockVm.displayName}`}
                  fieldLabel={`Add exercise to ${blockVm.displayName}`}
                  search={searchExercises}
                  onSelectExercise={(exercise) =>
                    void addExerciseEntry(exercise.id, block.id)
                  }
                  onCreateExercise={(name) => {
                    void (async () => {
                      const exercise = await createExercise({
                        canonicalName: name,
                      });
                      await addExerciseEntry(exercise.id, block.id);
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
                  onEditTemplate={
                    exercise ? () => setEditingTemplateFor(exercise) : undefined
                  }
                >
                  <ul className="set-list">
                    {entry.sets.map((set) => {
                      const vm = toSetSummaryViewModel(set);
                      const isNewest = vm.id === lastAddedSetId;
                      return (
                        <li
                          key={vm.id}
                          className={
                            isNewest
                              ? 'set-summary set-summary--new'
                              : 'set-summary'
                          }
                          {...(isNewest
                            ? { onAnimationEnd: () => clearLastAddedSetId() }
                            : {})}
                        >
                          <span>{vm.loadLabel}</span>
                          <span>{vm.volumeLabel}</span>
                          <OverflowMenu
                            label={`${vm.loadLabel} ${vm.volumeLabel} actions`}
                          >
                            <button
                              type="button"
                              className="logging-button logging-button--icon-label"
                              onClick={() =>
                                void deleteSet(block.id, entry.id, vm.id)
                              }
                            >
                              <Icon name="trash" />
                              Delete set
                            </button>
                          </OverflowMenu>
                        </li>
                      );
                    })}
                  </ul>
                  <SetRow
                    key={`${entry.id}-${entry.sets.length}-${exercise?.defaultLoadType ?? 'none'}-${exercise?.defaultVolumeKind ?? 'reps'}-${exercise?.trackEffort ?? false}`}
                    prefill={prefillNextSet(block.id, entry.id)}
                    loadKind={exercise?.defaultLoadType ?? 'none'}
                    volumeKind={exercise?.defaultVolumeKind ?? 'reps'}
                    trackEffort={exercise?.trackEffort ?? false}
                    bandLabels={bandLabels}
                    freeTextSuggestions={suggestFreeTextLoads(entry.exerciseId)}
                    onConfirm={(input) => void addSet(entry.id, input)}
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

      <AddExerciseControl
        buttonLabel="Add exercise"
        fieldLabel="Exercise"
        search={searchExercises}
        onSelectExercise={(exercise) => void addExerciseEntry(exercise.id)}
        onCreateExercise={(name) => {
          void (async () => {
            const exercise = await createExercise({ canonicalName: name });
            await addExerciseEntry(exercise.id);
          })();
        }}
      />
      <button
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={() => void addBlock(undefined, 'straightSets')}
      >
        <Icon name="plus" />
        Add block
      </button>
    </main>
  );
}
