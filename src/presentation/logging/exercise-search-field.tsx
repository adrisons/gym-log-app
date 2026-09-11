/**
 * FR-002, FR-015, FR-016: find-or-create an exercise. Search is
 * synchronous (`searchExercises` is a fast in-memory operation, no I/O —
 * research.md §3), so results recompute on every keystroke with no
 * separate debounce timer. "Create new exercise" is always the last
 * result, visible even with an empty query
 * (`contracts/logging-screen-components.md`).
 */
import { useState } from 'react';
import type { Exercise } from '@/application/logging/use-cases';
import './logging.css';

export interface ExerciseSearchFieldProps {
  search: (query: string) => Exercise[];
  onSelectExercise: (exercise: Exercise) => void;
  onCreateExercise: (name: string) => void;
}

export function ExerciseSearchField({
  search,
  onSelectExercise,
  onCreateExercise,
}: ExerciseSearchFieldProps) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const results = search(query);

  return (
    <div className="exercise-search-field">
      <label className="logging-screen__field-label">
        <span>Exercise</span>
        <input
          type="text"
          className="logging-field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search or create an exercise"
        />
      </label>
      <ul className="exercise-search-field__results" role="listbox">
        {results.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              className="logging-button"
              onClick={() => {
                onSelectExercise(exercise);
                setQuery('');
              }}
            >
              {exercise.canonicalName}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="logging-button"
            disabled={trimmed === ''}
            aria-disabled={trimmed === ''}
            onClick={() => {
              onCreateExercise(trimmed);
              setQuery('');
            }}
          >
            {trimmed === ''
              ? 'Type a name to create a new exercise'
              : `Create "${trimmed}"`}
          </button>
        </li>
      </ul>
    </div>
  );
}
