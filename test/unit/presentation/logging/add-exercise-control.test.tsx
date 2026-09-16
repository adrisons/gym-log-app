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

  it('opens a popup with the search field on tap, and selecting an exercise closes it back', async () => {
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
    expect(
      screen.getByRole('dialog', { name: 'Exercise' }),
    ).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.click(screen.getByText('Back squat'));

    expect(onSelectExercise).toHaveBeenCalledWith(squat);
    expect(
      screen.getByRole('button', { name: '+ Add exercise' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('restores focus to the trigger button after a selection closes the popup', async () => {
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

  it('closes the popup and restores focus to the trigger on Escape', async () => {
    render(
      <AddExerciseControl
        buttonLabel="+ Add exercise"
        fieldLabel="Exercise"
        search={() => []}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: '+ Add exercise' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '+ Add exercise' }),
    ).toHaveFocus();
  });

  it('closes the popup on a backdrop click', async () => {
    render(
      <AddExerciseControl
        buttonLabel="+ Add exercise"
        fieldLabel="Exercise"
        search={() => []}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: '+ Add exercise' }),
    );
    const dialog = screen.getByRole('dialog');

    // Clicking the backdrop itself (the dialog's own parent), not the
    // dialog panel — a tap inside the panel must not close it.
    await userEvent.click(dialog.parentElement!);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps Tab focus inside the popup (aria-modal alone does not do this)', async () => {
    const search = vi.fn(() => [squat]);
    render(
      <>
        <AddExerciseControl
          buttonLabel="+ Add exercise"
          fieldLabel="Exercise"
          search={search}
          onSelectExercise={() => {}}
          onCreateExercise={() => {}}
        />
        <button type="button">Outside control</button>
      </>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: '+ Add exercise' }),
    );
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    const lastFocusable = screen.getByText('Back squat');

    lastFocusable.focus();
    await userEvent.tab();

    // Forward Tab from the last focusable element inside the dialog wraps
    // back to the first one (the input) rather than escaping to the
    // trigger button or "Outside control" behind the backdrop.
    expect(input).toHaveFocus();

    await userEvent.tab({ shift: true });

    // Shift+Tab from the first element wraps to the last one.
    expect(lastFocusable).toHaveFocus();
  });
});
