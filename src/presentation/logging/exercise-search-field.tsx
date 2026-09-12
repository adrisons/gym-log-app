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
 */
import { useId, useState } from 'react';
import type { Exercise } from '@/application/logging/use-cases';
import './logging.css';

export interface ExerciseSearchFieldProps {
  search: (query: string) => Exercise[];
  onSelectExercise: (exercise: Exercise) => void;
  onCreateExercise: (name: string) => void;
  label?: string;
  placeholder?: string;
}

export function ExerciseSearchField({
  search,
  onSelectExercise,
  onCreateExercise,
  label = 'Exercise',
  placeholder = 'Search or create an exercise',
}: ExerciseSearchFieldProps) {
  const resultsId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const trimmed = query.trim();
  const results = search(query);
  const hasExactMatch = results.some(
    (exercise) =>
      exercise.canonicalName.toLowerCase() === trimmed.toLowerCase(),
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
    >
      <label className="logging-screen__field-label">
        <span>{label}</span>
        <input
          type="text"
          className="logging-field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={resultsId}
        />
      </label>
      {open && (results.length > 0 || showCreate) && (
        <ul
          id={resultsId}
          className="exercise-search-field__results"
          role="listbox"
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
