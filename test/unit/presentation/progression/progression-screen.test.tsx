import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgressionScreen } from '@/presentation/progression/progression-screen';
import { useStorageAccess } from '@/application/storage-access';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { ExerciseId, SessionId } from '@/domain/ids';
import { InMemoryStorage } from '../../../support';

function weightSession(
  id: string,
  dateTime: string,
  exerciseId: ExerciseId,
  kg: number,
) {
  return createSession({
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
                load: createLoad({ kind: 'weight', value: kg, unit: 'kg' }),
                setKind: 'working',
                completed: true,
              }),
            ],
          },
        ],
      }),
    ],
  });
}

describe('ProgressionScreen (FR-013..023)', () => {
  it('renders one list row per session and the exercise name as heading', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-1' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Bench Press',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await storage.saveSession(
      weightSession('s1', '2026-01-01T10:00:00.000Z', exerciseId, 80),
    );
    await storage.saveSession(
      weightSession('s2', '2026-02-01T10:00:00.000Z', exerciseId, 90),
    );
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter initialEntries={[`/exercises/${exerciseId}/progression`]}>
        <Routes>
          <Route
            path="/exercises/:exerciseId/progression"
            element={<ProgressionScreen />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Bench Press' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('90 kg')).toBeInTheDocument();
    expect(screen.getByText('80 kg')).toBeInTheDocument();
  });

  it('shows the FR-021 explanation and no e1RM option for a Band/FreeText-only exercise', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-2' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Band pull-apart',
      aliases: [],
      defaultLoadType: 'band',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    await storage.saveSession(
      createSession({
        id: 's3' as SessionId,
        dateTime: '2026-01-01T10:00:00.000Z',
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
                    volume: createVolume({ kind: 'reps', count: 15 }),
                    load: createLoad({ kind: 'band', label: 'red' }),
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
      <MemoryRouter initialEntries={[`/exercises/${exerciseId}/progression`]}>
        <Routes>
          <Route
            path="/exercises/:exerciseId/progression"
            element={<ProgressionScreen />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/estimated 1rm is not shown/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('option', { name: 'Estimated 1RM' }),
    ).not.toBeInTheDocument();
  });
});
