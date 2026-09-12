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

describe('SetRow (US1 minimal + US3 full load/effort/volume surface, ADR-0006)', () => {
  it('confirm is disabled with a stated reason until a load or volume is entered (FR-019)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    const button = screen.getByRole('button', { name: /add set/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/enter a load or a rep count/i),
    ).toBeInTheDocument();
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

  it('confirming with only reps entered appends a set with load "none" and no visible Save control (FR-003, FR-019)', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    expect(screen.queryByText(/^save$/i)).not.toBeInTheDocument();
  });

  it('confirming with a weight entered includes it as a Weight load, ≥ 0 (FR-026)', async () => {
    const onConfirm = vi.fn();
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '60',
    );
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'weight', value: 60, unit: 'kg' },
      setKind: 'working',
    });
  });

  it("pre-fills from the previous set's load/volume when it matches the current template (FR-008)", () => {
    render(
      <SetRow
        {...baseProps}
        prefill={{
          volume: { kind: 'reps', count: 5 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: /weight/i })).toHaveValue(
      100,
    );
    expect(screen.getByRole('option', { name: '5' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /add set/i })).toBeEnabled();
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

  it('switching the template to Band shows the band picker directly, no expand step', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="band"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Red' }));
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'band', label: 'Red' },
      setKind: 'working',
    });
  });

  it('Bodyweight with no component is a valid, confirmable load (US3, Acceptance Scenario 3.5)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="bodyweight"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'bodyweight' },
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
    await userEvent.click(screen.getByRole('listbox', { name: /^effort$/i }));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ effort: 3 }),
    );
  });
});
