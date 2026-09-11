/**
 * FR-007..012: search the catalogue by name/alias, navigate to a result's
 * progression screen.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requireStorage } from '@/application/storage-access';
import { searchExercises } from '@/application/search/exercise-search';
import type { Exercise } from '@/application/logging/use-cases';
import './search.css';

export function ExerciseSearchScreen() {
  const [catalogue, setCatalogue] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void requireStorage().listExercises().then(setCatalogue);
  }, []);

  const results = searchExercises(query, catalogue);

  return (
    <main className="exercise-search-screen" aria-label="Exercise search">
      <h1>Search exercises</h1>
      <label className="logging-screen__field-label">
        <span>Exercise name</span>
        <input
          type="text"
          className="logging-field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or alias"
        />
      </label>
      {query.trim() !== '' && results.length === 0 && (
        <p className="exercise-search-screen__empty">
          No exercises match &ldquo;{query}&rdquo;.
        </p>
      )}
      <ul className="exercise-search-screen__results">
        {results.map((exercise) => (
          <li key={exercise.id}>
            <Link to={`/exercises/${exercise.id}/progression`}>
              {exercise.canonicalName}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
