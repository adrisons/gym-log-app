import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionDetailScreen } from '@/presentation/diary/session-detail-screen';
import { useStorageAccess } from '@/application/storage-access';
import { useLoggingSession } from '@/application/logging/logging-store';
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
    useLoggingSession.getState().configure(storage);

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
    useLoggingSession.getState().configure(storage);

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

  it('a save that fails does not permanently block later saves from persisting (queue-recovery regression)', async () => {
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
            exercises: [{ exerciseId, notes: '', sets: [] }],
          }),
        ],
      }),
    );
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);

    // The first save this screen attempts (triggered by the "Add exercise"
    // edit below) rejects, simulating a transient storage failure (e.g. a
    // lost File System Access permission). Every save after that succeeds.
    let nextSaveShouldFail = true;
    const realSaveSession = storage.saveSession.bind(storage);
    storage.saveSession = async (session) => {
      if (nextSaveShouldFail) {
        nextSaveShouldFail = false;
        throw new Error('simulated transient save failure');
      }
      return realSaveSession(session);
    };
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

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

    // First edit: its save is the one rejected above.
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Deadlift',
    );
    await userEvent.click(screen.getByText('Create "Deadlift"'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save session',
        expect.any(Error),
      );
    });

    // Second edit, after the first save's rejection: a broken queue would
    // never call `saveSession` again from this point on, so this edit
    // would silently never persist.
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.type(
      screen.getByPlaceholderText(/search or create an exercise/i),
      'Bench press',
    );
    await userEvent.click(screen.getByText('Create "Bench press"'));

    await waitFor(async () => {
      const saved = await storage.getSession(sessionId);
      const catalogue = await storage.listExercises();
      const benchPressId = catalogue.find(
        (e) => e.canonicalName === 'Bench press',
      )?.id;
      expect(benchPressId).toBeDefined();
      const exerciseIds = saved?.blocks.flatMap((block) =>
        block.exercises.map((entry) => entry.exerciseId),
      );
      expect(exerciseIds).toContain(benchPressId);
    });

    consoleErrorSpy.mockRestore();
  });

  it('a block created via "Add block" keeps its header/controls after an exercise is added to it (FR-2 regression)', async () => {
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
    useLoggingSession.getState().configure(storage);

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

    await userEvent.click(screen.getByRole('button', { name: 'Add block' }));

    // Still unnamed, still explicitly created: FR-2 requires it to show
    // its position label and stay renameable/deletable — never collapse
    // to "bare" (chrome-less) rendering just because it has no name yet.
    await waitFor(() => {
      expect(screen.getByText('Block 2')).toBeInTheDocument();
    });
    expect(
      screen.getAllByRole('button', { name: /rename/i }).length,
    ).toBeGreaterThan(0);

    await userEvent.click(
      screen.getByRole('button', { name: 'Add exercise to Block 2' }),
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

    // The block this exercise landed in must still be a real block, not
    // a bare/chrome-less one, even though it's unnamed and now non-empty.
    expect(screen.getByText('Block 2')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /rename/i }).length,
    ).toBeGreaterThan(0);
  });

  it('numbers the first explicit block "Block 1" even after a loose exercise already exists (loose-block-numbering regression)', async () => {
    const storage = new InMemoryStorage();
    const sessionId = 's1' as SessionId;
    await storage.saveSession(
      createSession({
        id: sessionId,
        dateTime: '2026-09-11T10:00:00.000Z',
        notes: '',
        blocks: [],
      }),
    );
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);

    render(
      <MemoryRouter initialEntries={[`/diary/${sessionId}`]}>
        <Routes>
          <Route path="/diary/:sessionId" element={<SessionDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add exercise' }),
      ).toBeInTheDocument();
    });

    // Adding an exercise with no explicit block first creates a `loose`
    // container at index 0 — it renders bare, with no "Block N" label.
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
    useLoggingSession.getState().configure(storage);

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

    // Top-level "Add exercise" (not a per-block footer): the trailing
    // block is named ("Push day"), so this creates a fresh loose block.
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
    // Loose block: no "Block 2" header for it.
    expect(screen.queryByText('Block 2')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Lat pulldown actions' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete exercise' }),
    );

    // Now empty, but still loose: must stay invisible, not suddenly gain
    // a "Block 2" header with rename/delete controls.
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Lat pulldown' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Block 2')).not.toBeInTheDocument();
  });

  it('saving an exercise template re-syncs the logging store, not just this screen (stale-template regression)', async () => {
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
    // Same setup as the composition root (main.tsx) — both stores share
    // the same storage instance, and the logging session is "already
    // initialized" the way it would be from an earlier visit to
    // LoggingScreen before navigating here.
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

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

    await userEvent.click(
      screen.getByRole('button', { name: 'Squat actions' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /edit tracked fields/i }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    // The logging store's own in-memory catalogue — not just underlying
    // storage — must reflect the template change too, or returning to
    // LoggingScreen would render the old template (and its set-entry
    // controls) until its next initialize().
    await waitFor(() => {
      const catalogue = useLoggingSession.getState().catalogue;
      const updated = catalogue.find((e) => e.id === exerciseId);
      expect(updated?.trackEffort).toBe(true);
    });
  });

  it('keeps the template editor open and the old template applied when the storage write fails (failed-template-save regression)', async () => {
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
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

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

    storage.saveExercise = vi.fn().mockRejectedValue(new Error('disk full'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await userEvent.click(
      screen.getByRole('button', { name: 'Squat actions' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /edit tracked fields/i }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    // A rejected write must never close the editor or apply the
    // never-persisted template — the prior (optimistic-then-close)
    // behavior left this screen recording new sets under a template that
    // silently reverted on the next reload, with no way to retry.
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });
    expect(
      screen.getByRole('dialog', { name: /edit squat's tracked fields/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /track effort/i }),
    ).toBeChecked();

    consoleError.mockRestore();
  });

  it('creating an exercise re-syncs the logging store, not just this screen (stale-catalogue regression)', async () => {
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
    // Same setup as the composition root (main.tsx) — both stores share
    // the same storage instance, and the logging session is "already
    // initialized" the way it would be from an earlier visit to
    // LoggingScreen before navigating here.
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

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

    // The logging store's own in-memory catalogue — not just underlying
    // storage — must include the new exercise too, or returning to
    // LoggingScreen would search a stale catalogue that's missing it
    // (and could offer to create a duplicate).
    const catalogue = useLoggingSession.getState().catalogue;
    expect(catalogue.some((e) => e.canonicalName === 'Deadlift')).toBe(true);
  });
});
