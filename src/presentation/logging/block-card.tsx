/**
 * FR-006, FR-007: one block. Unnamed blocks show their position label
 * ("Block N"), never "Untitled" (computed in `toBlockViewModel`, not
 * here). Rename is an inline text field; delete triggers the parent's
 * undo-producing action.
 *
 * Header actions (rename/delete) render twice — once as plain buttons,
 * once inside the shared `OverflowMenu` — and CSS picks one per
 * viewport width (docs/design.md §6): full buttons where there's room,
 * folded into a "⋮" menu once space is tight, so secondary actions stay
 * reachable without crowding the block name on a narrow phone.
 *
 * `footer`, when given, renders after the exercise entries — the block's
 * own "add exercise" control, so grouping exercises into this block is a
 * single tap from where its contents already are.
 *
 * `bare`, when true, skips the header/border chrome entirely and renders
 * only `children`/`footer` — an implicit home for a "loose" exercise
 * added outside any block (`application/ports/logging-draft.ts`'s
 * `DraftBlock.loose`, presentation-only) shouldn't look like a block at
 * all. This is distinct from having no `name`: an explicitly created
 * block the user simply hasn't renamed yet is never `bare` — FR-2
 * requires it to keep showing its position label and stay
 * renameable/deletable.
 *
 * Collapse/expand (`docs/requirements.md` FR-2) is local UI state, reset
 * on remount — never persisted as part of the Session, and independent of
 * the block's own 5-second delete-undo window. The body always stays
 * mounted, collapsed or not — never conditionally rendered — because a
 * `SetRow` inside can have a commit debounced-but-not-yet-fired
 * (ADR-0007), and that timer is deliberately not cancelled on unmount;
 * unmounting the body here would discard that in-flight `SetRow`
 * instance's own local state the moment a block collapses, which is a
 * mere visual fold, not the "navigated away" case ADR-0007's guarantee is
 * about. Collapsing animates the body's height to zero (`docs/design.md`
 * §4.1 — this answers "where did that content go") via a CSS grid-rows
 * transition rather than snapping with the `hidden` attribute, which
 * can't be animated (its `display: none` applies instantly). `inert`
 * takes over `hidden`'s job of pulling collapsed content out of the tab
 * order and off assistive tech while it's visually clipped — the grid
 * trick alone only hides it visually, `inert` alone doesn't animate, the
 * two together are what a collapsed-but-still-technically-present region
 * actually needs.
 *
 * `rounds` (ADR-0008) is a target round count for the whole block — always
 * visible and editable, even while collapsed (it's the block's own plan,
 * not part of the exercises/sets content collapsing hides), and with no
 * separate edit-mode toggle: unlike the name field, one small always-shown
 * number input doesn't compete with the title for space. Commits
 * immediately on a valid change (FR-1's "no Save button" applies here
 * too); an empty field means "not specified", never `0`.
 *
 * Rename (ADR-0009) opens as a small popup dialog — a backdrop over the
 * rest of the screen, not an inline field swapped into the header — so
 * the edit can't be left half-open while the user goes on to edit
 * something else in this same block (add an exercise, change rounds) with
 * the rename still pending in the background. Enter submits (the input
 * sits in a `<form>`); Escape, an explicit Cancel button, or a click on
 * the backdrop all discard the edit instead. Reuses `.block-card`'s own
 * shell class for the dialog surface, the same reuse
 * `ExerciseTemplatePanel` already relies on for its own inline dialog.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, TransitionEvent } from 'react';
import { Icon } from '@/presentation/design/icons';
import { prefersReducedMotion } from '@/presentation/design/motion';
import { OverflowMenu } from './overflow-menu';
import './logging.css';

export interface BlockCardProps {
  displayName: string;
  hasName: boolean;
  subtitle?: string;
  bare?: boolean;
  rounds?: number | undefined;
  onRename: (name: string | undefined) => void;
  onSetRounds: (rounds: number | undefined) => void;
  onDelete: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function BlockCard({
  displayName,
  hasName,
  subtitle,
  bare = false,
  rounds,
  onRename,
  onSetRounds,
  onDelete,
  children,
  footer,
}: BlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(hasName ? displayName : '');
  const [collapsed, setCollapsed] = useState(false);
  // Keeps `.block-card__body` clipped (and the region `inert`, below) for
  // the duration of the collapse's own grid-template-rows transition,
  // expanding included — toggling `collapsed` alone drops overflow:hidden
  // (and `inert`) the instant `--collapsed` is removed, while the row is
  // still animating open, so an exercise/set's full-height content can
  // briefly paint outside the still-growing track and overlap the header,
  // and focus/assistive tech can enter a region that isn't actually
  // visible yet (Copilot review, PR #22). Cleared by the wrapper's own
  // `onTransitionEnd` rather than a timeout duplicating the CSS
  // transition's duration as a JS literal — nothing to keep in sync if
  // that duration ever changes. Never set true under
  // `prefers-reduced-motion` in the first place, since no transition
  // fires there to end and clear it — leaving it permanently true would
  // reintroduce the very overflow-menu clipping bug this mechanism
  // replaced.
  const [isTransitioning, setIsTransitioning] = useState(false);

  // If the OS preference flips to reduced-motion mid-transition, the CSS
  // transition `handleCollapseTransitionEnd` normally waits on stops
  // firing at all — leaving `isTransitioning` (and the `inert` it drives)
  // stuck true forever, permanently hiding this block's content from
  // focus/assistive tech (Copilot review, PR #22).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsTransitioning(false);
      }
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => !current);
    if (!prefersReducedMotion()) {
      setIsTransitioning(true);
    }
  }

  // Rename has two triggers in the DOM at once (the inline button and the
  // OverflowMenu's copy — CSS picks which is visible per viewport width,
  // see the class doc comment above), so which one to return focus to on
  // close is whichever was actually activated, captured here rather than
  // assumed.
  const renameTriggerRef = useRef<HTMLButtonElement | null>(null);

  /** Resets `nameInput` from the current committed name every time the
   * popup opens — without this, a value typed and then Cancelled would
   * still be sitting there the next time Rename is opened. */
  function openRename(trigger: HTMLButtonElement) {
    renameTriggerRef.current = trigger;
    setNameInput(hasName ? displayName : '');
    setEditing(true);
  }

  function closeRename() {
    setEditing(false);
    renameTriggerRef.current?.focus();
  }

  function handleCollapseTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    // `.block-card__collapse` transitions both `grid-template-rows` and
    // `margin-top` in parallel (see logging.css) — react to just one so
    // this doesn't fire twice per toggle.
    if (event.propertyName === 'grid-template-rows') {
      setIsTransitioning(false);
    }
  }

  if (bare) {
    return (
      <>
        {children}
        {footer}
      </>
    );
  }

  return (
    <section
      className="block-card block-card--collapsible"
      aria-label={displayName}
    >
      <div className="block-card__header">
        <button
          type="button"
          className="logging-button block-card__collapse-toggle"
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? `Expand ${displayName}` : `Collapse ${displayName}`
          }
          onClick={toggleCollapsed}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
        </button>
        <div className="block-card__title">
          <h2>{displayName}</h2>
          {subtitle && <span className="block-card__subtitle">{subtitle}</span>}
        </div>
        <div className="block-card__actions--inline">
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={(event) => openRename(event.currentTarget)}
          >
            <Icon name="pencil" />
            Rename
          </button>
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={onDelete}
          >
            <Icon name="trash" />
            Delete block
          </button>
        </div>
        <div className="block-card__actions--menu">
          <OverflowMenu label={`${displayName} actions`}>
            <button
              type="button"
              className="logging-button logging-button--icon-label"
              onClick={(event) => openRename(event.currentTarget)}
            >
              <Icon name="pencil" />
              Rename
            </button>
            <button
              type="button"
              className="logging-button logging-button--icon-label"
              onClick={onDelete}
            >
              <Icon name="trash" />
              Delete block
            </button>
          </OverflowMenu>
        </div>
      </div>
      {editing && (
        <div
          className="block-card__rename-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRename();
          }}
        >
          <form
            className="block-card block-card__rename-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Rename ${displayName}`}
            onSubmit={(event) => {
              event.preventDefault();
              onRename(nameInput.trim() === '' ? undefined : nameInput.trim());
              closeRename();
            }}
          >
            <label className="logging-screen__field-label">
              <span>Block name</span>
              <input
                type="text"
                className="logging-field-input"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeRename();
                  }
                }}
                autoFocus
              />
            </label>
            <div className="block-card__rename-actions">
              <button
                type="submit"
                className="logging-button logging-button--primary logging-button--icon-label"
              >
                <Icon name="check" />
                Save
              </button>
              <button
                type="button"
                className="logging-button logging-button--icon-label"
                onClick={closeRename}
              >
                <Icon name="close" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      <label className="block-card__rounds">
        <span>Rounds</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="logging-field-input"
          value={rounds ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onSetRounds(undefined);
              return;
            }
            // `Number`, not `parseInt` — a typed "2.5" must fail the
            // integer check below and be rejected (reverting to whatever
            // `rounds` already held), not get silently floor-truncated to
            // a value the user never actually entered.
            const parsed = Number(raw);
            if (Number.isInteger(parsed) && parsed >= 1) {
              onSetRounds(parsed);
            }
          }}
        />
      </label>
      <div
        className={`block-card__collapse${collapsed ? ' block-card__collapse--collapsed' : ''}${isTransitioning ? ' block-card__collapse--transitioning' : ''}`}
        inert={collapsed || isTransitioning}
        onTransitionEnd={handleCollapseTransitionEnd}
      >
        <div className="block-card__body">
          {children}
          {footer}
        </div>
      </div>
    </section>
  );
}
