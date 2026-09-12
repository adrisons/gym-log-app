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
  defaultVolumeKind: 'reps',
  trackEffort: false,
  unilateral: false,
  discipline: 'Strength',
};

describe('ExerciseSearchField (FR-002, FR-015, FR-016)', () => {
  it('keeps suggestions closed until the field is focused', () => {
    const search = vi.fn(() => [squat]);
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
  });

  it('shows results from the search function once focused, as the query changes', async () => {
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

  it('does not offer "create" once the query exactly matches an existing exercise', async () => {
    const search = vi.fn(() => [squat]);
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/exercise/i), 'Back squat');

    expect(screen.queryByText('Create "Back squat"')).not.toBeInTheDocument();
  });

  it('offers "create" once the query has no exact match', async () => {
    const search = vi.fn(() => []);
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/exercise/i), 'Hip thrust');

    expect(screen.getByText('Create "Hip thrust"')).toBeInTheDocument();
  });

  it('selecting a result calls onSelectExercise and closes the suggestions', async () => {
    const search = vi.fn(() => [squat]);
    const onSelectExercise = vi.fn();
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={onSelectExercise}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.click(screen.getByLabelText(/exercise/i));
    await userEvent.click(screen.getByText('Back squat'));

    expect(onSelectExercise).toHaveBeenCalledWith(squat);
    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
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

  it('closes the suggestions on Escape', async () => {
    const search = vi.fn(() => [squat]);
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    const input = screen.getByLabelText(/exercise/i);
    await userEvent.click(input);
    expect(screen.getByText('Back squat')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
  });
});
