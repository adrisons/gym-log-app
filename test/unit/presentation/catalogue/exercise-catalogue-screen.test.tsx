import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('opens the management form in place of the tapped row, hiding its name and Manage button', async () => {
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
    expect(
      screen.queryByRole('button', { name: 'Manage Back squat' }),
    ).not.toBeInTheDocument();
    // The row's plain name text is replaced by the form's own name input.
    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/rename exercise/i)).toHaveValue('Back squat');
    // The other row is unaffected.
    expect(
      screen.getByRole('button', { name: 'Manage Bench press' }),
    ).toBeInTheDocument();
  });

  it("switching which exercise is managed shows that exercise's own data, not the previous one's (stale-form regression)", async () => {
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
      'Something else entirely',
    );
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage Bench press' }),
    );

    expect(screen.getByLabelText(/rename exercise/i)).toHaveValue(
      'Bench press',
    );
  });

  it('saves the rename and the tracked fields from the one combined form', async () => {
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
    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Barbell back squat')).toBeInTheDocument();
    });
    expect(screen.queryByText('Back squat')).not.toBeInTheDocument();

    const saved = await storage.getExercise('ex-1' as ExerciseId);
    expect(saved?.canonicalName).toBe('Barbell back squat');
    expect(saved?.trackEffort).toBe(true);
  });

  it('a merge re-syncs the logging store, not just this screen (stale-draft regression)', async () => {
    const storage = await seededStorage();
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
    // ADR-0008: opening the form no longer auto-loads a stored draft as
    // the active one — it is offered as `pendingDraft` instead. Simulate
    // the user having already recovered it (the way an earlier visit to
    // LoggingScreen before navigating here would have), so the active
    // `draft` is the one referencing `ex-1` that this regression targets.
    await useLoggingSession.getState().recoverPendingDraft();

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
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );
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
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

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

  it('deleting an exercise confirms via a popup, kept from the combined form', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage Back squat' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /delete exercise/i }),
    );

    const popup = screen.getByRole('alertdialog', {
      name: /delete back squat/i,
    });
    await userEvent.click(
      within(popup).getByRole('button', { name: /confirm delete/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText('Back squat')).not.toBeInTheDocument();
    });
  });
});

