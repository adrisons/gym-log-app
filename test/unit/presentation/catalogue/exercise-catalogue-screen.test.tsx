import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseCatalogueScreen } from '@/presentation/catalogue/exercise-catalogue-screen';
import { useStorageAccess } from '@/application/storage-access';
import { useLoggingSession } from '@/application/logging/logging-store';
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

  it('names what is missing when a filter matches nothing (empty-state regression)', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByPlaceholderText(/search the catalogue/i),
      'nonexistent exercise',
    );

    expect(
      screen.getByText(/no exercises match .nonexistent exercise.\./i),
    ).toBeInTheDocument();
  });

  it('names what is missing when the catalogue itself is empty (empty-state regression)', async () => {
    useStorageAccess.getState().configure(new InMemoryStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('No exercises in your catalogue yet.'),
      ).toBeInTheDocument();
    });
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
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    // Rename is routed through the logging store's own action (matching
    // the composition root's real setup, where both stores share one
    // storage instance) — see the stale-catalogue regression test below.
    useLoggingSession.getState().configure(storage);
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

  it('a merge re-syncs the logging store, not just this screen (stale-draft regression)', async () => {
    const storage = await seededStorage();
    // `lastEditedAt` must be "now" (today) — `openLoggingForm` (called by
    // the logging store's own `initialize()` below) promotes any draft
    // from an earlier calendar day into a Session and replaces it with a
    // brand-new empty draft, which would defeat this test's setup.
    const now = new Date().toISOString();
    await storage.saveDraft({
      id: 'draft-1',
      dateTime: now,
      notes: '',
      lastEditedAt: now,
      blocks: [
        {
          id: 'block-1',
          type: 'straightSets',
          exercises: [
            {
              id: 'entry-1',
              exerciseId: 'ex-1' as ExerciseId,
              notes: '',
              sets: [],
            },
          ],
        },
      ],
    });
    useStorageAccess.getState().configure(storage);
    // Configured exactly like the composition root does (main.tsx) — both
    // stores share the same storage instance, and the logging session is
    // "already initialized" the way it would be from an earlier visit to
    // LoggingScreen before navigating here.
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    // Renaming "Back squat" to the existing "Bench press" name triggers
    // the collision-merge offer; confirming merges Back squat (ex-1) into
    // Bench press (ex-2).
    await userEvent.click(
      screen.getByRole('button', { name: 'Manage Back squat' }),
    );
    await userEvent.clear(screen.getByLabelText(/rename exercise/i));
    await userEvent.type(
      screen.getByLabelText(/rename exercise/i),
      'Bench press',
    );
    await userEvent.click(screen.getByRole('button', { name: /save name/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /merge \(not undoable\)/i }),
    );

    await waitFor(() => {
      const catalogue = useLoggingSession.getState().catalogue;
      expect(catalogue.some((e) => e.id === 'ex-1')).toBe(false);
    });
    // The logging store's own in-memory draft — not just underlying
    // storage — must be repointed off the merged-away exercise too, or a
    // quick edit on LoggingScreen right after this merge would save the
    // stale draft back and resurrect the reference to `ex-1`.
    const draft = useLoggingSession.getState().draft;
    const exerciseIds = draft?.blocks.flatMap((block) =>
      block.exercises.map((entry) => entry.exerciseId),
    );
    expect(exerciseIds).not.toContain('ex-1');
    expect(exerciseIds).toContain('ex-2');
  });

  it('a rename re-syncs the logging store, not just this screen (stale-catalogue regression)', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    // Same setup as the merge regression above — the logging session is
    // "already initialized" the way it would be from an earlier visit to
    // LoggingScreen before navigating here.
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();

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

    // The logging store's own in-memory catalogue — not just underlying
    // storage — must reflect the rename too, or returning to LoggingScreen
    // would render the old name until its next initialize() and could
    // offer to create a duplicate under the new name in the meantime.
    const catalogue = useLoggingSession.getState().catalogue;
    const renamed = catalogue.find((e) => e.id === 'ex-1');
    expect(renamed?.canonicalName).toBe('Barbell back squat');
  });
});
