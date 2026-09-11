import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetRow } from '@/presentation/logging/set-row';

const baseProps = {
  defaultLoadKind: 'weight' as const,
  bandLabels: ['Red', 'Blue'],
  freeTextSuggestions: [],
  onLoadTypeChange: () => {},
  onSaveBandLabels: () => {},
};

describe('SetRow (US1 minimal + US3 full load/effort/volume surface)', () => {
  it('confirm is disabled with a stated reason until a load or volume is entered (FR-019)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    const button = screen.getByRole('button', { name: /add set/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/enter a load or a rep count/i),
    ).toBeInTheDocument();
  });

  it('confirming with only reps entered appends a set with load "none" and no visible Save control (FR-003, FR-019)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        defaultLoadKind="none"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /^reps/i }),
      '8',
    );
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

  it("pre-fills from the previous set's load/volume (FR-008)", () => {
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
    expect(screen.getByRole('spinbutton', { name: /^reps/i })).toHaveValue(5);
    expect(screen.getByRole('button', { name: /add set/i })).toBeEnabled();
  });

  it('tapping the weight quick-increment at 0 keeps it at 0 and is disabled with a reason (FR-010)', async () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    const decrement = screen.getByRole('button', {
      name: /decrease weight \(already at the 0 kg minimum\)/i,
    });
    expect(decrement).toBeDisabled();
  });

  it('quick-increment raises the weight value (FR-010)', async () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    await userEvent.click(
      screen.getByRole('button', { name: /increase weight by 2.5 kg/i }),
    );

    expect(screen.getByRole('spinbutton', { name: /weight/i })).toHaveValue(
      2.5,
    );
  });

  it('switching to Band and picking a label produces a Band load (US3)', async () => {
    const onConfirm = vi.fn();
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Band' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Red' }));
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'band', label: 'Red' },
      setKind: 'working',
    });
  });

  it('switching to Bodyweight with no component is a valid, confirmable load (US3, Acceptance Scenario 3.5)', async () => {
    const onConfirm = vi.fn();
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Bodyweight' }));
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'bodyweight' },
      setKind: 'working',
    });
  });

  it('selecting an effort level includes it, always paired with its word label (ADR-0003)', async () => {
    const onConfirm = vi.fn();
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '20',
    );
    await userEvent.click(screen.getByRole('radio', { name: /3 —/ }));
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ effort: 3 }),
    );
  });

  it('calls onLoadTypeChange when the load type is switched (FR-009)', async () => {
    const onLoadTypeChange = vi.fn();
    render(
      <SetRow
        {...baseProps}
        onLoadTypeChange={onLoadTypeChange}
        prefill={undefined}
        onConfirm={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Free text' }));

    expect(onLoadTypeChange).toHaveBeenCalledWith('freeText');
  });
});
