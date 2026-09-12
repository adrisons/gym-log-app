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
 * only `children`/`footer` — a block the user never named (an implicit
 * home for a "loose" exercise added outside any block) shouldn't look
 * like a block at all.
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
  onRename: (name: string | undefined) => void;
  onDelete: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function BlockCard({
  displayName,
  hasName,
  subtitle,
  bare = false,
  onRename,
  onDelete,
  children,
  footer,
}: BlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(hasName ? displayName : '');

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
                  role="menuitem"
                  className="logging-button logging-button--icon-label"
                  onClick={() => setEditing(true)}
                >
                  <Icon name="pencil" />
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
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
      {children}
      {footer}
    </section>
  );
}
