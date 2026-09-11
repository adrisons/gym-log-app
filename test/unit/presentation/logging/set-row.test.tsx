import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetRow } from '@/presentation/logging/set-row';

describe('SetRow (WeightLoadInput + VolumeInput + SetConfirmControl, US1 minimal)', () => {
  it('confirm is disabled with a stated reason until a load or volume is entered (FR-019)', () => {
    render(<SetRow prefill={undefined} onConfirm={() => {}} />);

    const button = screen.getByRole('button', { name: /add set/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/enter a load or a rep count/i),
    ).toBeInTheDocument();
  });

  it('confirming with only reps entered appends a set with load "none" and no visible Save control (FR-003, FR-019)', async () => {
    const onConfirm = vi.fn();
    render(<SetRow prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.type(screen.getByLabelText(/reps/i), '8');
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 8 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
  });

  it('confirming with a weight entered includes it as a Weight load, ≥ 0 (FR-026)', async () => {
    const onConfirm = vi.fn();
    render(<SetRow prefill={undefined} onConfirm={onConfirm} />);

    await userEvent.type(screen.getByLabelText(/weight/i), '60');
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'weight', value: 60, unit: 'kg' },
      setKind: 'working',
    });
  });

  it("pre-fills from the previous set's load/volume (FR-008)", () => {
    render(
      <SetRow
        prefill={{
          volume: { kind: 'reps', count: 5 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByLabelText(/weight/i)).toHaveValue(100);
    expect(screen.getByLabelText(/reps/i)).toHaveValue(5);
    expect(screen.getByRole('button', { name: /add set/i })).toBeEnabled();
  });
});
