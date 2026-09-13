import { describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiaryScreen } from '@/presentation/diary/diary-screen';
import { useStorageAccess } from '@/application/storage-access';
import { useLoggingSession } from '@/application/logging/logging-store';
import { REWARD_ANIMATION_MS } from '@/presentation/design/tokens';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { ExerciseId, SessionId } from '@/domain/ids';
import { InMemoryStorage } from '../../../support';

async function seedSession(
  storage: InMemoryStorage,
  id: string,
  dateTime: string,
  exerciseId: ExerciseId,
) {
  await storage.saveSession(
    createSession({
      id: id as SessionId,
      dateTime,
      notes: '',
      blocks: [
        createBlock({
          type: 'straightSets',
          exercises: [
            {
              exerciseId,
              notes: '',
              sets: [
                createSet({
                  volume: createVolume({ kind: 'reps', count: 5 }),
                  load: createLoad({ kind: 'weight', value: 100, unit: 'kg' }),
                  setKind: 'working',
                  completed: true,
                }),
              ],
            },
          ],
        }),
      ],
    }),
  );
}

describe('DiaryScreen (FR-001..006)', () => {
  it('shows the empty state when no sessions have been logged', async () => {
    const storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
    render(
      <MemoryRouter>
        <DiaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no sessions logged yet/i)).toBeInTheDocument();
    });
  });

  it('renders sessions grouped by month with a one-line summary', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await storage.saveSession(
      createSession({
        id: 's1' as SessionId,
        dateTime: '2026-09-11T10:00:00.000Z',
        notes: '',
        blocks: [
          createBlock({
            type: 'straightSets',
            exercises: [
              {
                exerciseId,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({
                      kind: 'weight',
                      value: 100,
                      unit: 'kg',
                    }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          }),
        ],
      }),
    );
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter>
        <DiaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Squat')).toBeInTheDocument();
    });
    expect(screen.getByText('1 sets')).toBeInTheDocument();
    expect(screen.getByText('2026-09')).toBeInTheDocument();
  });

  it('shows a "Log session" floating action linking to /log, not a persistent nav tab (FR-1)', async () => {
    const storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
    render(
      <MemoryRouter>
        <DiaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no sessions logged yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /log session/i })).toHaveAttribute(
      'href',
      '/log',
    );
  });

  it('a sustained press selects a session, enters bulk-select, and a normal tap toggles another row (FR-6)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await seedSession(storage, 's1', '2026-09-11T10:00:00.000Z', exerciseId);
    await seedSession(storage, 's2', '2026-09-10T10:00:00.000Z', exerciseId);
    useStorageAccess.getState().configure(storage);

    vi.useFakeTimers();
    try {
      render(
        <MemoryRouter>
          <DiaryScreen />
        </MemoryRouter>,
      );

      await vi.waitFor(() => {
        expect(screen.getAllByRole('link', { name: /squat/i })).toHaveLength(2);
      });

      // Captured before bulk-select activates: the row swaps to
      // `role="button"` once selection mode is active, so a role query
      // after that point would no longer find it as a "link".
      const links = screen.getAllByRole('link', { name: /squat/i });
      fireEvent.pointerDown(links[0]!);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.pointerUp(links[0]!);
      fireEvent.click(links[0]!);

      expect(
        screen.getByRole('toolbar', { name: /selected sessions/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/1 session selected/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /log session/i }),
      ).not.toBeInTheDocument();

      // A normal (short) tap on the other row toggles it into the selection.
      fireEvent.click(links[1]!);
      expect(screen.getByText(/2 sessions selected/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("tapping a row's own icon arms bulk-select and selects that row in one tap (ADR-0009, Gmail pattern)", async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await seedSession(storage, 's1', '2026-09-11T10:00:00.000Z', exerciseId);
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter>
        <DiaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /squat/i })).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('toolbar', { name: /selected sessions/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^select session/i }));

    expect(
      screen.getByRole('toolbar', { name: /selected sessions/i }),
    ).toBeInTheDocument();
    // Unlike a separate "arm with nothing selected" control, tapping the
    // icon both enters selection mode and selects that row in one action.
    expect(screen.getByText(/1 session selected/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /log session/i }),
    ).not.toBeInTheDocument();

    // Tapping the same icon again deselects it — the last row deselected
    // exits selection mode automatically.
    fireEvent.click(screen.getByRole('button', { name: /^deselect session/i }));
    expect(
      screen.queryByRole('toolbar', { name: /selected sessions/i }),
    ).not.toBeInTheDocument();
  });

  it('deleting a selection removes it and Undo restores it exactly (FR-6, FR-004)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await seedSession(storage, 's1', '2026-09-11T10:00:00.000Z', exerciseId);
    useStorageAccess.getState().configure(storage);

    vi.useFakeTimers();
    try {
      render(
        <MemoryRouter>
          <DiaryScreen />
        </MemoryRouter>,
      );

      await vi.waitFor(() => {
        expect(
          screen.getByRole('link', { name: /squat/i }),
        ).toBeInTheDocument();
      });

      const link = screen.getByRole('link', { name: /squat/i });
      fireEvent.pointerDown(link);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.pointerUp(link);
      fireEvent.click(link);

      fireEvent.click(screen.getByRole('button', { name: /delete/i }));

      await vi.waitFor(() => {
        expect(
          screen.queryByRole('link', { name: /squat/i }),
        ).not.toBeInTheDocument();
      });
      expect(
        await storage.listSessions({
          from: '0000-01-01T00:00:00.000Z',
          to: '9999-12-31T23:59:59.999Z',
        }),
      ).toHaveLength(0);
      expect(screen.getByText(/1 session deleted/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));

      await vi.waitFor(() => {
        expect(
          screen.getByRole('link', { name: /squat/i }),
        ).toBeInTheDocument();
      });
      expect(
        await storage.listSessions({
          from: '0000-01-01T00:00:00.000Z',
          to: '9999-12-31T23:59:59.999Z',
        }),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a press that moves past the scroll threshold cancels the long press instead of selecting the row (scroll-vs-select regression)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await seedSession(storage, 's1', '2026-09-11T10:00:00.000Z', exerciseId);
    useStorageAccess.getState().configure(storage);

    vi.useFakeTimers();
    try {
      render(
        <MemoryRouter>
          <DiaryScreen />
        </MemoryRouter>,
      );

      let link: HTMLElement;
      await vi.waitFor(() => {
        link = screen.getByRole('link', { name: /squat/i });
        expect(link).toBeInTheDocument();
      });

      fireEvent.pointerDown(link!, { clientX: 0, clientY: 0 });
      fireEvent.pointerMove(link!, { clientX: 0, clientY: 40 });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.pointerUp(link!);
      fireEvent.click(link!);

      expect(
        screen.queryByRole('toolbar', { name: /selected sessions/i }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('exposes an unselected row as a pressed toggle button, not a link, once another row armed selection mode (accessible-selection-state regression)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await seedSession(storage, 's1', '2026-09-11T10:00:00.000Z', exerciseId);
    await seedSession(storage, 's2', '2026-09-10T10:00:00.000Z', exerciseId);
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter>
        <DiaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /squat/i })).toHaveLength(2);
    });

    // Arming via s1's own icon both enters selection mode and selects it.
    const [selectIcon1] = screen.getAllByRole('button', {
      name: /^select session/i,
    });
    fireEvent.click(selectIcon1!);

    expect(screen.queryByRole('link', { name: /squat/i })).toBeNull();
    const [toggle1, toggle2] = screen.getAllByRole('button', {
      name: /squat/i,
    });
    expect(toggle1).toHaveAttribute('aria-pressed', 'true');
    expect(toggle2).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle2!);
    expect(toggle2).toHaveAttribute('aria-pressed', 'true');
  });

  it('Space toggles a focused row while selection mode is active (native <a> dispatches click for Enter but not Space)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await seedSession(storage, 's1', '2026-09-11T10:00:00.000Z', exerciseId);
    await seedSession(storage, 's2', '2026-09-10T10:00:00.000Z', exerciseId);
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter>
        <DiaryScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /squat/i })).toHaveLength(2);
    });

    const [selectIcon1] = screen.getAllByRole('button', {
      name: /^select session/i,
    });
    fireEvent.click(selectIcon1!);
    expect(screen.getByText(/1 session selected/i)).toBeInTheDocument();

    const [, toggle2] = screen.getAllByRole('button', { name: /squat/i });
    fireEvent.keyDown(toggle2!, { key: ' ' });

    expect(screen.getByText(/2 sessions selected/i)).toBeInTheDocument();
  });

  it('shows the save-acknowledgement toast once when justLoggedASet is set, and clears it so a remount does not replay it (ADR/design.md §1.1 regression)', async () => {
    const storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
    await useLoggingSession.getState().addExerciseEntry('ex-1' as ExerciseId);
    const entryId =
      useLoggingSession.getState().draft!.blocks[0]!.exercises[0]!.id;
    await useLoggingSession.getState().addSet(entryId, {
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'none' },
      setKind: 'working',
    });
    expect(useLoggingSession.getState().justLoggedASet).toBe(true);

    vi.useFakeTimers();
    let unmount: () => void;
    try {
      ({ unmount } = render(
        <MemoryRouter>
          <DiaryScreen />
        </MemoryRouter>,
      ));

      await vi.waitFor(() => {
        expect(screen.getByText(/session saved/i)).toBeInTheDocument();
      });

      // The toast clears the flag only once it actually self-dismisses
      // (`onDismiss`), not the instant it renders — a debounced commit
      // (ADR-0007) can still be pending when this screen first mounts, so
      // the flag must stay reactive/live for as long as the toast itself
      // could plausibly still appear.
      expect(useLoggingSession.getState().justLoggedASet).toBe(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(REWARD_ANIMATION_MS);
      });
      // Consumed once — the store no longer thinks a fresh visit just
      // recorded a set, so a later remount of this same route won't
      // replay the toast for a visit that never happened.
      expect(useLoggingSession.getState().justLoggedASet).toBe(false);
    } finally {
      vi.useRealTimers();
    }
    unmount!();

    render(
      <MemoryRouter>
        <DiaryScreen />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/no sessions logged yet/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/session saved/i)).not.toBeInTheDocument();
  });
});
