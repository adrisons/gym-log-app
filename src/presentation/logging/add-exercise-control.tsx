/**
 * A button that opens `ExerciseSearchField` inside a modal popup (design
 * request: search shouldn't sit in view, nor share scroll space with the
 * rest of the block, before the user has asked for it — docs/design.md
 * §2), matching `BlockCard`'s own rename-dialog pattern (backdrop +
 * `role="dialog"`). Closes back to the button on a selection/creation,
 * Escape, or a tap on the backdrop.
 */
import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { ExerciseSearchField } from './exercise-search-field';
import './logging.css';

export interface AddExerciseControlProps {
  buttonLabel: string;
  fieldLabel: string;
  search: (query: string) => Exercise[];
  onSelectExercise: (exercise: Exercise) => void;
  onCreateExercise: (name: string) => void;
}

export function AddExerciseControl({
  buttonLabel,
  fieldLabel,
  search,
  onSelectExercise,
  onCreateExercise,
}: AddExerciseControlProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // The trigger button stays mounted underneath the popup (unlike the old
  // inline-expand version), so closing can always hand focus back to it —
  // whether that close came from a selection/creation, Escape, or a
  // backdrop tap. Skipped on first mount: `wasOpenRef` only turns true
  // once this control has actually been opened, so a page that renders it
  // untouched never steals focus on its own.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      buttonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" />
        {buttonLabel}
      </button>
      {open && (
        <div
          className="add-exercise-control__backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
          }}
        >
          <div
            className="add-exercise-control__dialog"
            role="dialog"
            aria-modal="true"
            aria-label={fieldLabel}
          >
            <ExerciseSearchField
              label={fieldLabel}
              search={search}
              autoFocus
              onSelectExercise={(exercise) => {
                onSelectExercise(exercise);
                setOpen(false);
              }}
              onCreateExercise={(name) => {
                onCreateExercise(name);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
