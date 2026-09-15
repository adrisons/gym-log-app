import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportFlow } from '@/presentation/settings/import-flow';
import { useStorageAccess } from '@/application/storage-access';
import { useFileExchangeAccess } from '@/application/file-exchange-access';
import { buildExportFile } from '@/application/data-transfer/export-file';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';
import { InMemoryStorage, InMemoryFileExchange } from '../../../support';

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
    ...overrides,
  };
}

describe('ImportFlow (spec 006 FR-010/011)', () => {
  let storage: InMemoryStorage;
  let fileExchange: InMemoryFileExchange;

  beforeEach(() => {
    storage = new InMemoryStorage();
    fileExchange = new InMemoryFileExchange();
    useStorageAccess.getState().configure(storage);
    useFileExchangeAccess.getState().configure(fileExchange);
  });

  it('shows a rejection message and no preview for an invalid file', async () => {
    fileExchange.setNextPick({ name: 'bad.json', content: '{not json' });
    const user = userEvent.setup();
    render(<ImportFlow />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/to add/)).not.toBeInTheDocument();
  });

  it('shows accurate add/replace counts for a valid file, and calls importBulk only on Confirm', async () => {
    const exercise = makeExercise();
    const file = buildExportFile({
      sessions: [],
      exercises: [exercise],
      bandLabels: [],
      settings: undefined,
      loggingDraft: undefined,
    });
    fileExchange.setNextPick({
      name: 'export.json',
      content: JSON.stringify(file),
    });
    const user = userEvent.setup();
    render(<ImportFlow />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));

    await waitFor(() =>
      expect(screen.getByText(/Exercises: 1 to add/)).toBeInTheDocument(),
    );
    expect(await storage.listExercises()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Confirm import' }));

    await waitFor(async () => {
      expect(await storage.listExercises()).toEqual([exercise]);
    });
  });

  it('Cancel writes nothing', async () => {
    const file = buildExportFile({
      sessions: [],
      exercises: [makeExercise()],
      bandLabels: [],
      settings: undefined,
      loggingDraft: undefined,
    });
    fileExchange.setNextPick({
      name: 'export.json',
      content: JSON.stringify(file),
    });
    const user = userEvent.setup();
    render(<ImportFlow />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await storage.listExercises()).toEqual([]);
    expect(
      screen.queryByRole('button', { name: 'Confirm import' }),
    ).not.toBeInTheDocument();
  });

  it('a cancelled file pick (undefined) is a no-op', async () => {
    fileExchange.setNextPick(undefined);
    const user = userEvent.setup();
    render(<ImportFlow />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/to add/)).not.toBeInTheDocument();
  });
});
