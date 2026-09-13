import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseSetList } from '@/presentation/logging/exercise-set-list';
import type { DraftSet } from '@/application/logging/draft';

const baseProps = {
  loadKind: 'weight' as const,
  volumeKind: 'reps' as const,
  trackEffort: false,
  bandLabels: [],
  freeTextSuggestions: [],
  prefill: undefined,
  onSaveBandLabels: () => {},
};

const loggedSet: DraftSet = {
  id: 'set-1',
  volume: { kind: 'reps', count: 5 },
  load: { kind: 'weight', value: 100, unit: 'kg' },
  effort: 4,
  setKind: 'working',
  completed: true,
};

describe('ExerciseSetList (ADR-0010)', () => {
  it('opens the add form by default when the entry has no sets yet, with no "+ Add set" button', () => {
    render(
      <ExerciseSetList
        {...baseProps}
        sets={[]}
        onAddSet={() => {}}
        onUpdateSet={() => {}}
        onDeleteSet={() => {}}
      />,
    );

    expect(
      screen.getByRole('spinbutton', { name: /weight/i }),
    ).toBeInTheDocument();
    // Only the form's own Confirm button ("Add set", disabled until
    // filled) is present — no separate "+ Add set" toggle to reopen it.
    expect(screen.getAllByRole('button', { name: 'Add set' })).toHaveLength(1);
  });

  it('collapses to a compact "+ Add set" button once the entry already has a logged set', () => {
    render(
      <ExerciseSetList
        {...baseProps}
        sets={[loggedSet]}
        onAddSet={() => {}}
        onUpdateSet={() => {}}
        onDeleteSet={() => {}}
      />,
    );

    expect(
      screen.queryByRole('spinbutton', { name: /weight/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add set' })).toBeInTheDocument();
  });

  it('shows every value already recorded for a set — load, volume, and effort — in its summary', () => {
    render(
      <ExerciseSetList
        {...baseProps}
        sets={[loggedSet]}
        onAddSet={() => {}}
        onUpdateSet={() => {}}
        onDeleteSet={() => {}}
      />,
    );

    expect(screen.getByText('100 kg')).toBeInTheDocument();
    expect(screen.getByText('5 reps')).toBeInTheDocument();
    expect(screen.getByText(/4 — Hard/)).toBeInTheDocument();
  });

  it('confirming the add form closes it back to the "+ Add set" button', async () => {
    const onAddSet = vi.fn();
    render(
      <ExerciseSetList
        {...baseProps}
        sets={[]}
        onAddSet={onAddSet}
        onUpdateSet={() => {}}
        onDeleteSet={() => {}}
      />,
    );

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '60',
    );
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await userEvent.click(screen.getByRole('button', { name: 'Add set' }));

    expect(onAddSet).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'weight', value: 60, unit: 'kg' },
      setKind: 'working',
    });
    expect(
      screen.queryByRole('spinbutton', { name: /weight/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add set' })).toBeInTheDocument();
  });

  it("offers Edit and Delete set from a logged set's menu (replacing the old bare delete button)", async () => {
    const onDeleteSet = vi.fn();
    render(
      <ExerciseSetList
        {...baseProps}
        sets={[loggedSet]}
        onAddSet={() => {}}
        onUpdateSet={() => {}}
        onDeleteSet={onDeleteSet}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /100 kg 5 reps actions/i }),
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete set' }));

    expect(onDeleteSet).toHaveBeenCalledWith('set-1');
  });

  it('Edit opens the form pre-filled with that set\'s own values, replacing the "+ Add set" button, with a Cancel', async () => {
    render(
      <ExerciseSetList
        {...baseProps}
        sets={[loggedSet]}
        onAddSet={() => {}}
        onUpdateSet={() => {}}
        onDeleteSet={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /100 kg 5 reps actions/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(
      screen.queryByRole('button', { name: 'Add set' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /weight/i })).toHaveValue(
      100,
    );
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByRole('button', { name: 'Add set' })).toBeInTheDocument();
  });

  it("confirming an edit calls onUpdateSet with the set's id, not onAddSet", async () => {
    const onAddSet = vi.fn();
    const onUpdateSet = vi.fn();
    render(
      <ExerciseSetList
        {...baseProps}
        sets={[loggedSet]}
        onAddSet={onAddSet}
        onUpdateSet={onUpdateSet}
        onDeleteSet={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /100 kg 5 reps actions/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(onUpdateSet).toHaveBeenCalledWith(
      'set-1',
      expect.objectContaining({
        load: { kind: 'weight', value: 100, unit: 'kg' },
      }),
    );
    expect(onAddSet).not.toHaveBeenCalled();
  });

  it("reopens the add form automatically once the entry's last remaining set is deleted", async () => {
    function Wrapper() {
      const [sets, setSets] = useState<DraftSet[]>([loggedSet]);
      return (
        <ExerciseSetList
          {...baseProps}
          sets={sets}
          onAddSet={() => {}}
          onUpdateSet={() => {}}
          onDeleteSet={(setId) =>
            setSets((current) => current.filter((s) => s.id !== setId))
          }
        />
      );
    }
    render(<Wrapper />);

    expect(screen.getByRole('button', { name: 'Add set' })).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /100 kg 5 reps actions/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete set' }));

    expect(
      screen.getByRole('spinbutton', { name: /weight/i }),
    ).toBeInTheDocument();
    // Only the form's own Confirm button remains — the "+ Add set" toggle
    // that was showing before the delete is gone now that the form itself
    // reopened.
    expect(screen.getAllByRole('button', { name: 'Add set' })).toHaveLength(1);
  });
});
