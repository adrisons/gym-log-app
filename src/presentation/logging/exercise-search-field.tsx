/**
 * FR-002, FR-015, FR-016: find-or-create an exercise. Search is
 * synchronous (`searchExercises` is a fast in-memory operation, no I/O —
 * research.md §3), so results recompute on every keystroke with no
 * separate debounce timer.
 *
 * Suggestions stay closed until the field is focused or clicked
 * (docs/design.md §2 "legibility over density" — the logging screen
 * doesn't need a full results list sitting in view before the user has
 * asked for it) and close again on blur/Escape/selection. Opening on
 * focus, not just click, keeps the whole thing keyboard-reachable
 * (docs/design.md §5/§7.4 — nothing essential behind a pointer-only
 * affordance).
 *
 * "Create <query>" only appears once the query has no exact match in the
 * catalogue — with a match already on screen there is nothing to create,
 * so a permanently-visible (if disabled) create control was just noise.
 * Managing an existing exercise (rename/merge/delete) now lives on its
 * own catalogue screen (`/exercises`), so this field only ever finds or
 * creates.
 *
 * Deliberately a plain text input plus a plain labelled list of buttons,
 * not an ARIA combobox/listbox: that pattern additionally requires
 * `aria-activedescendant`-driven option focus and arrow-key navigation,
 * neither of which this control implements, and a half-implemented
 * combobox is worse for assistive tech than a correctly plain one — every
 * result is still a real, individually tab-reachable `<button>`.
 */
import { useId, useRef, useState } from 'react';
import { normalize } from '@/application/logging/use-cases';
import type { Exercise } from '@/application/logging/use-cases';
import './logging.css';

export interface ExerciseSearchFieldProps {
  search: (query: string) => Exercise[];
  onSelectExercise: (exercise: Exercise) => void;
  onCreateExercise: (name: string) => void;
  label?: string;
  placeholder?: string;
  /** Focuses the input as soon as it mounts — for a caller (`AddExerciseControl`) that only mounts this field once the user has just asked for it, so the field opening should hand keyboard focus straight to it rather than leaving focus on the now-unmounted trigger button. */
  autoFocus?: boolean;
}

export function ExerciseSearchField({
  search,
  onSelectExercise,
  onCreateExercise,
  label = 'Exercise',
  placeholder = 'Search or create an exercise',
  autoFocus = false,
}: ExerciseSearchFieldProps) {
  const resultsId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const trimmed = query.trim();
  const results = search(query);
  const normalizedQuery = normalize(trimmed);
  const hasExactMatch = results.some((exercise) =>
    [exercise.canonicalName, ...exercise.aliases].some(
      (name) => normalize(name) === normalizedQuery,
    ),
  );
  const showCreate = trimmed !== '' && !hasExactMatch;

  return (
    <div
      className="exercise-search-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        // On the container, not just the input: once a keyboard user has
        // tabbed from the input into a result/create button, that button
        // is what has focus, and Escape must still close the disclosure
        // from there. Refocusing the input afterward matters because
        // closing unmounts whatever result button was focused — without
        // it, focus would fall back to the document body.
        if (event.key === 'Escape') {
          // Focus first, `setOpen(false)` after: focusing the input
          // synchronously fires its own `onFocus` (which reopens), so
          // closing has to be the last state update in this batch to win
          // — reversing this order would leave the suggestions open.
          inputRef.current?.focus();
          setOpen(false);
        }
      }}
    >
      <label className="logging-screen__field-label">
        <span>{label}</span>
        <input
          ref={inputRef}
          type="text"
          className="logging-field-input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // Escape closes the results without moving focus out of this
            // input — reopening on the next keystroke (not just on a fresh
            // focus/click) is what lets a keyboard user resume typing and
            // see results again without leaving and returning to the field.
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
      </label>
      {open && (results.length > 0 || showCreate) && (
        <ul
          id={resultsId}
          className="exercise-search-field__results"
          aria-label={`${label} results`}
        >
          {results.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                className="logging-button"
                onClick={() => {
                  onSelectExercise(exercise);
                  setQuery('');
                  setOpen(false);
                }}
              >
                {exercise.canonicalName}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                className="logging-button"
                onClick={() => {
                  onCreateExercise(trimmed);
                  setQuery('');
                  setOpen(false);
                }}
              >
                Create &quot;{trimmed}&quot;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
