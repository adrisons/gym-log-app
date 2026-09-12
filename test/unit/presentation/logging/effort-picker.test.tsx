import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffortPicker } from '@/presentation/logging/effort-picker';
import { EFFORT_LABELS } from '@/application/logging/view-models';

describe('EffortPicker (FR-4, ADR-0003)', () => {
  it('every level always shows its word label next to the number, never a bare digit', () => {
    render(<EffortPicker value={undefined} onChange={() => {}} />);
    for (const [level, label] of Object.entries(EFFORT_LABELS)) {
      expect(
        screen.getByRole('option', { name: `${level} — ${label}` }),
      ).toBeInTheDocument();
    }
  });

  it('starts on "Not recorded" when no effort is set (FR-4: optional)', () => {
    render(<EffortPicker value={undefined} onChange={() => {}} />);
    expect(
      screen.getByRole('option', { name: 'Not recorded' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('scrolling down from unset selects level 1', async () => {
    const onChange = vi.fn();
    render(<EffortPicker value={undefined} onChange={onChange} />);

    await userEvent.click(screen.getByRole('listbox', { name: /effort/i }));
    await userEvent.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('scrolling up from level 1 clears effort back to unset', async () => {
    const onChange = vi.fn();
    render(<EffortPicker value={1} onChange={onChange} />);

    await userEvent.click(screen.getByRole('listbox', { name: /effort/i }));
    await userEvent.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
