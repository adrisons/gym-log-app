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

  it('never exposes combobox disclosure attributes on the plain textbox (invalid-aria regression)', async () => {
    const search = vi.fn(() => [squat]);
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    const input = screen.getByRole('textbox');
    await userEvent.click(input);

    // This is deliberately a plain textbox, not an ARIA combobox — it
    // implements neither aria-activedescendant-driven option focus nor
    // arrow-key navigation, so `aria-expanded`/`aria-controls` (properties
    // the `textbox` role does not support at all) would announce a
    // half-implemented widget state to assistive tech.
    expect(input).not.toHaveAttribute('aria-expanded');
    expect(input).not.toHaveAttribute('aria-controls');
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

  it('does not offer "create" when the query exactly matches an existing alias, accent/case-insensitively (FR-016)', async () => {
    const withAlias = { ...squat, aliases: ['Barbell squat'] };
    const search = vi.fn(() => [withAlias]);
    render(
      <ExerciseSearchField
        search={search}
        onSelectExercise={() => {}}
        onCreateExercise={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/exercise/i), 'BARBELL SQUAT');

    expect(
      screen.queryByText('Create "BARBELL SQUAT"'),
    ).not.toBeInTheDocument();
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

  it('reopens suggestions on the next keystroke after Escape, without needing to leave and refocus the field (keyboard-reachability regression)', async () => {
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
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();

    // `userEvent.keyboard` (unlike `.type`) fires no click of its own, so
    // this exercises exactly the keys-only path: still focused in the
    // input, no blur, no re-click/re-focus in between — just keeps typing.
    await userEvent.keyboard('s');

    expect(screen.getByText('Back squat')).toBeInTheDocument();
  });

  it('closes on Escape from a focused result button too, and returns focus to the input (keyboard-escape regression)', async () => {
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
    // Tab from the input onto the result button — Escape's handler used
    // to live only on the input itself, so it did nothing from here.
    await userEvent.tab();
    expect(screen.getByText('Back squat')).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });
});
