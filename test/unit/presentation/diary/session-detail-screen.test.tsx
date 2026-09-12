import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionDetailScreen } from '@/presentation/diary/session-detail-screen';
import { useStorageAccess } from '@/application/storage-access';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { ExerciseId, SessionId } from '@/domain/ids';
import { InMemoryStorage } from '../../../support';

describe('SessionDetailScreen (FR-004/005)', () => {
  it('renders a session’s blocks/exercises/sets and persists a set deletion via saveSession', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    const sessionId = 's1' as SessionId;
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
        id: sessionId,
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
      <MemoryRouter initialEntries={[`/diary/${sessionId}`]}>
        <Routes>
          <Route path="/diary/:sessionId" element={<SessionDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Squat' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('100 kg')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Delete set'));

    await waitFor(async () => {
      const saved = await storage.getSession(sessionId);
      expect(saved?.blocks[0]?.exercises[0]?.sets).toHaveLength(0);
    });
  });

  it('adding an exercise via the bottom control creates and persists a new block when the last block is named', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    const sessionId = 's1' as SessionId;
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
        id: sessionId,
        dateTime: '2026-09-11T10:00:00.000Z',
        notes: '',
        blocks: [
          createBlock({
            type: 'straightSets',
            name: 'Push day',
            exercises: [
              {
                exerciseId,
                notes: '',
                sets: [],
              },
            ],
          }),
        ],
      }),
    );
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter initialEntries={[`/diary/${sessionId}`]}>
        <Routes>
          <Route path="/diary/:sessionId" element={<SessionDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Squat' }),
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

    await waitFor(async () => {
      const saved = await storage.getSession(sessionId);
      const exerciseIds = saved?.blocks.flatMap((block) =>
        block.exercises.map((entry) => entry.exerciseId),
      );
      expect(exerciseIds).toHaveLength(2);
    });
  });

  it('an edit made while an exercise is being created is not lost when that creation resolves (stale-closure regression)', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    const sessionId = 's1' as SessionId;
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
        id: sessionId,
        dateTime: '2026-09-11T10:00:00.000Z',
        notes: '',
        blocks: [
          createBlock({
            type: 'straightSets',
            name: 'Push day',
            exercises: [{ exerciseId, notes: '', sets: [] }],
          }),
        ],
      }),
    );
    useStorageAccess.getState().configure(storage);

    // Gate `saveExercise` so the component's `await createExercise(...)`
    // stays pending until this test explicitly releases it — the window
    // in which another edit (below) can land first.
    let releaseSave: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const realSaveExercise = storage.saveExercise.bind(storage);
    storage.saveExercise = async (exercise) => {
      await gate;
      return realSaveExercise(exercise);
    };

    render(
      <MemoryRouter initialEntries={[`/diary/${sessionId}`]}>
        <Routes>
          <Route path="/diary/:sessionId" element={<SessionDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Squat' }),
      ).toBeInTheDocument();
    });

    // Start creating "Deadlift" — this awaits the gated `saveExercise` and
    // will not resolve until `releaseSave()` is called below.
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Deadlift',
    );
    await userEvent.click(screen.getByText('Create "Deadlift"'));

    // While that create is still pending, make a second, independent edit
    // whose effect a stale closure would silently undo: deleting the
    // existing "Push day" block. A stale-closure regression would rebuild
    // its own `next` from the pre-delete snapshot it captured before the
    // await, resurrecting "Push day" once it finally persists — a count
    // -only assertion (e.g. "2 blocks") can't tell that apart from the
    // correct outcome, since both happen to end up with the same number
    // of blocks; asserting Push day is actually gone can.
    await userEvent.click(screen.getByRole('button', { name: 'Delete block' }));

    releaseSave();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Deadlift' }),
      ).toBeInTheDocument();
    });

    await waitFor(async () => {
      const saved = await storage.getSession(sessionId);
      // The delete survived: "Push day" never comes back.
      expect(saved?.blocks.some((b) => b.name === 'Push day')).toBe(false);
      // The create also survived: Deadlift is recorded somewhere.
      const catalogue = await storage.listExercises();
      const deadliftId = catalogue.find(
        (e) => e.canonicalName === 'Deadlift',
      )?.id;
      expect(deadliftId).toBeDefined();
      const exerciseIds = saved?.blocks.flatMap((block) =>
        block.exercises.map((entry) => entry.exerciseId),
      );
      expect(exerciseIds).toContain(deadliftId);
    });
  });
});