describe('ExerciseCatalogueScreen creating a new exercise (ADR-0010)', () => {
  it('opens the creation form from "New exercise", and lists the exercise once created', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }));
    expect(
      screen.getByRole('dialog', { name: /new exercise/i }),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^name$/i), 'Romanian deadlift');
    await userEvent.click(screen.getByRole('radio', { name: 'Duration' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /create exercise/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Romanian deadlift')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('dialog', { name: /new exercise/i }),
    ).not.toBeInTheDocument();

    const saved = await storage.listExercises();
    const created = saved.find((e) => e.canonicalName === 'Romanian deadlift');
    expect(created?.defaultVolumeKind).toBe('duration');
    expect(created?.trackEffort).toBe(true);

    // The logging store's own in-memory catalogue must include it too, the
    // same reason renaming/merging already re-sync it (this screen's own
    // doc comment) — otherwise LoggingScreen could offer to create a
    // duplicate.
    expect(
      useLoggingSession
        .getState()
        .catalogue.some((e) => e.canonicalName === 'Romanian deadlift'),
    ).toBe(true);
  });

  it('the Create button stays disabled until a name is entered', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    useLoggingSession.getState().configure(new InMemoryStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }));

    expect(
      screen.getByRole('button', { name: /create exercise/i }),
    ).toBeDisabled();
  });

  it('restores focus to the "New exercise" trigger when the dialog closes (Copilot review, PR #27)', async () => {
    useStorageAccess.getState().configure(await seededStorage());
    useLoggingSession.getState().configure(new InMemoryStorage());
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });
    const trigger = screen.getByRole('button', { name: 'New exercise' });
    trigger.focus();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(document.activeElement).toBe(trigger);
  });

  it('Cancel closes the form without creating anything', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }));
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Nope');
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(
      screen.queryByRole('dialog', { name: /new exercise/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Nope')).not.toBeInTheDocument();
  });

  it('blocks creating a name/alias collision with an existing exercise, naming which one (Copilot review, PR #27)', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }));
    // Case/accent-insensitive match against the existing "Back squat".
    await userEvent.type(screen.getByLabelText(/^name$/i), 'back SQUAT');

    expect(
      screen.getByRole('button', { name: /create exercise/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/already used by "Back squat"/i),
    ).toBeInTheDocument();

    const before = await storage.listExercises();
    await userEvent.click(
      screen.getByRole('button', { name: /create exercise/i }),
    );
    const after = await storage.listExercises();
    expect(after).toHaveLength(before.length);
  });

  it('disables Create while the write is in flight, so a double tap cannot create the exercise twice (Copilot review, PR #27)', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);

    let releaseSave: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const realSaveExercise = storage.saveExercise.bind(storage);
    storage.saveExercise = async (exercise) => {
      await gate;
      return realSaveExercise(exercise);
    };

    render(<ExerciseCatalogueScreen />);
    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }));
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Nordic curl');

    const createButton = screen.getByRole('button', {
      name: /create exercise/i,
    });
    await userEvent.click(createButton);
    // Still pending (the gated save hasn't resolved) — the button must
    // already be disabled, so a second tap here is a no-op rather than a
    // second `createExercise` call.
    expect(createButton).toBeDisabled();
    await userEvent.click(createButton);

    releaseSave();
    await waitFor(async () => {
      const saved = await storage.listExercises();
      expect(
        saved.filter((e) => e.canonicalName === 'Nordic curl'),
      ).toHaveLength(1);
    });
  });

  it("still creates the exercise when the logging store's catalogue cache is cold (a direct /exercises visit, no prior /log initialize())", async () => {
    // Deliberately does NOT call useLoggingSession.getState().initialize()
    // — `createExercise` doesn't depend on the cache being warm (unlike
    // the pre-fix `updateExerciseTemplate`, see the sibling describe
    // block below), but this guards the creation path against the same
    // class of regression.
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'New exercise' }));
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Sissy squat');
    await userEvent.click(
      screen.getByRole('button', { name: /create exercise/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Sissy squat')).toBeInTheDocument();
    });
  });
});

describe("ExerciseCatalogueScreen editing an existing exercise's tracked fields (ADR-0010)", () => {
  it('saves tracked-field changes from the same management form and re-syncs both storage and the logging store', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    useLoggingSession.getState().configure(storage);
    await useLoggingSession.getState().initialize();
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

    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    await waitFor(async () => {
      const saved = await storage.getExercise('ex-1' as ExerciseId);
      expect(saved?.trackEffort).toBe(true);
    });
    expect(
      useLoggingSession.getState().catalogue.find((e) => e.id === 'ex-1')
        ?.trackEffort,
    ).toBe(true);
  });

  it('still saves the template edit when the logging store has never been initialized (a direct /exercises visit — Copilot review, PR #27)', async () => {
    const storage = await seededStorage();
    useStorageAccess.getState().configure(storage);
    // Configured, like the composition root always does, but deliberately
    // never `initialize()`d — `useLoggingSession.catalogue` starts empty,
    // the exact "cold cache" this regression needs. Every other test in
    // this file's `describe` blocks calls `initialize()` first, which is
    // why this one bug went uncaught by them.
    useLoggingSession.getState().configure(storage);
    render(<ExerciseCatalogueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Back squat')).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage Back squat' }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /track effort/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /save changes/i }),
    );

    await waitFor(async () => {
      const saved = await storage.getExercise('ex-1' as ExerciseId);
      expect(saved?.trackEffort).toBe(true);
    });
    expect(
      screen.queryByRole('dialog', { name: /manage back squat/i }),
    ).not.toBeInTheDocument();
  });
});
