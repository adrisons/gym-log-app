/**
 * A button that opens `ExerciseSearchField` inside a modal popup (design
 * request: search shouldn't sit in view, nor share scroll space with the
 * rest of the block, before the user has asked for it — docs/design.md
 * §2), matching `BlockCard`'s own rename-dialog pattern (backdrop +
 * `role="dialog"`). Closes back to the button on a selection/creation,
 * Escape, or a tap on the backdrop.
 *
 * `aria-modal="true"` alone doesn't trap focus or make the rest of the
 * page inert (Copilot review, PR #40) — a keyboard user tabbing past the
 * dialog's last focusable element would otherwise land back on the
 * trigger button and the rest of the page behind this backdrop, which
 * they can't see or reach. The dialog's own `onKeyDown` below wraps Tab/
 * Shift+Tab between its first and last focusable elements instead.
 */
import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import { ExerciseSearchField } from './exercise-search-field';
import './logging.css';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);
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
            ref={dialogRef}
            className="add-exercise-control__dialog"
            role="dialog"
            aria-modal="true"
            aria-label={fieldLabel}
            onKeyDown={(event) => {
              if (event.key !== 'Tab' || !dialogRef.current) return;
              const focusable = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                  FOCUSABLE_SELECTOR,
                ),
              );
              if (focusable.length === 0) return;
              const first = focusable[0]!;
              const last = focusable[focusable.length - 1]!;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
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
        </div>
      )}
    </>
  );
}
