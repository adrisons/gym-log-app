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
 * Cancel closes the form without saving in either mode (add or edit), back
 * to the "+ Add set" button — including for an entry with zero recorded
 * sets, where the add form opens by default (ADR-0012 §4: opening the form
 * is no longer a commitment to entering a value). The "+ Add set" button
 * itself is unconditional on `sets.length`, so there is always somewhere
 * for Cancel to land.
 *
 * Deleting an entry's last remaining set reopens the `'add'` form
 * automatically (there is once again "no data entered").
 */
import { Fragment, useState } from 'react';
import { Icon } from '@/presentation/design/icons';
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
  freeTextSuggestions: string[];
  /** Add-mode prefill (FR-008) — the previous set's load/volume, or
   * `undefined` when there's none or the caller doesn't offer one. */
  prefill: SetPrefill | undefined;
  /** Settings' `defaultUnit` and `quickIncrements` (spec 006 FR-001/
   * SC-003), threaded down to `SetRow`. */
  unit: 'kg' | 'lb';
  quickIncrements: { durationSeconds: number; distanceMetres: number };
  onAddSet: (input: AddSetInput) => void;
  onUpdateSet: (setId: string, input: AddSetInput) => void;
  onDeleteSet: (setId: string) => void;
  /** The id of the set to mark for the entrance animation (`LoggingScreen`
   * only — `SessionDetailScreen` has no such marker). */
  newestSetId?: string | undefined;
  onNewestSetAnimationEnd?: ((setId: string) => void) | undefined;
}

type FormState = 'add' | 'edit' | 'closed';

/** Sets table header label for the volume column (Copilot review, PR #33)
 * — this component renders for every `VolumeKind`, not just reps, so a
 * hard-coded "Reps" header misdescribed a Duration/Distance-tracked
 * exercise's own column. */
const VOLUME_COLUMN_LABEL: Record<VolumeKind, string> = {
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
};

/** Sets table header label for the load column — a free-text load isn't a
 * "Load" in any measurable sense, it's a note on which machine/setting the
 * exercise was performed at (`FreeTextLoadInput`'s own "Machine / setting"
 * field label), so the header must call it that too rather than the
 * numeric-load word every other load kind actually earns. */
const LOAD_COLUMN_LABEL: Partial<Record<Load['kind'], string>> = {
  freeText: 'Setting',
};

