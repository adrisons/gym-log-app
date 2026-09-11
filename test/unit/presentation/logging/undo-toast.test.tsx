import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UndoToast } from '@/presentation/logging/undo-toast';

describe('UndoToast (FR-004, FR-023)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a 5-second countdown whose information survives reduced motion (a visible numeral, not just the bar's animation)", () => {
    render(
      <UndoToast
        message="Block deleted"
        expiresAt={Date.now() + 5000}
        onUndo={() => {}}
      />,
    );
    expect(screen.getByText('5s')).toBeInTheDocument();
  });

  it('tapping undo within the window calls onUndo', () => {
    const onUndo = vi.fn();
    render(
      <UndoToast
        message="Block deleted"
        expiresAt={Date.now() + 5000}
        onUndo={onUndo}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /undo/i }));

    expect(onUndo).toHaveBeenCalled();
  });

  it('after the window elapses, the toast is gone', async () => {
    const { container } = render(
      <UndoToast
        message="Block deleted"
        expiresAt={Date.now() + 5000}
        onUndo={() => {}}
      />,
    );

    await vi.advanceTimersByTimeAsync(5100);

    expect(container.querySelector('.undo-toast')).toBeNull();
  });
});
