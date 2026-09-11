import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseSearchField } from '@/presentation/logging/exercise-search-field';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';

const squat: Exercise = {
  id: 'ex-1' as ExerciseId,
  canonicalName: 'Back squat',
  aliases: [],
  defaultLoadType: 'weight',
  unilateral: false,
  discipline: 'Strength',
};

describe('ExerciseSearchField (FR-002, FR-015, FR-016)', () => {
  it('shows results from the search function as the query changes', async () => {
    const search = vi.fn((query: string) => (query ? [squat] : []));
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/exercise/i), 'squat');

    expect(search).toHaveBeenCalled();
    expect(screen.getByText('Back squat')).toBeInTheDocument();
  });

  it('"create new exercise" is always the last result, visible with no query too', () => {
    const search = vi.fn(() => []);
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    expect(
      screen.getByText(/type a name to create a new exercise/i),
    ).toBeInTheDocument();
  });

  it('selecting a result calls onSelectExercise', async () => {
    const search = vi.fn(() => [squat]);
    const onSelectExercise = vi.fn();
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={onSelectExercise}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.click(screen.getByText('Back squat'));

    expect(onSelectExercise).toHaveBeenCalledWith(squat);
  });

  it('creating an exercise calls onCreateExercise with the trimmed query', async () => {
    const search = vi.fn(() => []);
    const onCreateExercise = vi.fn();
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={onCreateExercise}
      />,
    );

    await userEvent.type(screen.getByLabelText(/exercise/i), 'Hip thrust');
    await userEvent.click(screen.getByText('Create "Hip thrust"'));

    expect(onCreateExercise).toHaveBeenCalledWith('Hip thrust');
  });
});
