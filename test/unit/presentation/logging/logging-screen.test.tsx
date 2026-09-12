import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoggingScreen } from '@/presentation/logging/logging-screen';
import { useLoggingSession } from '@/application/logging/logging-store';
import { InMemoryStorage } from '../../../support';

describe('LoggingScreen (FR-001)', () => {
  it('calls initialize on mount and renders the restored/created draft with no loading spinner', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(<LoggingScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText(/session date & time/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('lets a user find/create an exercise and log a set end to end', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(<LoggingScreen />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search or create an exercise/i),
      ).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Back squat',
    );
    await userEvent.click(screen.getByText('Create "Back squat"'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Back squat' }),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await userEvent.click(screen.getByRole('button', { name: /add set/i }));

    await waitFor(async () => {
      const draft = await storage.getDraft();
      expect(draft?.blocks[0]?.exercises[0]?.sets).toHaveLength(1);
    });
  });
});
