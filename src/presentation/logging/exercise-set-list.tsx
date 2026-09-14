/**
 * ADR-0010: one exercise entry's logged sets, plus the add/edit form for
 * it. Shared by `LoggingScreen` and `SessionDetailScreen` — both screens
 * used to duplicate this rendering inline; factored out once it grew
 * edit-in-place support, so the two never drift out of sync.
 *
 * The add/edit form only ever occupies one slot, toggled by local state:
 * - `'add'` — the ordinary "new set" form. Open by default only while the
 *   entry has no sets at all (nothing entered yet); once the first set is
 *   confirmed, or when the entry already had sets on mount, the slot
 *   collapses to a compact "+ Add set" button instead, to save space.
 * - `'edit'` — the same form, pre-filled from one specific already-logged
 *   set (reached via that set's own "Edit" menu item), replacing the
 *   "+ Add set" button until Save/Cancel.
 * - `'closed'` — neither: the "+ Add set" button shows.
 *
 * Cancel closes the form without saving in either mode (add or edit),
 * back to the "+ Add set" button — even for an entry with zero sets, so
 * opening the form isn't a commitment to entering one.
 *
 * Deleting an entry's last remaining set reopens the `'add'` form
 * automatically (there is once again "no data entered").
 */
import { useState } from 'react';
import { Icon } from '@/presentation/design/icons';
import { OverflowMenu } from './overflow-menu';
import { SetRow } from './set-row';
import type { VolumeKind } from './volume-input';
import { toSetSummaryViewModel } from '@/application/logging/view-models';
import type {
  AddSetInput,
  DraftSet,
  SetPrefill,
} from '@/application/logging/draft';
import type { Load } from '@/application/logging/use-cases';
import './logging.css';

export interface ExerciseSetListProps {
  sets: DraftSet[];
  loadKind: Load['kind'];
  volumeKind: VolumeKind;
  trackEffort: boolean;
  bandLabels: string[];
  freeTextSuggestions: string[];
  /** Add-mode prefill (FR-008) — the previous set's load/volume, or
   * `undefined` when there's none or the caller doesn't offer one. */
  prefill: SetPrefill | undefined;
  onAddSet: (input: AddSetInput) => void;
  onUpdateSet: (setId: string, input: AddSetInput) => void;
  onDeleteSet: (setId: string) => void;
  onSaveBandLabels: (labels: string[]) => void;
  /** The id of the set to mark for the entrance animation (`LoggingScreen`
   * only — `SessionDetailScreen` has no such marker). */
  newestSetId?: string | undefined;
  onNewestSetAnimationEnd?: ((setId: string) => void) | undefined;
}

type FormState = 'add' | 'edit' | 'closed';

