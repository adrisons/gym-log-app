import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseCataloguePanel } from '@/presentation/logging/exercise-catalogue-panel';
import type { Exercise } from '@/application/logging/use-cases';
import type { ExerciseId } from '@/domain/ids';

const exercise: Exercise = {
  id: 'ex-1' as ExerciseId,
  canonicalName: 'Glute bridge',
  aliases: [],
  defaultLoadType: 'weight',
  unilateral: false,
  discipline: 'Strength',
};

const other: Exercise = {
  id: 'ex-2' as ExerciseId,
  canonicalName: 'Hip thrust',
  aliases: [],
  defaultLoadType: 'weight',
  unilateral: false,
  discipline: 'Strength',
};

describe('ExerciseCataloguePanel (FR-017, FR-018, FR-020, FR-022)', () => {
  it('rename that collides opens a merge-offer dialog stating both names', async () => {
    const onRename = vi.fn().mockResolvedValue({
      status: 'collision',
      collidesWith: other,
    });
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onRename={onRename}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText(/rename exercise/i));
    await userEvent.type(
      screen.getByLabelText(/rename exercise/i),
      'Hip thrust',
    );
    await userEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(
      await screen.findByRole('alertdialog', { name: /name already in use/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Glute bridge/)).toBeInTheDocument();
    expect(screen.getByText(/Hip thrust/)).toBeInTheDocument();
  });

  it('declining the merge offer cancels the rename', async () => {
    const onRename = vi.fn().mockResolvedValue({
      status: 'collision',
      collidesWith: other,
    });
    const onMerge = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onRename={onRename}
        onMerge={onMerge}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /save name/i }));
    await userEvent.click(
      await screen.findByRole('button', { name: /cancel rename/i }),
    );

    expect(onMerge).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('alertdialog', { name: /name already in use/i }),
    ).not.toBeInTheDocument();
  });

  it('accepting the merge offer states plainly that it is not undoable, and has no undo affordance', async () => {
    const onRename = vi.fn().mockResolvedValue({
      status: 'collision',
      collidesWith: other,
    });
    const onMerge = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onRename={onRename}
        onMerge={onMerge}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /save name/i }));
    const mergeButton = await screen.findByRole('button', {
      name: /merge \(not undoable\)/i,
    });
    await userEvent.click(mergeButton);

    expect(onMerge).toHaveBeenCalledWith(other.id, exercise.id);
    expect(screen.queryByText(/undo/i)).not.toBeInTheDocument();
  });

  it('delete-with-history offers merge as an alternative in the same dialog', async () => {
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={true}
        search={() => [other]}
        onRename={vi.fn()}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /delete exercise/i }),
    );

    const dialog = await screen.findByRole('alertdialog', {
      name: /delete glute bridge/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /merge instead/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete anyway/i }),
    ).toBeInTheDocument();
  });

  it('delete without history confirms directly, no merge offer', async () => {
    const onDeleteConfirm = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onRename={vi.fn()}
        onMerge={() => {}}
        onDeleteConfirm={onDeleteConfirm}
        onClose={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /delete exercise/i }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /confirm delete/i }),
    );

    expect(onDeleteConfirm).toHaveBeenCalled();
  });
});