export function ExerciseSetList({
  sets,
  loadKind,
  volumeKind,
  trackEffort,
  freeTextSuggestions,
  prefill,
  unit,
  quickIncrements,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
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

  const [openHeaderTooltip, setOpenHeaderTooltip] = useState<
    'volume' | 'load' | undefined
  >(undefined);

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

  const setRow = showForm && (
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
      freeTextSuggestions={freeTextSuggestions}
      unit={unit}
      quickIncrements={quickIncrements}
      onConfirm={(input) => {
        if (form === 'edit' && editingSetId) {
          onUpdateSet(editingSetId, input);
        } else {
          onAddSet(input);
        }
        closeForm();
      }}
      onCancel={closeForm}
    />
  );

  // The header row also needs to show above the add form for an exercise
  // with zero recorded sets — otherwise its compact-row inputs (a plain
  // reps/weight pair with no field labels of their own, unlike the fuller
  // stacked form) render with nothing identifying which is which.
  const showHeaderRow = sets.length > 0 || form === 'add';

  // The Load column only earns the Volume header's expanded width
  // (`--expand` below) when nothing will ever render a value in it — the
  // *current* template's `loadKind` alone isn't enough: ADR-0006 keeps an
  // already-recorded set's own load kind even after the template moves on,
  // so a `none`-kind template can still have historical sets carrying a
  // real Weight/FreeText load (Copilot review, PR #42). Expanding the
  // header in that case would leave those rows' values sitting under no
  // column heading at all.
  const loadColumnEmpty =
    loadKind === 'none' && sets.every((s) => s.load.kind === 'none');

  return (
    <>
      {showHeaderRow && (
        <div className="sets-header-row">
          <span
            className={
              loadColumnEmpty
                ? 'sets-header-cell sets-header-cell--expand'
                : 'sets-header-cell'
            }
          >
            <button
              type="button"
              className="sets-header-cell__button"
              aria-expanded={openHeaderTooltip === 'volume'}
              onClick={() =>
                setOpenHeaderTooltip((current) =>
                  current === 'volume' ? undefined : 'volume',
                )
              }
            >
              {VOLUME_COLUMN_LABEL[volumeKind]}
            </button>
            {openHeaderTooltip === 'volume' && (
              <span className="sets-header-cell__tooltip" role="tooltip">
                {VOLUME_COLUMN_LABEL[volumeKind]}
              </span>
            )}
          </span>
          {/* Omitted outright, not just left empty, when there's nothing to
              label — an empty-but-present cell here would still consume a
              grid auto-placement slot ahead of the trailing delete-column
              spacer below, pushing that spacer onto a second row instead of
              column 3 (Copilot review, PR #42). */}
          {!loadColumnEmpty && (
            <span className="sets-header-cell">
              <button
                type="button"
                className="sets-header-cell__button"
                aria-expanded={openHeaderTooltip === 'load'}
                onClick={() =>
                  setOpenHeaderTooltip((current) =>
                    current === 'load' ? undefined : 'load',
                  )
                }
              >
                {LOAD_COLUMN_LABEL[loadKind] ?? 'Load'}
              </button>
              {openHeaderTooltip === 'load' && (
                <span className="sets-header-cell__tooltip" role="tooltip">
                  {LOAD_COLUMN_LABEL[loadKind] ?? 'Load'}
                </span>
              )}
            </span>
          )}
          <span className="sets-header-cell" aria-hidden="true" />
        </div>
      )}
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
            <Fragment key={vm.id}>
              <li
                className={className}
                {...(isNewest && onNewestSetAnimationEnd
                  ? { onAnimationEnd: () => onNewestSetAnimationEnd(vm.id) }
                  : {})}
              >
                {/* Tapping the row opens in-place edit (ExerciseSetList's
                  existing 'edit' form state) — the approved design shows
                  only a trailing "×" for delete, with no visible menu, so
                  Edit is reached from the row itself instead of a dropped
                  ⋮ menu item. A <button> wrapping the value cells (not the
                  whole <li>, which also hosts the delete control) keeps
                  this keyboard-operable without nesting an interactive
                  element inside another. */}
                <button
                  type="button"
                  className="set-summary__edit"
                  aria-label={`Edit ${vm.summaryLine}`}
                  onClick={() => {
                    setEditingSetId(set.id);
                    setForm('edit');
                  }}
                >
                  {/* Empty, not a "—" placeholder, when this column's value
                    is absent (a load-only set with no volume, or a
                    none-kind load) — only entered data shows, a
                    pre-existing product rule this table must not regress
                    (test: "shows no load column at all for a none-kind
                    load"). Effort is deliberately not rendered here
                    (design refinement) — the row's own tone border already
                    reflects it, and `vm.summaryLine`'s effort wording still
                    reaches screen readers via the Edit/Delete aria-labels
                    below. */}
                  <span className="set-summary__reps">{vm.volumeColumn}</span>
                  <span className="set-summary__load">{vm.loadColumn}</span>
                </button>
                <button
                  type="button"
                  className="set-summary__delete"
                  aria-label={`Delete ${vm.summaryLine}`}
                  onClick={() => onDeleteSet(set.id)}
                >
                  <Icon name="close" />
                </button>
              </li>
              {form === 'edit' && vm.id === editingSetId && (
                <li className="set-row-wrapper">{setRow}</li>
              )}
            </Fragment>
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

      {form === 'add' && setRow}
    </>
  );
}
