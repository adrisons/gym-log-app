import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SessionSavedToast } from '@/presentation/diary/session-saved-toast';

describe('SessionSavedToast', () => {
  it('calls onDismiss once the visible-duration timeout elapses', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<SessionSavedToast onDismiss={onDismiss} />);

    vi.advanceTimersByTime(1800);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('calls onDismiss on unmount even before the timeout elapses, so the one-shot flag it clears does not survive to a later remount', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(<SessionSavedToast onDismiss={onDismiss} />);

    vi.advanceTimersByTime(500);
    expect(onDismiss).not.toHaveBeenCalled();

    unmount();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('never calls onDismiss twice when the timeout fires and the resulting unmount follows', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(<SessionSavedToast onDismiss={onDismiss} />);

    vi.advanceTimersByTime(1800);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    unmount();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
