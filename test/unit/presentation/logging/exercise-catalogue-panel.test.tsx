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
  defaultVolumeKind: 'reps',
  trackEffort: false,
  unilateral: false,
  discipline: 'Strength',
};

const other: Exercise = {
  id: 'ex-2' as ExerciseId,
  canonicalName: 'Hip thrust',
  aliases: [],
  defaultLoadType: 'weight',
  defaultVolumeKind: 'reps',
  trackEffort: false,
  unilateral: false,
  discipline: 'Strength',
};

describe('ExerciseCataloguePanel (FR-017, FR-018, FR-020, FR-022)', () => {
  it('renders one combined form with the name and the tracked-fields controls, no separate steps', () => {
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={vi.fn()}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText(/rename exercise/i)).toHaveValue(
      'Glute bridge',
    );
    expect(
      screen.getByRole('radiogroup', { name: /volume kind/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /track effort/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save name/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /edit tracked fields/i }),
    ).not.toBeInTheDocument();
  });

  it('saves the name and the tracked fields together from a single "Save changes" click', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'renamed', exercise });
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={onSave}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText(/rename exercise/i));
    await userEvent.type(
      screen.getByLabelText(/rename exercise/i),
      'Hip bridge',
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(onSave).toHaveBeenCalledWith('Hip bridge', {
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: true,
    });
  });

  it('moves focus into the name field on mount, and restores it on unmount (keyboard accessibility)', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={vi.fn()}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByLabelText(/rename exercise/i),
    );

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('logs and recovers, rather than throwing, when saving rejects (Copilot review, PR #43)', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValue(new Error('write failed'));
    const onClose = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={onSave}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={onClose}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(consoleError).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();
    consoleError.mockRestore();
  });

  it('closes once the save resolves without a collision', async () => {
    const onSave = vi.fn().mockResolvedValue({ status: 'renamed', exercise });
    const onClose = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={onSave}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={onClose}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(onClose).toHaveBeenCalled();
  });

  it('a rename that collides opens a merge-offer dialog stating both names, and does not close the form', async () => {
    const onSave = vi.fn().mockResolvedValue({
      status: 'collision',
      collidesWith: other,
    });
    const onClose = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={onSave}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={onClose}
      />,
    );

    await userEvent.clear(screen.getByLabelText(/rename exercise/i));
    await userEvent.type(
      screen.getByLabelText(/rename exercise/i),
      'Hip thrust',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(
      await screen.findByRole('alertdialog', { name: /name already in use/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Glute bridge/)).toBeInTheDocument();
    expect(screen.getByText(/Hip thrust/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('declining the merge offer cancels the rename', async () => {
    const onSave = vi.fn().mockResolvedValue({
      status: 'collision',
      collidesWith: other,
    });
    const onMerge = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={onSave}
        onMerge={onMerge}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /cancel rename/i }),
    );

    expect(onMerge).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('alertdialog', { name: /name already in use/i }),
    ).not.toBeInTheDocument();
  });

  it('accepting the merge offer states plainly that it is not undoable, and has no undo affordance', async () => {
    const onSave = vi.fn().mockResolvedValue({
      status: 'collision',
      collidesWith: other,
    });
    const onMerge = vi.fn();
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={onSave}
        onMerge={onMerge}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );
    const mergeButton = await screen.findByRole('button', {
      name: /merge \(not undoable\)/i,
    });
    await userEvent.click(mergeButton);

    expect(onMerge).toHaveBeenCalledWith(other.id, exercise.id);
    expect(screen.queryByText(/undo/i)).not.toBeInTheDocument();
  });

  it('delete-with-history offers merge as an alternative in the same popup', async () => {
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={true}
        search={() => [other]}
        onSave={vi.fn()}
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
        onSave={vi.fn()}
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

  it('cancelling the delete popup returns to the combined edit form', async () => {
    render(
      <ExerciseCataloguePanel
        exercise={exercise}
        hasHistory={false}
        search={() => []}
        onSave={vi.fn()}
        onMerge={() => {}}
        onDeleteConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /delete exercise/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByLabelText(/rename exercise/i)).toBeInTheDocument();
  });
});
