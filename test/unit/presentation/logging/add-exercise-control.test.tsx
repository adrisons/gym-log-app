import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddExerciseControl } from '@/presentation/logging/add-exercise-control';
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

describe('AddExerciseControl', () => {
  it('renders as a button, not a search field, until tapped', () => {
    render(
      <AddExerciseControl
        buttonLabel="+ Add exercise"
        fieldLabel="Exercise"
        search={() => []}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: '+ Add exercise' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('expands into the search field on tap, and selecting an exercise collapses it back', async () => {
    const search = vi.fn(() => [squat]);
    const onSelectExercise = vi.fn();
    render(
      <AddExerciseControl
        buttonLabel="+ Add exercise"
        fieldLabel="Exercise"
        search={search}
        onSelectExercise={onSelectExercise}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: '+ Add exercise' }),
    );
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.click(screen.getByText('Back squat'));

    expect(onSelectExercise).toHaveBeenCalledWith(squat);
    expect(
      screen.getByRole('button', { name: '+ Add exercise' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
