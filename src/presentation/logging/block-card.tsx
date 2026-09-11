/**
 * FR-006, FR-007: one block. Unnamed blocks show their position label
 * ("Block N"), never "Untitled" (computed in `toBlockViewModel`, not
 * here). Rename is an inline text field; delete triggers the parent's
 * undo-producing action.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import './logging.css';

export interface BlockCardProps {
  displayName: string;
  hasName: boolean;
  onRename: (name: string | undefined) => void;
  onDelete: () => void;
  children: ReactNode;
}

export function BlockCard({
  displayName,
  hasName,
  onRename,
  onDelete,
  children,
}: BlockCardProps) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(hasName ? displayName : '');

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
            <label>
              <span>Block name</span>
              <input
                type="text"
                className="logging-field-input"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                autoFocus
              />
            </label>
            <button type="submit" className="logging-button">
              Save name
            </button>
          </form>
        ) : (
          <>
            <h2>{displayName}</h2>
            <button
              type="button"
              className="logging-button"
              onClick={() => setEditing(true)}
            >
              Rename
            </button>
          </>
        )}
        <button type="button" className="logging-button" onClick={onDelete}>
          Delete block
        </button>
      </div>
      {children}
    </section>
  );
}
