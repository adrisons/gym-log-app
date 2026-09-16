import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseTemplatePanel } from '@/presentation/logging/exercise-template-panel';
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

describe('ExerciseTemplatePanel (ADR-0006)', () => {
  it('warns that the change is forward-only, naming the exercise', () => {
    render(
      <ExerciseTemplatePanel
        exercise={squat}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByText(/keep exactly what you recorded/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Back squat/)).toBeInTheDocument();
  });

  it('saves the selected load type, volume kind, and track-effort choice', async () => {
    const onSave = vi.fn();
    render(
      <ExerciseTemplatePanel
        exercise={squat}
        onSave={onSave}
        onClose={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Free text' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Duration' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(onSave).toHaveBeenCalledWith({
      defaultLoadType: 'freeText',
      defaultVolumeKind: 'duration',
      trackEffort: true,
    });
  });

  it('cancel calls onClose without saving', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ExerciseTemplatePanel
        exercise={squat}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('restores focus to the trigger that opened it once Save/Cancel unmounts the dialog (focus-restoration regression)', async () => {
    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit tracked fields…
          </button>
          {open && (
            <ExerciseTemplatePanel
              exercise={squat}
              onSave={() => setOpen(false)}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      );
    }
    render(<Wrapper />);

    const trigger = screen.getByRole('button', {
      name: /edit tracked fields/i,
    });
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /edit tracked fields/i }),
    ).toHaveFocus();
  });
});
