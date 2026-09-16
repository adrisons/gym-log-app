import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetRow } from '@/presentation/logging/set-row';
import { useUnconfirmedEntryTracker } from '@/application/logging/unconfirmed-entry-tracker';

const baseProps = {
  loadKind: 'weight' as const,
  volumeKind: 'reps' as const,
  trackEffort: false,
  bandLabels: ['Red', 'Blue'],
  freeTextSuggestions: [],
  onSaveBandLabels: () => {},
  unit: 'kg' as const,
  quickIncrements: { durationSeconds: 5, distanceMetres: 50 },
};

function confirmButton() {
  return screen.getByRole('button', { name: /add set/i });
}

describe('SetRow (US1 minimal + US3 full load/effort/volume surface, ADR-0006, ADR-0010)', () => {
  it('the Confirm button is disabled until every field the template asks for is filled, with no status text explaining why (FR-019, ADR-0010, ADR-0014)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(confirmButton()).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays disabled with only one of two required fields filled (the exact bug this design fixes)', async () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /^reps$/i }),
      '5',
    );

    expect(confirmButton()).toBeDisabled();
  });

  it('filling only reps never confirms a Weight-tracked set on its own — the button stays disabled (regression: used to silently save load "none")', async () => {
    const onConfirm = vi.fn();
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /^reps$/i }),
      '5',
    );
    await userEvent.click(confirmButton());

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows only the load input and volume control the template says — no load-type or volume-kind switcher', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /change load type/i }),
    ).not.toBeInTheDocument();
  });

  it('effort is hidden unless the template tracks it', () => {
    const { rerender } = render(
      <SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />,
    );
    expect(
      screen.queryByRole('listbox', { name: /effort/i }),
    ).not.toBeInTheDocument();

    rerender(
      <SetRow
        {...baseProps}
        trackEffort
        prefill={undefined}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByRole('listbox', { name: /effort/i }),
    ).toBeInTheDocument();
  });

  it('nothing is recorded from filling in fields alone — Confirm must be pressed (ADR-0010, supersedes ADR-0007)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="none"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(8));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('pressing Confirm records the set with load "none" once reps alone satisfies the template', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="none"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(8));
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
  });

  it('filling weight then reps and pressing Confirm records exactly one set with both', async () => {
    const onConfirm = vi.fn();
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '60',
    );
    await userEvent.type(
      screen.getByRole('spinbutton', { name: /^reps$/i }),
      '8',
    );
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'weight', value: 60, unit: 'kg' },
      setKind: 'working',
    });
  });

  it("pre-fills from the previous set's load/volume when it matches the current template, ready for a single Confirm tap (FR-008)", async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        prefill={{
          volume: { kind: 'reps', count: 5 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: /weight/i })).toHaveValue(
      100,
    );
    expect(screen.getByRole('spinbutton', { name: /^reps$/i })).toHaveValue(5);
    expect(confirmButton()).toBeEnabled();

    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'weight', value: 100, unit: 'kg' },
      setKind: 'working',
    });
  });

  it('a fresh Bodyweight row still needs its volume filled — Bodyweight load alone is not enough (ADR-0010: every template field is required to add a set)', async () => {
    render(
      <SetRow
        {...baseProps}
        loadKind="bodyweight"
        prefill={undefined}
        onConfirm={() => {}}
      />,
    );

    expect(confirmButton()).toBeDisabled();

    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));

    expect(confirmButton()).toBeEnabled();
  });

  it('normalizes an out-of-range historical rep-count prefill instead of offering it under an "unset" wheel (out-of-range-prefill regression)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        prefill={{
          // Legal historical data: `createVolume` has no upper bound on
          // reps, but the wheel only offers 1..100.
          volume: { kind: 'reps', count: 150 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={onConfirm}
      />,
    );

    // The reps field correctly shows nothing entered...
    expect(screen.getByRole('spinbutton', { name: /^reps$/i })).toHaveValue(
      null,
    );
    // ...so Confirm stays disabled until reps is re-entered.
    expect(confirmButton()).toBeDisabled();
  });

  it("ignores a prefill whose load kind no longer matches the exercise's template", () => {
    render(
      <SetRow
        {...baseProps}
        loadKind="band"
        prefill={{
          volume: { kind: 'reps', count: 5 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={() => {}}
      />,
    );

    expect(
      screen.queryByRole('spinbutton', { name: /weight/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Red' })).toBeInTheDocument();
  });

  it('the weight field has no dedicated quick-increment buttons (numeric keypad only)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(
      screen.queryByRole('button', { name: /increase weight/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /decrease weight/i }),
    ).not.toBeInTheDocument();
  });

  it('selecting a band and pressing Confirm records it as a Band load, no expand step', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="band"
        volumeKind="reps"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Red' }));
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'band', label: 'Red' },
      setKind: 'working',
    });
  });

  it('Bodyweight with an added component is confirmable once the volume is filled too (US3, Acceptance Scenario 3.5)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="bodyweight"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /added.*assisted/i }),
      '10',
    );
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'bodyweight', addedOrAssistedKg: 10 },
      setKind: 'working',
    });
  });

  it('selecting an effort level includes it, always paired with its word label (ADR-0003)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        trackEffort
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '20',
    );
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await userEvent.click(screen.getByRole('listbox', { name: /^effort$/i }));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ effort: 3 }),
    );
  });

  it('labels the Weight field with Settings’ defaultUnit and tags a new Weight load with it (spec 006 FR-001/SC-003)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        unit="lb"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByRole('spinbutton', { name: /weight \(lb\)/i }),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '100',
    );
    await userEvent.type(
      screen.getByRole('spinbutton', { name: /^reps$/i }),
      '5',
    );
    await userEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        load: { kind: 'weight', value: 100, unit: 'lb' },
      }),
    );
  });

  it('uses Settings’ quickIncrements for the Duration/Distance +/- step sizes (spec 006 FR-001/SC-003)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        volumeKind="duration"
        quickIncrements={{ durationSeconds: 15, distanceMetres: 200 }}
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    const increase = screen.getByRole('button', {
      name: /increase duration \(s\) by 15/i,
    });
    await userEvent.click(increase);

    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(
      15,
    );
  });

  it('the compact reps field rejects 0 and fractional entries — Confirm stays disabled (Copilot review, PR #33: reps must be a positive integer)', async () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    const repsField = screen.getByRole('spinbutton', { name: /^reps$/i });
    await userEvent.type(repsField, '0');
    expect(repsField).toHaveValue(null);
    expect(confirmButton()).toBeDisabled();

    await userEvent.clear(repsField);
    await userEvent.type(repsField, '5.5');
    expect(repsField).toHaveValue(null);
    expect(confirmButton()).toBeDisabled();
  });

  it('the compact reps/weight fields blur on wheel so a scroll gesture cannot silently change the value (Copilot review, PR #33)', async () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    const repsField = screen.getByRole('spinbutton', { name: /^reps$/i });
    repsField.focus();
    expect(repsField).toHaveFocus();

    await userEvent.pointer({ target: repsField });
    repsField.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -1, bubbles: true }),
    );

    expect(repsField).not.toHaveFocus();
  });
});

