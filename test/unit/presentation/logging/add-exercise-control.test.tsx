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

  it('restores focus to the trigger button after a selection collapses the field', async () => {
    render(
      <AddExerciseControl
        buttonLabel="+ Add exercise"
        fieldLabel="Exercise"
        search={() => [squat]}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: '+ Add exercise' }),
    );
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByText('Back squat'));

    expect(
      screen.getByRole('button', { name: '+ Add exercise' }),
    ).toHaveFocus();
  });

  it('does not steal focus back to the trigger when the field closes because the user tabbed away (blur-driven close regression)', async () => {
    render(
      <>
        <AddExerciseControl
          buttonLabel="+ Add exercise"
          fieldLabel="Exercise"
          search={() => []}
          onSelectExercise={() => {}}
          onCreateExercise={() => {}}
        />
        <button type="button">Next control</button>
      </>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: '+ Add exercise' }),
    );
    expect(screen.getByRole('textbox')).toHaveFocus();

    // No results/create button rendered for an empty query, so the input
    // is the only focusable element inside the expanded field — Tab moves
    // straight to "Next control".
    await userEvent.tab();

    // Confirms the blur actually closed the field back to the trigger
    // button (the collapsed state)...
    expect(
      screen.getByRole('button', { name: '+ Add exercise' }),
    ).toBeInTheDocument();
    // ...but the close must leave focus exactly where Tab just put it —
    // never yank it back to the now-remounted trigger button.
    expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus();
  });
});
