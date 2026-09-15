import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportFlow } from '@/presentation/settings/import-flow';
import { useStorageAccess } from '@/application/storage-access';
import { useFileExchangeAccess } from '@/application/file-exchange-access';
import { buildExportFile } from '@/application/data-transfer/export-file';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';
import { StorageError } from '@/application/errors';
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
    render(<ImportFlow onImported={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/to add/)).not.toBeInTheDocument();
  });

  it('shows accurate add/replace counts for a valid file, calls importBulk only on Confirm, and calls onImported once landed', async () => {
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
    const onImported = vi.fn();
    const user = userEvent.setup();
    render(<ImportFlow onImported={onImported} />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));

    await waitFor(() =>
      expect(screen.getByText(/Exercises: 1 to add/)).toBeInTheDocument(),
    );
    expect(await storage.listExercises()).toEqual([]);
    expect(onImported).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm import' }));

    await waitFor(async () => {
      expect(await storage.listExercises()).toEqual([exercise]);
    });
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  });

  it('Cancel writes nothing and never calls onImported', async () => {
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
    const onImported = vi.fn();
    const user = userEvent.setup();
    render(<ImportFlow onImported={onImported} />);

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
    expect(onImported).not.toHaveBeenCalled();
  });

  it('a cancelled file pick (undefined) is a no-op', async () => {
    fileExchange.setNextPick(undefined);
    const user = userEvent.setup();
    render(<ImportFlow onImported={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/to add/)).not.toBeInTheDocument();
  });

  it('a picker failure surfaces as an error instead of an unhandled rejection', async () => {
    vi.spyOn(fileExchange, 'pickFile').mockRejectedValue(
      new Error('Could not open the file picker.'),
    );
    const user = userEvent.setup();
    render(<ImportFlow onImported={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not open the file picker.',
      ),
    );
  });

  it('a rejected commit surfaces the StorageError message instead of leaving the flow stuck on "Importing…"', async () => {
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
    vi.spyOn(storage, 'importBulk').mockRejectedValue(
      new StorageError('Storage quota exceeded — nothing was written.'),
    );
    const onImported = vi.fn();
    const user = userEvent.setup();
    render(<ImportFlow onImported={onImported} />);

    await user.click(screen.getByRole('button', { name: 'Import data' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Confirm import' }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Confirm import' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Storage quota exceeded — nothing was written.',
      ),
    );
    expect(screen.queryByText('Importing…')).not.toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });
});
