/**
 * A button that expands into `ExerciseSearchField` — the same collapse/
 * expand idiom `SetRow`'s "Change load type" control already uses, so
 * this reads as one control instead of an always-visible search field
 * sitting in view before the user has asked for it (docs/design.md §2).
 * Collapses back to a button after a selection/creation, or on blur.
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

  // The trigger button unmounts while expanded, so closing (select,
  // create, or blur) would otherwise leave keyboard focus nowhere — hand
  // it back once the button exists again. Skipped on first mount:
  // `wasOpenRef` only turns true once this component has actually been
  // open, so a page that renders this collapsed and untouched never
  // steals focus on its own.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      buttonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" />
        {buttonLabel}
      </button>
    );
  }

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
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
  );
}
