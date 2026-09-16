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
 * ADR-0011: every exercise now always belongs to a real block — the
 * earlier `loose` container for an exercise added without ever tapping
 * "Add block" is retired. `createDraft` seeds a fresh draft with one
 * unnamed block already in it, so there is always at least one block to
 * add an exercise to; the only way to add one is each block's own "Add
 * exercise to …" footer control, and "Add block" (bottom of the screen)
 * is how a second one gets created.
 *
 * `docs/requirements.md` FR-1 (design-refinement pass): reached from a
 * floating action on the diary rather than a nav tab, so a "‹ Diary" link
 * replaces what used to be implicit (the logging screen no longer lives
 * at the app's root). `DiaryScreen`'s one-shot save acknowledgement
 * (`docs/design.md` §1.1's bounded exception) reads `useLoggingSession`'s
 * own `justRegisteredWorkout` flag rather than router state handed off by
 * this link — a plain "‹ Diary" `Link` with no `state` at all works for
 * every way of leaving this screen (this link, a browser back/swipe
 * gesture, …), where router state only ever covered the one explicit
 * link. `justRegisteredWorkout` is set only by `registerWorkout`'s
 * success (ADR-0009, D16) — recording a set no longer implies a Session
 * was saved, only that the pending draft was — and reset on the next
 * `initialize()`.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useLoggingSession,
  draftHasContent,
} from '@/application/logging/logging-store';
import { toBlockViewModel } from '@/application/logging/view-models';
import { useSettingsStore } from '@/application/settings-store';
import type { Exercise } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { prefersReducedMotion } from '@/presentation/design/motion';
import { SessionDateTimeField } from './session-date-time-field';
import { AddExerciseControl } from './add-exercise-control';
import { ExerciseSetList } from './exercise-set-list';
import { BlockCard } from './block-card';
import { ExerciseEntryCard } from './exercise-entry-card';
import { ExerciseTemplatePanel } from './exercise-template-panel';
import { UndoToast } from './undo-toast';
import './logging.css';

const UNDO_MESSAGES = {
  block: 'Block deleted',
  exerciseEntry: 'Exercise deleted',
  set: 'Set deleted',
} as const;

export function LoggingScreen() {
  const navigate = useNavigate();
  const draft = useLoggingSession((s) => s.draft);
  const pendingDraft = useLoggingSession((s) => s.pendingDraft);
  const recoverPendingDraft = useLoggingSession((s) => s.recoverPendingDraft);
  const discardPendingDraft = useLoggingSession((s) => s.discardPendingDraft);
  const registerWorkout = useLoggingSession((s) => s.registerWorkout);
  const catalogue = useLoggingSession((s) => s.catalogue);
  const undoStack = useLoggingSession((s) => s.undoStack);
  const initialize = useLoggingSession((s) => s.initialize);
  const setSessionDateTime = useLoggingSession((s) => s.setSessionDateTime);
  const addExerciseEntry = useLoggingSession((s) => s.addExerciseEntry);
  const addSet = useLoggingSession((s) => s.addSet);
  const updateSet = useLoggingSession((s) => s.updateSet);
  const lastAddedSetId = useLoggingSession((s) => s.lastAddedSetId);
  const clearLastAddedSetId = useLoggingSession((s) => s.clearLastAddedSetId);
  const prefillNextSet = useLoggingSession((s) => s.prefillNextSet);
  const searchExercises = useLoggingSession((s) => s.searchExercises);
  const createExercise = useLoggingSession((s) => s.createExercise);
  const settings = useSettingsStore((s) => s.settings);
  const updateExerciseTemplate = useLoggingSession(
    (s) => s.updateExerciseTemplate,
  );
  const suggestFreeTextLoads = useLoggingSession((s) => s.suggestFreeTextLoads);
  const addBlock = useLoggingSession((s) => s.addBlock);
  const renameBlock = useLoggingSession((s) => s.renameBlock);
  const reorderBlock = useLoggingSession((s) => s.reorderBlock);
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

  // If the OS preference flips to reduced-motion while the marked row's
  // entrance animation is already mid-flight, the CSS rule above cancels
  // that running animation outright — a cancelled animation never fires
  // `animationend`, so the row's own consumption (below) would otherwise
  // never run and `lastAddedSetId` would stay stuck (Copilot review,
  // PR #22).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches && useLoggingSession.getState().lastAddedSetId) {
        useLoggingSession.getState().clearLastAddedSetId();
      }
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Unmounting (navigating away) before the marked row's own
  // `onAnimationEnd` fires must still consume the marker — otherwise a
  // later remount of this same route, before initialize() resolves, could
  // replay the animation for a row left over from a previous visit.
  // Empty deps deliberately: this must run only on true unmount, reading
  // whatever is live in the store at that moment, never on every
  // lastAddedSetId change (which would just be re-added a moment later).
  //
  // Known residual gap (Copilot review, PR #22): a `SetRow` debounce timer
  // deliberately survives unmount (ADR-0007) and can fire *after* this
  // cleanup runs, re-setting `lastAddedSetId` for a set that was in fact
  // just committed on the previous visit. A remount before `initialize()`'s
  // own (synchronous, top-of-function) reset reaches the store can then
  // paint one frame with that stale marker applied before it's cleared.
  // Not fixed here: doing so needs the reset to happen before this
  // component's first paint rather than in an effect (which only runs
  // after it), and every way to do that reaches outside this component's
  // own render — e.g. a Zustand `set()` call during another component's
  // render — trading a one-frame, rarely-reachable animation glitch for a
  // real risk of state-update-during-render issues. Left as is.
  useEffect(() => {
    return () => {
      useLoggingSession.getState().clearLastAddedSetId();
    };
  }, []);

  if (!draft) {
    return <main className="logging-screen" aria-label="Log a session" />;
  }

  return (
    // `.app-shell__content > *` (app-shell.css) expects exactly one flex
    // child per screen and sizes it `flex: 1 0 auto` — this single wrapper
    // is that one child, so `LoggingShell`'s content column doesn't also
    // try to grow the header alongside `.logging-screen` (Copilot review,
    // PR #33: that double-stretch made the header-less-than-full route
    // root taller than the viewport, producing a blank scroll region).
    // The header stays a fixed-size flex item; `.logging-screen` is the
    // one part that scrolls.
    <div className="logging-screen__root">
      {/* Matches `HeaderNav`'s own bar (`header-nav.css`) so the logging
          screen — the one screen with no `HeaderNav`, ADR-0009 — still
          reads as the same chrome as every other screen's header, rather
          than a visually distinct one-off. */}
      <header className="logging-screen__header">
        <Link
          to="/diary"
          className="logging-screen__back"
          aria-label="Back to diary"
        >
          <Icon name="chevron-right" style={{ transform: 'rotate(180deg)' }} />
        </Link>
        <h1 className="logging-screen__title">New session</h1>
      </header>
      <main className="logging-screen" aria-label="Log a session">
        {pendingDraft && (
          <div
            className="logging-screen__draft-banner"
            role="status"
            aria-label="Unregistered workout found"
          >
            <p>You have an unregistered workout from a previous visit.</p>
            <div className="logging-screen__draft-banner-actions">
              <button
                type="button"
                className="logging-button logging-button--primary"
                onClick={() => void recoverPendingDraft()}
              >
                Recover
              </button>
              <button
                type="button"
                className="logging-button"
                onClick={() => void discardPendingDraft()}
              >
                Discard
              </button>
            </div>
          </div>
        )}

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

        {draft.blocks.map((block, blockIndex) => {
          const blockVm = toBlockViewModel(block, blockIndex, catalogue);
          const otherBlocks = draft.blocks
            .filter((b) => b.id !== block.id)
            .map((b) =>
              toBlockViewModel(
                b,
                draft.blocks.findIndex((x) => x.id === b.id),
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
              canMoveDown={blockIndex < draft.blocks.length - 1}
              onMoveUp={() => void reorderBlock(blockIndex, blockIndex - 1)}
              onMoveDown={() => void reorderBlock(blockIndex, blockIndex + 1)}
              onRename={(name) => void renameBlock(block.id, name)}
              onDelete={() => void deleteBlock(block.id)}
              footer={
                // FR-028: adding an exercise to the active form must stay
                // unavailable while a pendingDraft is unresolved — the
                // default seeded block (ADR-0011) always exists and renders
                // regardless, so its own footer control needs this same
                // gate the bottom-of-screen controls already have.
                !pendingDraft ? (
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
                ) : undefined
              }
            >
              {block.exercises.map((entry, entryIndex) => {
                const entryVm = blockVm.entries[entryIndex]!;
                const exercise = catalogue.find(
                  (e) => e.id === entry.exerciseId,
                );
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
                      void moveExerciseAcrossBlocks(
                        block.id,
                        entry.id,
                        toBlockId,
                      )
                    }
                    onDelete={() =>
                      void deleteExerciseEntry(block.id, entry.id)
                    }
                    onEditTemplate={
                      exercise
                        ? () => setEditingTemplateFor(exercise)
                        : undefined
                    }
                  >
                    <ExerciseSetList
                      sets={entry.sets}
                      loadKind={exercise?.defaultLoadType ?? 'none'}
                      volumeKind={exercise?.defaultVolumeKind ?? 'reps'}
                      trackEffort={exercise?.trackEffort ?? false}
                      freeTextSuggestions={suggestFreeTextLoads(
                        entry.exerciseId,
                      )}
                      prefill={prefillNextSet(block.id, entry.id)}
                      unit={settings.defaultUnit}
                      quickIncrements={settings.quickIncrements}
                      onAddSet={(input) => void addSet(entry.id, input)}
                      onUpdateSet={(setId, input) =>
                        void updateSet(entry.id, setId, input)
                      }
                      onDeleteSet={(setId) =>
                        void deleteSet(block.id, entry.id, setId)
                      }
                      newestSetId={lastAddedSetId}
                      onNewestSetAnimationEnd={(setId) => {
                        // Guards against a stale closure: if a second set
                        // committed (moving the marker on) before this row's
                        // own animation ended, only *that* row's handler
                        // should consume it — this one clearing a marker
                        // that has already moved on would strand the newer
                        // row's own entrance animation mid-flight (Copilot
                        // review, PR #22).
                        if (
                          useLoggingSession.getState().lastAddedSetId === setId
                        ) {
                          clearLastAddedSetId();
                        }
                      }}
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

        {!pendingDraft && (
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={() => void addBlock(undefined, 'straightSets')}
          >
            <Icon name="plus" />
            Add block
          </button>
        )}

        <button
          type="button"
          className="logging-button logging-button--primary"
          disabled={!!pendingDraft || !draftHasContent(draft)}
          onClick={() => {
            void (async () => {
              await registerWorkout();
              navigate('/diary');
            })();
          }}
        >
          Log workout
        </button>
      </main>
    </div>
  );
}
