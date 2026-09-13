import { describe, expect, it, vi } from 'vitest';
import { deleteSessionsWithUndo } from '@/application/diary/diary-bulk-delete';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import type { StoragePort } from '@/application/ports/storage-port';
import type { Session } from '@/domain/session';
import type { SessionId } from '@/domain/ids';
import type { ExerciseId } from '@/domain/ids';

function session(id: string): Session {
  return createSession({
    id: id as SessionId,
    dateTime: '2026-09-11T10:00:00.000Z',
    notes: '',
    blocks: [
      createBlock({
        type: 'straightSets',
        exercises: [
          {
            exerciseId: 'ex-1' as ExerciseId,
            notes: '',
            sets: [
              createSet({
                load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
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

function fakeStorage(overrides: Partial<StoragePort> = {}): StoragePort {
  return {
    saveSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn(),
    listSessions: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    saveExercise: vi.fn(),
    getExercise: vi.fn(),
    listExercises: vi.fn(),
    mergeExercises: vi.fn(),
    ...overrides,
  } as unknown as StoragePort;
}

describe('deleteSessionsWithUndo (FR-6, presentation/application boundary)', () => {
  it('deletes every session and reports no failures once settled', async () => {
    const storage = fakeStorage();
    const sessions = [session('s1'), session('s2')];

    const handle = deleteSessionsWithUndo(storage, sessions);
    const outcome = await handle.settled;

    expect(storage.deleteSession).toHaveBeenCalledTimes(2);
    expect(outcome.failures).toEqual([]);
  });

  it('reports exactly the sessions whose delete rejected, leaving the others alone', async () => {
    const storage = fakeStorage({
      deleteSession: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('storage unavailable')),
    });
    const [ok, failing] = [session('s1'), session('s2')];

    const handle = deleteSessionsWithUndo(storage, [ok!, failing!]);
    const outcome = await handle.settled;

    expect(outcome.failures).toEqual([failing]);
  });

  it('restore waits for the deletes to finish before writing any session back (undo/delete race)', async () => {
    let resolveDelete: () => void = () => {};
    const deleteStarted = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    const order: string[] = [];
    const storage = fakeStorage({
      deleteSession: vi.fn().mockImplementation(async () => {
        order.push('delete-start');
        await new Promise<void>((resolve) => {
          void deleteStarted.then(resolve);
        });
        order.push('delete-end');
      }),
      saveSession: vi.fn().mockImplementation(async () => {
        order.push('save');
      }),
    });
    const sessions = [session('s1')];

    const handle = deleteSessionsWithUndo(storage, sessions);
    const restorePromise = handle.restore();
    // The delete is still in flight — `restore` must not have written
    // anything back yet, however soon "Undo" is tapped after "Delete".
    await Promise.resolve();
    await Promise.resolve();
    expect(storage.saveSession).not.toHaveBeenCalled();

    resolveDelete();
    await restorePromise;

    expect(order).toEqual(['delete-start', 'delete-end', 'save']);
    expect(storage.saveSession).toHaveBeenCalledWith(sessions[0]);
  });

  it('restore is a harmless no-op-equivalent overwrite for a session whose delete had failed', async () => {
    const storage = fakeStorage({
      deleteSession: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const sessions = [session('s1')];

    const handle = deleteSessionsWithUndo(storage, sessions);
    await handle.restore();

    expect(storage.saveSession).toHaveBeenCalledWith(sessions[0]);
  });

  it("restore reports exactly the sessions whose save rejected, still saving the rest (one failure doesn't abandon the batch)", async () => {
    const storage = fakeStorage({
      saveSession: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('storage unavailable')),
    });
    const [ok, failing] = [session('s1'), session('s2')];

    const handle = deleteSessionsWithUndo(storage, [ok!, failing!]);
    const outcome = await handle.restore();

    expect(storage.saveSession).toHaveBeenCalledTimes(2);
    expect(outcome.failures).toEqual([failing]);
  });
});
