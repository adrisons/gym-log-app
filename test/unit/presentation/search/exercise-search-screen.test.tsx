import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ExerciseSearchScreen } from '@/presentation/search/exercise-search-screen';
import { useStorageAccess } from '@/application/storage-access';
import type { ExerciseId } from '@/domain/ids';
import { InMemoryStorage } from '../../../support';

describe('ExerciseSearchScreen (FR-007..012)', () => {
  async function seededStorage() {
    const storage = new InMemoryStorage();
    await storage.saveExercise({
      id: 'ex-1' as ExerciseId,
      canonicalName: 'Sentadilla',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });
    return storage;
  }

  it('filters results as the user types, tolerating a typo', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    render(
      <MemoryRouter>
        <ExerciseSearchScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by name/i),
      ).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search by name/i),
      'sentadila',
    );

    await waitFor(() => {
      expect(screen.getByText('Sentadilla')).toBeInTheDocument();
    });
  });

  it('shows an explicit empty state for a query matching nothing', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    render(
      <MemoryRouter>
        <ExerciseSearchScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by name/i),
      ).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search by name/i),
      'zzz-no-match-zzz',
    );

    await waitFor(() => {
      expect(screen.getByText(/no exercises match/i)).toBeInTheDocument();
    });
  });
});
