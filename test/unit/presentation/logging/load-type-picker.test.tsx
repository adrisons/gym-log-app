import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadTypePicker } from '@/presentation/logging/load-type-picker';

describe('LoadTypePicker (FR-009)', () => {
  it('renders all four options and marks the selected one', () => {
    render(<LoadTypePicker selected="weight" onSelect={() => {}} />);

    for (const label of ['Weight', 'Bodyweight', 'Free text', 'None']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Weight' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('selecting an option calls onSelect and switches the rendered sub-input', async () => {
    const onSelect = vi.fn();
    render(<LoadTypePicker selected="weight" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Bodyweight' }));

    expect(onSelect).toHaveBeenCalledWith('bodyweight');
  });
});
