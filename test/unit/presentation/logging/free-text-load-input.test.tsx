import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FreeTextLoadInput } from '@/presentation/logging/free-text-load-input';

describe('FreeTextLoadInput (FR-012)', () => {
  it('shows a visible character counter', () => {
    render(
      <FreeTextLoadInput text="abc" suggestions={[]} onChange={() => {}} />,
    );
    expect(screen.getByText('3/40')).toBeInTheDocument();
  });

  it('hard-stops entry at 40 characters', () => {
    render(<FreeTextLoadInput text="" suggestions={[]} onChange={() => {}} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input.maxLength).toBe(40);
  });

  it('autocompletes from previously used values via a datalist', () => {
    render(
      <FreeTextLoadInput
        text=""
        suggestions={['Setting 4', 'Setting 6']}
        onChange={() => {}}
      />,
    );
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('list', 'free-text-load-suggestions');
    const options = document.querySelectorAll(
      '#free-text-load-suggestions option',
    );
    expect([...options].map((o) => o.getAttribute('value'))).toEqual([
      'Setting 4',
      'Setting 6',
    ]);
  });

  it('calls onChange as the user types', async () => {
    const onChange = vi.fn();
    render(<FreeTextLoadInput text="" suggestions={[]} onChange={onChange} />);
    await userEvent.type(screen.getByRole('combobox'), 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
