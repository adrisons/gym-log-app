import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionDateTimeField } from '@/presentation/logging/session-date-time-field';

describe('SessionDateTimeField (FR-001)', () => {
  it("renders the draft's dateTime", () => {
    render(
      <SessionDateTimeField
        value="2026-09-11T09:00:00.000Z"
        onChange={() => {}}
      />,
    );
    const input = screen.getByLabelText(
      /session date & time/i,
    ) as HTMLInputElement;
    expect(input.value).not.toBe('');
  });

  it('calls onChange with an ISO string when edited', () => {
    const onChange = vi.fn();
    render(
      <SessionDateTimeField
        value="2026-09-11T09:00:00.000Z"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/session date & time/i);

    fireEvent.change(input, { target: { value: '2026-09-12T10:30' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const lastCall = onChange.mock.calls.at(-1)?.[0] as string;
    expect(() => new Date(lastCall).toISOString()).not.toThrow();
  });

  it('is always editable — no disabled state applies', () => {
    render(
      <SessionDateTimeField
        value="2026-09-11T09:00:00.000Z"
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/session date & time/i)).not.toBeDisabled();
  });
});
