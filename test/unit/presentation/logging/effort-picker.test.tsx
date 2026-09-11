import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffortPicker } from '@/presentation/logging/effort-picker';
import { EFFORT_LABELS } from '@/application/logging/view-models';

describe('EffortPicker (FR-013, ADR-0003)', () => {
  it('every level always shows its word label next to the number, never a bare digit', () => {
    render(<EffortPicker value={undefined} onChange={() => {}} />);
    for (const [level, label] of Object.entries(EFFORT_LABELS)) {
      expect(
        screen.getByRole('radio', { name: `${level} — ${label}` }),
      ).toBeInTheDocument();
    }
  });

  it('one tap selects a level', async () => {
    const onChange = vi.fn();
    render(<EffortPicker value={undefined} onChange={onChange} />);

    await userEvent.click(
      screen.getByRole('radio', { name: `3 — ${EFFORT_LABELS[3]}` }),
    );

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('tapping the selected level again clears it', async () => {
    const onChange = vi.fn();
    render(<EffortPicker value={3} onChange={onChange} />);

    await userEvent.click(
      screen.getByRole('radio', { name: `3 — ${EFFORT_LABELS[3]}` }),
    );

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
