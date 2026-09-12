import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InsightsScreen } from '@/presentation/insights/insights-screen';
import { useStorageAccess } from '@/application/storage-access';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import { InMemoryStorage } from '../../../support';

describe('InsightsScreen (FR-001..016)', () => {
  it('shows a per-exercise progress card once enough qualifying data exists, and missing-data notices for other sections', async () => {
    const storage = new InMemoryStorage();
    const exerciseId = 'ex-squat' as ExerciseId;
    await storage.saveExercise({
      id: exerciseId,
      canonicalName: 'Squat',
      aliases: [],
      defaultLoadType: 'weight',
      unilateral: false,
      discipline: 'Strength',
    });

    const now = new Date();
    for (let week = 0; week < 6; week++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (5 - week) * 7);
      const entry: ExerciseEntry = {
        exerciseId,
        notes: '',
        sets: [
          createSet({
            volume: createVolume({ kind: 'reps', count: 5 }),
            load: createLoad({
              kind: 'weight',
              value: 80 + week * 2,
              unit: 'kg',
            }),
            setKind: 'working',
            completed: true,
          }),
        ],
      };
      await storage.saveSession(
        createSession({
          id: `s${week}` as SessionId,
          dateTime: date.toISOString(),
          notes: '',
          blocks: [createBlock({ type: 'straightSets', exercises: [entry] })],
        }),
      );
    }
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter>
        <InsightsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Squat is up/i)).toBeInTheDocument();
    });

    // Push/pull balance has nothing to show with only one untagged exercise.
    expect(
      screen.getByRole('heading', { name: /push\/pull balance/i }),
    ).toBeInTheDocument();
  });

  it('shows missing-data notices across the board with no sessions logged', async () => {
    const storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);

    render(
      <MemoryRouter>
        <InsightsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/log an exercise a few more times/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/log sessions across at least 4 weeks/i),
    ).toBeInTheDocument();
  });
});
