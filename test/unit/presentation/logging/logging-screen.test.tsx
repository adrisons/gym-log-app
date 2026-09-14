import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { LoggingScreen } from '@/presentation/logging/logging-screen';
import { useLoggingSession } from '@/application/logging/logging-store';
import type { ExerciseId } from '@/domain/ids';
import { InMemoryStorage } from '../../../support';

function renderAtLog() {
  return render(
    <MemoryRouter initialEntries={['/log']}>
      <Routes>
        <Route path="/log" element={<LoggingScreen />} />
        <Route path="/diary" element={<div>Diary screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

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

  it('opens with one default block (Block 1) already present, ready to add exercises to (ADR-0011)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Block 1')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete block/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add exercise to Block 1' }),
    ).toBeInTheDocument();
    // No separate top-level "Add exercise" control any more — every
    // exercise goes through a block's own footer control.
    expect(
      screen.queryByRole('button', { name: 'Add exercise' }),
    ).not.toBeInTheDocument();
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
        screen.getByRole('button', { name: 'Add exercise to Block 1' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 1' }),
    );

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

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '60',
    );
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await userEvent.click(screen.getByRole('button', { name: 'Add set' }));

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
        screen.getByRole('button', { name: 'Add exercise to Block 1' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 1' }),
    );
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

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /weight/i }),
      '60',
    );
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}'.repeat(5));
    await userEvent.click(screen.getByRole('button', { name: 'Add set' }));
    await waitFor(async () => {
      const draft = await storage.getDraft();
      expect(draft?.blocks[0]?.exercises[0]?.sets).toHaveLength(1);
    });

    // Confirming the first set collapsed the form to a "+ Add set" button
    // (ADR-0010) — a fresh SetRow mounts once it's reopened, pre-filled
    // from the previous set (FR-008). One further edit (a different rep
    // count, so FR-025's identical-within-1s debounce doesn't treat this
    // as a repeat of the same commit) plus Confirm logs this second set,
    // which must move the animation marker to it instead of leaving (or
    // also adding) it on the first.
    await userEvent.click(screen.getByRole('button', { name: 'Add set' }));
    await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(screen.getByRole('button', { name: 'Add set' }));
    // One `waitFor`, not two: the animation marker is intentionally
    // consumed once the marked row's own entrance animation ends (or
    // immediately under reduced motion), so asserting the DOM in a
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

  it('"Add block" appends a second, independent block (Block 2) alongside the default Block 1', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Block 1')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add block' }));

    await waitFor(() => {
      expect(screen.getByText('Block 2')).toBeInTheDocument();
    });
    // Still unnamed, still explicitly created: FR-2 requires it to show
    // its position label and stay renameable/deletable.
    expect(
      screen.getAllByRole('button', { name: /rename/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: /delete block/i }).length,
    ).toBeGreaterThan(0);

    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 2' }),
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
    expect(screen.getByText('Block 2')).toBeInTheDocument();
  });

  it('the default block (Block 1) keeps its header/controls even after its only exercise is deleted (ADR-0011: no more chrome-less/"loose" rendering)', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    render(
      <MemoryRouter>
        <LoggingScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add exercise to Block 1' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 1' }),
    );
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
    expect(screen.getByText('Block 1')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Lat pulldown actions' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete exercise' }),
    );

    // Now empty, but still a real block: Block 1 and its rename/delete
    // controls stay visible, unlike the old "loose" container.
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Lat pulldown' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Block 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^rename$/i }),
    ).toBeInTheDocument();
  });
});

describe('LoggingScreen "Log workout" (FR-027; ADR-0008, ADR-0011, ADR-0012)', () => {
  it('stays visible but disabled while the active draft has no exercise (an empty default block is not content), and enables once one is added', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    renderAtLog();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add exercise to Block 1' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Log workout' })).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 1' }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Back squat',
    );
    await userEvent.click(screen.getByText('Create "Back squat"'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log workout' })).toBeEnabled();
    });
  });

  it('registers the workout, clears the stored draft, and navigates to the diary', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    renderAtLog();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add exercise to Block 1' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 1' }),
    );
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

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Log workout' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Log workout' }));

    await waitFor(() => {
      expect(screen.getByText('Diary screen')).toBeInTheDocument();
    });
    expect(await storage.getDraft()).toBeUndefined();
    const sessions = await storage.listSessions({
      from: '2000-01-01',
      to: '2100-01-01',
    });
    expect(sessions).toHaveLength(1);
  });
});

describe('LoggingScreen pending-draft recovery banner (FR-024, FR-028; ADR-0008, ADR-0011)', () => {
  it('offers Recover/Discard for a stored draft, blocks new content until resolved, and Recover fills the form', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('Legs', 'straightSets');
    // An empty block alone is not content worth persisting (ADR-0011) —
    // add an exercise too, so this draft actually gets offered back.
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    // Re-initialize (as a fresh mount of this screen would) so the block
    // just added is offered back as a pending draft rather than active.
    await useLoggingSession.getState().initialize();

    renderAtLog();

    await waitFor(() => {
      expect(
        screen.getByText(/unregistered workout from a previous visit/i),
      ).toBeInTheDocument();
    });
    // The active (fresh) draft's own default block still renders, but its
    // "Add exercise" control must stay unavailable while unresolved.
    expect(
      screen.queryByRole('button', { name: /add exercise to/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add block' }),
    ).not.toBeInTheDocument();
    // ADR-0012: "Log workout" itself stays visible, never hidden, but is
    // disabled while the recovery banner is unresolved.
    expect(screen.getByRole('button', { name: 'Log workout' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Recover' }));

    await waitFor(() => {
      expect(screen.getByText('Legs')).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/unregistered workout from a previous visit/i),
    ).not.toBeInTheDocument();
  });

  it('Discard removes the stored draft and leaves the active form empty', async () => {
    const storage = new InMemoryStorage();
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addBlock('Legs', 'straightSets');
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    await useLoggingSession.getState().initialize();

    renderAtLog();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Discard' }),
      ).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(
        screen.queryByText(/unregistered workout from a previous visit/i),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Legs')).not.toBeInTheDocument();
    expect(await storage.getDraft()).toBeUndefined();
  });
});