describe('SetRow editing an existing set in place (ADR-0010)', () => {
  it('pre-fills every field — including effort — from the set being edited, using its own load/volume kind', () => {
    render(
      <SetRow
        {...baseProps}
        loadKind="bodyweight"
        volumeKind="duration"
        trackEffort
        prefill={undefined}
        editingSet={{
          load: { kind: 'weight', value: 80, unit: 'kg' },
          volume: { kind: 'reps', count: 6 },
          effort: 4,
        }}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: /weight/i })).toHaveValue(80);
    expect(screen.getByRole('option', { name: '6' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: '4 — Hard' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps an already-recorded Weight load’s own unit, not Settings’ current default (spec 006 FR-001/SC-003)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        unit="kg"
        prefill={undefined}
        editingSet={{ load: { kind: 'weight', value: 80, unit: 'lb' } }}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    // The set was recorded in lb; the current Settings default has since
    // moved to kg. The field must still show — and, unchanged, still
    // save as — lb: `domain/load.ts` stores a Weight load's number
    // exactly as entered, so relabeling it kg here would silently change
    // what the already-recorded 80 means without the user touching it.
    expect(
      screen.getByRole('spinbutton', { name: /weight \(lb\)/i }),
    ).toHaveValue(80);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        load: { kind: 'weight', value: 80, unit: 'lb' },
      }),
    );
  });

  it('shows a Cancel button only when onCancel is given, labels Confirm "Save changes", and requires only the domain minimum', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <SetRow
        {...baseProps}
        prefill={undefined}
        editingSet={{ load: { kind: 'weight', value: 80, unit: 'kg' } }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // A load alone is already enough to edit — the stricter add-mode
    // "both fields the template tracks" rule doesn't apply here.
    expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms the edited values, not the exercise template it was originally recorded under', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="bodyweight"
        prefill={undefined}
        editingSet={{
          load: { kind: 'weight', value: 80, unit: 'kg' },
          volume: { kind: 'reps', count: 6 },
        }}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    const weightField = screen.getByRole('spinbutton', { name: /weight/i });
    await userEvent.clear(weightField);
    await userEvent.type(weightField, '85');
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 6 },
      load: { kind: 'weight', value: 85, unit: 'kg' },
      setKind: 'working',
    });
  });

  it('preserves a previously recorded effort even when the template no longer tracks it', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        trackEffort={false}
        prefill={undefined}
        editingSet={{
          load: { kind: 'weight', value: 80, unit: 'kg' },
          volume: { kind: 'reps', count: 6 },
          effort: 5,
        }}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    expect(
      screen.queryByRole('listbox', { name: /effort/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ effort: 5 }),
    );
  });

  it('preserves an out-of-range historical rep count on Save when reps is left untouched (Copilot review, PR #27: the wheel only offers 1..100, but must not silently drop a legal higher value)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        prefill={undefined}
        editingSet={{
          load: { kind: 'weight', value: 100, unit: 'kg' },
          volume: { kind: 'reps', count: 150 },
        }}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    // The compact row's reps field still shows the true held value —
    // editing preserves an out-of-range historical count (`preserveOutOfRange`
    // in `initialVolumeValue`) rather than blanking it the way a fresh add's
    // prefill does.
    expect(screen.getByRole('spinbutton', { name: /^reps$/i })).toHaveValue(
      150,
    );

    // ...and that held value is still 150 until the user explicitly
    // changes it, so saving without touching reps must not delete it.
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 150 },
      load: { kind: 'weight', value: 100, unit: 'kg' },
      setKind: 'working',
    });
  });

  it('stays disabled editing a none-load set with no volume entered yet (Copilot review, PR #27)', () => {
    render(
      <SetRow
        {...baseProps}
        volumeKind="duration"
        prefill={undefined}
        editingSet={{ load: { kind: 'none' } }}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeDisabled();
  });

  describe('unconfirmed-entry-tracker integration (spec 009 FR-002/FR-018)', () => {
    beforeEach(() => {
      useUnconfirmedEntryTracker.setState({ count: 0 });
    });

    it('increments the tracker while mounted and decrements on unmount', () => {
      const { unmount } = render(
        <SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />,
      );

      expect(useUnconfirmedEntryTracker.getState().count).toBe(1);

      unmount();

      expect(useUnconfirmedEntryTracker.getState().count).toBe(0);
    });

    it('tracks more than one open row at once (different exercises/blocks)', () => {
      const { unmount: unmountFirst } = render(
        <SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />,
      );
      const { unmount: unmountSecond } = render(
        <SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />,
      );

      expect(useUnconfirmedEntryTracker.getState().count).toBe(2);

      unmountFirst();
      expect(useUnconfirmedEntryTracker.getState().count).toBe(1);

      unmountSecond();
      expect(useUnconfirmedEntryTracker.getState().count).toBe(0);
    });
  });
});