export function ExerciseSetList({
  sets,
  loadKind,
  volumeKind,
  trackEffort,
  bandLabels,
  freeTextSuggestions,
  prefill,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onSaveBandLabels,
  newestSetId,
  onNewestSetAnimationEnd,
}: ExerciseSetListProps) {
  const [form, setForm] = useState<FormState>(
    sets.length === 0 ? 'add' : 'closed',
  );
  const [editingSetId, setEditingSetId] = useState<string | undefined>(
    undefined,
  );

  // Two invariants enforced here, both by adjusting state during render
  // (React's documented pattern for "state that depends on a prop change",
  // https://react.dev/learn/you-might-not-need-an-effect) rather than in a
  // `useEffect`, which would cascade an extra render after the one that
  // already shows the stale, about-to-be-corrected state:
  //
  //  1. Deleting an entry's last remaining set reopens the add form
  //     automatically ("no data entered" again). Gated on `sets.length`
  //     actually *transitioning* to 0 (`prevSetsLength`), not merely being
  //     0 on this render — `onConfirm` below already calls `closeForm()`
  //     itself in the same event as `onAddSet`/`onUpdateSet`, and a caller
  //     whose own state update hasn't reached this component's `sets` prop
  //     yet (e.g. still `[]` right after the very first add) must not have
  //     that deliberate close immediately fought and reopened here.
  //  2. The set currently open for editing must still exist. It can stop
  //     existing without the entry itself becoming empty: the summary list
  //     stays visible, with its own per-set Delete, while a *different*
  //     row is being edited — deleting the very set being edited must not
  //     leave this component rendering neither a form nor a "+ Add set"
  //     button (Copilot review, PR #27). Not transition-gated: nothing
  //     else in this component reacts to a delete, so there is no
  //     competing intent for this check to fight.
  const [prevSetsLength, setPrevSetsLength] = useState(sets.length);
  const lengthChanged = sets.length !== prevSetsLength;
  if (lengthChanged) setPrevSetsLength(sets.length);

  if (lengthChanged && sets.length === 0) {
    setForm('add');
    setEditingSetId(undefined);
  } else if (form === 'edit' && !sets.some((s) => s.id === editingSetId)) {
    setForm('closed');
    setEditingSetId(undefined);
  }

  function closeForm() {
    setForm('closed');
    setEditingSetId(undefined);
  }

  const editingSet =
    form === 'edit' ? sets.find((s) => s.id === editingSetId) : undefined;
  const showForm = form === 'add' || (form === 'edit' && editingSet);

  return (
    <>
      <ul className="set-list">
        {sets.map((set) => {
          const vm = toSetSummaryViewModel(set);
          const isNewest = vm.id === newestSetId;
          const className = [
            'set-summary',
            vm.effortTone && `set-summary--${vm.effortTone}`,
            isNewest && 'set-summary--new',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={vm.id}
              className={className}
              {...(isNewest && onNewestSetAnimationEnd
                ? { onAnimationEnd: () => onNewestSetAnimationEnd(vm.id) }
                : {})}
            >
              <span>{vm.summaryLine}</span>
              <OverflowMenu label={`${vm.summaryLine} actions`}>
                <button
                  type="button"
                  className="logging-button logging-button--icon-label"
                  onClick={() => {
                    setEditingSetId(set.id);
                    setForm('edit');
                  }}
                >
                  <Icon name="pencil" />
                  Edit
                </button>
                <button
                  type="button"
                  className="logging-button logging-button--icon-label"
                  onClick={() => onDeleteSet(set.id)}
                >
                  <Icon name="trash" />
                  Delete set
                </button>
              </OverflowMenu>
            </li>
          );
        })}
      </ul>

      {form === 'closed' && (
        <button
          type="button"
          className="logging-button logging-button--icon-label"
          onClick={() => setForm('add')}
        >
          <Icon name="plus" />
          Add set
        </button>
      )}

      {showForm && (
        <SetRow
          // Add mode's key includes the template fields, not just `'add'`
          // — otherwise editing the exercise's template (e.g. Reps →
          // Duration) mid-session doesn't remount this row, and a value
          // already typed under the old kind (e.g. "5" reps) gets silently
          // reinterpreted as the new one (5 seconds) instead of being
          // cleared (Copilot review, PR #27).
          key={
            form === 'edit'
              ? `edit-${editingSetId}`
              : `add-${loadKind}-${volumeKind}-${trackEffort}`
          }
          prefill={form === 'add' ? prefill : undefined}
          editingSet={
            editingSet
              ? {
                  load: editingSet.load,
                  ...(editingSet.volume !== undefined
                    ? { volume: editingSet.volume }
                    : {}),
                  ...(editingSet.effort !== undefined
                    ? { effort: editingSet.effort }
                    : {}),
                }
              : undefined
          }
          loadKind={loadKind}
          volumeKind={volumeKind}
          trackEffort={trackEffort}
          bandLabels={bandLabels}
          freeTextSuggestions={freeTextSuggestions}
          onConfirm={(input) => {
            if (form === 'edit' && editingSetId) {
              onUpdateSet(editingSetId, input);
            } else {
              onAddSet(input);
            }
            closeForm();
          }}
          onCancel={closeForm}
          onSaveBandLabels={onSaveBandLabels}
        />
      )}
    </>
  );
}
