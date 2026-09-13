import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SessionSavedToast } from '@/presentation/diary/session-saved-toast';

// Cleanup defers its `onDismiss` call by one microtask (see the component's
// own comment) to tell a real unmount apart from React StrictMode's
// dev-only mount→cleanup→mount probe — flush that microtask explicitly
// wherever a test needs to observe the result.
const flushMicrotasks = () => Promise.resolve();

describe('SessionSavedToast', () => {
  it('calls onDismiss once the visible-duration timeout elapses', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<SessionSavedToast onDismiss={onDismiss} />);

    vi.advanceTimersByTime(1800);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('calls onDismiss on unmount even before the timeout elapses, so the one-shot flag it clears does not survive to a later remount', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(<SessionSavedToast onDismiss={onDismiss} />);

    vi.advanceTimersByTime(500);
    expect(onDismiss).not.toHaveBeenCalled();

    unmount();
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('never calls onDismiss twice when the timeout fires and the resulting unmount follows', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(<SessionSavedToast onDismiss={onDismiss} />);

    vi.advanceTimersByTime(1800);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    unmount();
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not call onDismiss for StrictMode's dev-only mount→cleanup→mount probe, only for a real unmount (Copilot review, PR #22)", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(
      <StrictMode>
        <SessionSavedToast onDismiss={onDismiss} />
      </StrictMode>,
    );
    // StrictMode's probe (setup → cleanup → setup, all synchronous) has
    // already run by the time `render` returns. If cleanup's deferred
    // dismiss weren't cancelled by the following setup, this microtask
    // flush would surface it here as a spurious call.
    await flushMicrotasks();
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1800);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    unmount();
    await flushMicrotasks();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
