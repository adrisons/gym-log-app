import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetRow } from '@/presentation/logging/set-row';

const baseProps = {
  loadKind: 'weight' as const,
  volumeKind: 'reps' as const,
  trackEffort: false,
  bandLabels: ['Red', 'Blue'],
  freeTextSuggestions: [],
  onSaveBandLabels: () => {},
};

function confirmButton() {
  return screen.getByRole('button', { name: /add set/i });
}

describe('SetRow (US1 minimal + US3 full load/effort/volume surface, ADR-0006, ADR-0010)', () => {
  it('the Confirm button is disabled and a reason is shown until every field the template asks for is filled (FR-019, ADR-0010)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(confirmButton()).toBeDisabled();
    expect(
      screen.getByText(/enter a weight and a rep count/i),
    ).toBeInTheDocument();
  });

  it('names only the still-missing field once the other is filled, not both (the exact bug this design fixes)', async () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));

    expect(confirmButton()).toBeDisabled();
    expect(
      screen.getByText(/^enter a weight to record this set\.$/i),
    ).toBeInTheDocument();
  });

  it('filling only reps never confirms a Weight-tracked set on its own — the button stays disabled (regression: used to silently save load "none")', async () => {
    const onConfirm = vi.fn();
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
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
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(8));
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
    expect(screen.getByRole('option', { name: '5' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
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

    // The wheel correctly shows nothing selected...
    expect(screen.getByRole('option', { name: '—' })).toHaveAttribute(
      'aria-selected',
      'true',
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

  it('Bodyweight with no component is confirmable once the volume is filled (US3, Acceptance Scenario 3.5)', async () => {
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
});
