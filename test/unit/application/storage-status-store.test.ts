import { beforeEach, describe, expect, it } from 'vitest';
import { useStorageStatusStore } from '@/application/storage-status-store';
import { InMemoryStorage } from '../../support';

describe('storage-status-store (spec 009 FR-006-009/FR-017)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    useStorageStatusStore.setState({
      storage: undefined,
      status: undefined,
      loaded: false,
      reconfirming: false,
      reconfirmError: undefined,
    });
  });

  it('load() reads getStorageStatus() from the configured StoragePort', async () => {
    useStorageStatusStore.getState().configure(storage);

    await useStorageStatusStore.getState().load();

    expect(useStorageStatusStore.getState().status).toEqual({
      kind: 'indexed-db',
    });
    expect(useStorageStatusStore.getState().loaded).toBe(true);
  });

  it('reconfirm() calls reconfirmFileSystemAccess() then refreshes status', async () => {
    useStorageStatusStore.getState().configure(storage);
    await useStorageStatusStore.getState().load();

    await useStorageStatusStore.getState().reconfirm();

    expect(useStorageStatusStore.getState().reconfirming).toBe(false);
    expect(useStorageStatusStore.getState().reconfirmError).toBeUndefined();
    expect(useStorageStatusStore.getState().status).toEqual({
      kind: 'indexed-db',
    });
  });

  it('reconfirm() records a message on failure without throwing', async () => {
    storage.reconfirmFileSystemAccess = () =>
      Promise.reject(new Error('access denied'));
    useStorageStatusStore.getState().configure(storage);

    await useStorageStatusStore.getState().reconfirm();

    expect(useStorageStatusStore.getState().reconfirming).toBe(false);
    expect(useStorageStatusStore.getState().reconfirmError).toBe(
      'access denied',
    );
  });
});
