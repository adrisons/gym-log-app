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

      const links = screen.getAllByRole('link', { name: /squat/i });
      fireEvent.mouseDown(links[0]!);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.mouseUp(links[0]!);
      fireEvent.click(links[0]!);

      expect(
        screen.getByRole('toolbar', { name: /selected sessions/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/1 session selected/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /log session/i }),
      ).not.toBeInTheDocument();

      // A normal (short) tap on the other row toggles it into the selection.
      fireEvent.click(screen.getAllByRole('link', { name: /squat/i })[1]!);
      expect(screen.getByText(/2 sessions selected/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('"Select sessions" arms bulk-select without a long press, for keyboard/screen-reader use', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /select sessions/i }));

    expect(
      screen.getByRole('toolbar', { name: /selected sessions/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 sessions selected/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /log session/i }),
    ).not.toBeInTheDocument();

    // A plain click on the row (the same event a native <a>'s Enter/Space
    // keypress dispatches) toggles it now that selection mode is active.
    fireEvent.click(screen.getByRole('link', { name: /squat/i }));
    expect(screen.getByText(/1 session selected/i)).toBeInTheDocument();
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
      fireEvent.mouseDown(link);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.mouseUp(link);
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
});
