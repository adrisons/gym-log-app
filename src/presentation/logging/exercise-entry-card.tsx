/**
 * One exercise entry within a block. Its header keeps only the exercise
 * name in view; reorder/move/delete fold into the shared `OverflowMenu`
 * (docs/design.md §2 "secondary actions... visually quieter") — still
 * keyboard-operable buttons/select inside the menu, not hover-only
 * (docs/design.md §5 — nothing essential revealed by hover/pointer only).
 */
import type { ReactNode } from 'react';
import { Icon } from '@/presentation/design/icons';
import { OverflowMenu } from './overflow-menu';
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
  /** Opens the exercise's set-entry template editor (ADR-0006). Omit/undefined hides the menu item (e.g. screens that don't support editing it). */
  onEditTemplate?: (() => void) | undefined;
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
  onEditTemplate,
  children,
}: ExerciseEntryCardProps) {
  return (
    <div className="exercise-entry-card">
      <div className="exercise-entry-card__header">
        <h3>{exerciseName}</h3>
        <OverflowMenu label={`${exerciseName} actions`}>
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            disabled={!canMoveUp}
            aria-disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <Icon name="chevron-up" />
            Move up
          </button>
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            disabled={!canMoveDown}
            aria-disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <Icon name="chevron-down" />
            Move down
          </button>
          {otherBlocks.length > 0 && (
            <select
              className="logging-field-input"
              aria-label="Move to"
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
          )}
          {onEditTemplate && (
            <button
              type="button"
              className="logging-button logging-button--icon-label"
              onClick={onEditTemplate}
            >
              <Icon name="sliders" />
              Edit tracked fields…
            </button>
          )}
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={onDelete}
          >
            <Icon name="trash" />
            Delete exercise
          </button>
        </OverflowMenu>
      </div>
      {children}
    </div>
  );
}
