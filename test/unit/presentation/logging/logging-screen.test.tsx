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
        screen.getByRole('button', { name: 'Add exercise' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));

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

  it('a block created via "Add block" keeps its header/controls after an exercise is added to it (FR-2 regression)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(<LoggingScreen />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add block' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add block' }));

    // Still unnamed, still explicitly created: FR-2 requires it to show
    // its position label and stay renameable/deletable — never collapse
    // to "bare" (chrome-less) rendering just because it has no name yet.
    await waitFor(() => {
      expect(screen.getByText('Block 1')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete block/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 1' }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Overhead press',
    );
    await userEvent.click(screen.getByText('Create "Overhead press"'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Overhead press' }),
      ).toBeInTheDocument();
    });

    // The block this exercise landed in must still be a real block, not
    // a bare/chrome-less one, even though it's unnamed and now non-empty.
    expect(screen.getByText('Block 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete block/i }),
    ).toBeInTheDocument();
  });

  it('a loose block stays chrome-less even after its last exercise is deleted (empty-loose-block regression)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(<LoggingScreen />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add exercise' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Lat pulldown',
    );
    await userEvent.click(screen.getByText('Create "Lat pulldown"'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Lat pulldown' }),
      ).toBeInTheDocument();
    });
    // Loose block: no header/controls for it.
    expect(screen.queryByText('Block 1')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Lat pulldown actions' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete exercise' }),
    );

    // Now empty, but still loose: must stay invisible, not suddenly gain
    // a "Block 1" header with rename/delete controls.
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Lat pulldown' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Block 1')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^rename$/i }),
    ).not.toBeInTheDocument();
  });
});
