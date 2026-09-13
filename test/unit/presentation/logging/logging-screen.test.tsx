import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { LoggingScreen } from '@/presentation/logging/logging-screen';
import { useLoggingSession } from '@/application/logging/logging-store';
import { InMemoryStorage } from '../../../support';

describe('LoggingScreen (FR-001)', () => {
  it('calls initialize on mount and renders the restored/created draft with no loading spinner', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/session date & time/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('lets a user find/create an exercise and log a set end to end', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

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

    await waitFor(async () => {
      const draft = await storage.getDraft();
      expect(draft?.blocks[0]?.exercises[0]?.sets).toHaveLength(1);
    });
  });

  it('marks only the most recently committed set for the entrance animation, not ones already in the list (Copilot review, PR #22)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    const { container } = render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add exercise' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Deadlift',
    );
    await userEvent.click(screen.getByText('Create "Deadlift"'));
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Deadlift' }),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await waitFor(async () => {
      const draft = await storage.getDraft();
      expect(draft?.blocks[0]?.exercises[0]?.sets).toHaveLength(1);
    });

    // A fresh SetRow mounts for the next set (keyed on the entry's set
    // count) — logging a second set must move the animation marker to it
    // instead of leaving (or also adding) it on the first. (It prefills
    // from the repeat-last-set value, so this only needs *a* further edit,
    // not any particular rep count.)
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}');
    // One `waitFor`, not two: the animation marker is intentionally
    // consumed a short time after being set (`logging-screen.tsx`'s
    // `SET_SUMMARY_ANIMATION_MS` effect), so asserting the DOM in a
    // separate, later `waitFor` would race that cleanup. Checking both the
    // storage write and the marked row in the same callback means this
    // only "passes" at the earliest instant sets.length is 2 — the same
    // synchronous update that sets the marker in the first place.
    await waitFor(async () => {
      const draft = await storage.getDraft();
      expect(draft?.blocks[0]?.exercises[0]?.sets).toHaveLength(2);

      const summaries = container.querySelectorAll('.set-summary');
      const marked = container.querySelectorAll('.set-summary--new');
      expect(summaries).toHaveLength(2);
      expect(marked).toHaveLength(1);
      // The newest set is always appended last.
      expect(marked[0]).toBe(summaries[summaries.length - 1]);
    });
  });

  it('a block created via "Add block" keeps its header/controls after an exercise is added to it (FR-2 regression)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

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

  it('numbers the first explicit block "Block 1" even after a loose exercise already exists (loose-block-numbering regression)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

    // Add a loose exercise first — it renders bare, with no "Block N"
    // label of its own, but it still occupies index 0 in `draft.blocks`.
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

    // The first explicitly created block must still be numbered "Block 1"
    // — the loose container ahead of it in the array has no label and
    // must not be counted.
    await userEvent.click(screen.getByRole('button', { name: 'Add block' }));
    await waitFor(() => {
      expect(screen.getByText('Block 1')).toBeInTheDocument();
    });
    expect(screen.queryByText('Block 2')).not.toBeInTheDocument();
  });

  it('a loose block stays chrome-less even after its last exercise is deleted (empty-loose-block regression)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

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
