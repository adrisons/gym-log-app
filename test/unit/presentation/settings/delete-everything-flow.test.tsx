import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteEverythingFlow } from '@/presentation/settings/delete-everything-flow';
import { useStorageAccess } from '@/application/storage-access';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';
import { createSession } from '@/domain/session';
import { StorageError } from '@/application/errors';
import { InMemoryStorage } from '../../../support';

describe('DeleteEverythingFlow (spec 006 FR-015/016)', () => {
  let storage: InMemoryStorage;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
    await storage.saveSession(
      createSession({
        id: 'sess-1' as SessionId,
        dateTime: '2026-09-10T00:00:00.000Z',
        notes: '',
        blocks: [],
      }),
    );
    await storage.saveExercise({
      id: 'ex-1' as ExerciseId,
      canonicalName: 'User-added',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    } satisfies Exercise);
  });

  it('backing out of the first confirmation deletes nothing', async () => {
    const user = userEvent.setup();
    render(<DeleteEverythingFlow onDeleted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
    ).toHaveLength(1);
  });

  it('requires two confirmations, the second stating irreversibility, before deleting anything, then calls onDeleted', async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<DeleteEverythingFlow onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Continue' }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(screen.getByText(/cannot be undone/)).toBeInTheDocument(),
    );
    expect(await storage.listExercises()).toHaveLength(1); // still nothing deleted
    expect(onDeleted).not.toHaveBeenCalled();

    await user.click(
      screen.getAllByRole('button', { name: 'Delete everything' })[1]!,
    );

    await waitFor(async () => {
      expect(
        await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
      ).toEqual([]);
    });
    const remainingExercises = await storage.listExercises();
    expect(remainingExercises.map((e) => e.canonicalName)).not.toContain(
      'User-added',
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('a rejected resetToFreshInstall surfaces the StorageError message instead of leaving the flow stuck on "Deleting…"', async () => {
    vi.spyOn(storage, 'resetToFreshInstall').mockRejectedValue(
      new StorageError(
        'File System Access permission was lost or revoked for this directory.',
      ),
    );
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<DeleteEverythingFlow onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete everything' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Delete everything' })[1]!,
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'File System Access permission was lost or revoked for this directory.',
      ),
    );
    expect(screen.queryByText('Deleting…')).not.toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
