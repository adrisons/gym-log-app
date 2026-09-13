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
 * the block's own 5-second delete-undo window. Collapsing hides the body
 * with the `hidden` attribute rather than omitting it from the tree: a
 * `SetRow` inside can have a commit debounced-but-not-yet-fired
 * (ADR-0007), and that timer is deliberately not cancelled on unmount —
 * unmounting it here by conditionally rendering the body would have
 * discarded that in-flight `SetRow` instance's own local state (though not
 * the pending commit itself) the moment a block collapses, which is a
 * mere visual fold, not the "navigated away" case ADR-0007's guarantee is
 * about.
 *
 * `rounds` (ADR-0008) is a target round count for the whole block — always
 * visible and editable, even while collapsed (it's the block's own plan,
 * not part of the exercises/sets content collapsing hides), and with no
 * separate edit-mode toggle: unlike the name field, one small always-shown
 * number input doesn't compete with the title for space. Commits
 * immediately on a valid change (FR-1's "no Save button" applies here
 * too); an empty field means "not specified", never `0`.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/presentation/design/icons';
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

  if (bare) {
    return (
      <>
        {children}
        {footer}
      </>
    );
  }

  return (
    <section className="block-card" aria-label={displayName}>
      <div className="block-card__header">
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onRename(nameInput.trim() === '' ? undefined : nameInput.trim());
              setEditing(false);
            }}
          >
            <label className="logging-screen__field-label">
              <span>Block name</span>
              <input
                type="text"
                className="logging-field-input"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                autoFocus
              />
            </label>
            <button
              type="submit"
              className="logging-button logging-button--icon-label"
            >
              <Icon name="check" />
              Save name
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="logging-button block-card__collapse-toggle"
              aria-expanded={!collapsed}
              aria-label={
                collapsed ? `Expand ${displayName}` : `Collapse ${displayName}`
              }
              onClick={() => setCollapsed((current) => !current)}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
            </button>
            <div className="block-card__title">
              <h2>{displayName}</h2>
              {subtitle && (
                <span className="block-card__subtitle">{subtitle}</span>
              )}
            </div>
            <div className="block-card__actions--inline">
              <button
                type="button"
                className="logging-button logging-button--icon-label"
                onClick={() => setEditing(true)}
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
                  onClick={() => setEditing(true)}
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
          </>
        )}
      </div>
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
      <div className="block-card__body" hidden={collapsed}>
        {children}
        {footer}
      </div>
    </section>
  );
}
