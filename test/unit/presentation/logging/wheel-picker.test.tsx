import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WheelPicker } from '@/presentation/logging/wheel-picker';

const OPTIONS = [
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' },
  { value: 3, label: 'Three' },
];

describe('WheelPicker (docs/design.md §5/§7.4 — keyboard-operable, not pointer-only)', () => {
  it('renders every option and marks the current value selected', () => {
    render(
      <WheelPicker
        options={OPTIONS}
        value={2}
        onChange={() => {}}
        ariaLabel="Test picker"
      />,
    );

    const picker = screen.getByRole('listbox', { name: 'Test picker' });
    expect(picker).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Two' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: 'One' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('ArrowDown moves to the next option', async () => {
    const onChange = vi.fn();
    render(
      <WheelPicker
        options={OPTIONS}
        value={1}
        onChange={onChange}
        ariaLabel="Test picker"
      />,
    );

    await userEvent.click(screen.getByRole('listbox'));
    await userEvent.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('ArrowUp moves to the previous option and clamps at the first', async () => {
    const onChange = vi.fn();
    render(
      <WheelPicker
        options={OPTIONS}
        value={1}
        onChange={onChange}
        ariaLabel="Test picker"
      />,
    );

    await userEvent.click(screen.getByRole('listbox'));
    await userEvent.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('End jumps to the last option', async () => {
    const onChange = vi.fn();
    render(
      <WheelPicker
        options={OPTIONS}
        value={1}
        onChange={onChange}
        ariaLabel="Test picker"
      />,
    );

    await userEvent.click(screen.getByRole('listbox'));
    await userEvent.keyboard('{End}');

    expect(onChange).toHaveBeenCalledWith(3);
  });
});
