import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
