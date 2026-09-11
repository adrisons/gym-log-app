/**
 * One exercise entry within a block. Reorder is keyboard-operable move-up/
 * move-down buttons, not drag-only (`docs/design.md` §5 — nothing
 * essential revealed by hover/pointer only); moving to a different block
 * is a plain select, for the same reason.
 */
import type { ReactNode } from 'react';
import './logging.css';

export interface ExerciseEntryCardProps {
  exerciseName: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  otherBlocks: { id: string; displayName: string }[];
  onMoveToBlock: (blockId: string) => void;
  onDelete: () => void;
  children: ReactNode;
}

export function ExerciseEntryCard({
  exerciseName,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  otherBlocks,
  onMoveToBlock,
  onDelete,
  children,
}: ExerciseEntryCardProps) {
  return (
    <div className="exercise-entry-card">
      <div className="exercise-entry-card__header">
        <h3>{exerciseName}</h3>
        <div className="set-row__inputs">
          <button
            type="button"
            className="logging-button"
            disabled={!canMoveUp}
            aria-disabled={!canMoveUp}
            aria-label={`Move ${exerciseName} up`}
            onClick={onMoveUp}
          >
            ↑
          </button>
          <button
            type="button"
            className="logging-button"
            disabled={!canMoveDown}
            aria-disabled={!canMoveDown}
            aria-label={`Move ${exerciseName} down`}
            onClick={onMoveDown}
          >
            ↓
          </button>
          {otherBlocks.length > 0 && (
            <label>
              <span>Move to block</span>
              <select
                className="logging-field-input"
                value=""
                onChange={(event) => {
                  if (event.target.value) onMoveToBlock(event.target.value);
                }}
              >
                <option value="" disabled>
                  Move to…
                </option>
                {otherBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="logging-button" onClick={onDelete}>
            Delete exercise
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
