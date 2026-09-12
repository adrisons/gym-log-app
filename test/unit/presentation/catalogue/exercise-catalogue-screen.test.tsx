import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseCatalogueScreen } from '@/presentation/catalogue/exercise-catalogue-screen';
import { useStorageAccess } from '@/application/storage-access';
import type { ExerciseId } from '@/domain/ids';
import { InMemoryStorage } from '../../../support';

async function seededStorage() {
  const storage = new InMemoryStorage();
  await storage.saveExercise({
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  });
  await storage.saveExercise({
    id: 'ex-2' as ExerciseId,
    canonicalName: 'Bench press',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  });
  return storage;
}

describe('ExerciseCatalogueScreen (FR-5, FR-017..022)', () => {
  it('loads and lists every catalogue exercise', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });
    expect(screen.getByText('Bench press')).toBeInTheDocument();
  });

  it('filters the list as the user types', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search the catalogue/i),
      'bench',
    );

    expect(screen.getByText('Bench press')).toBeInTheDocument();
    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
  });

  it('opens the management panel for the tapped exercise', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage Back squat' }),
    );

    expect(
      screen.getByRole('dialog', { name: /manage back squat/i }),
    ).toBeInTheDocument();
  });

  it('refreshes the list to show the new name after a successful rename', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage Back squat' }),
    );
    await userEvent.clear(screen.getByLabelText(/rename exercise/i));
    await userEvent.type(
      screen.getByLabelText(/rename exercise/i),
      'Barbell back squat',
    );
    await userEvent.click(screen.getByRole('button', { name: /save name/i }));

    await waitFor(() => {
      expect(screen.getByText('Barbell back squat')).toBeInTheDocument();
    });
    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
  });
});
