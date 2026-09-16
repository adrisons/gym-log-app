/**
 * The storage-status view-model store (spec 009 FR-006-009/FR-017) —
 * Zustand, `configure(storage)` pattern mirroring `settings-store.ts`.
 */
import { create } from 'zustand';
import type { StoragePort } from './ports/storage-port';
import type { StorageStatus } from './ports/storage-status';

interface StorageStatusState {
  storage: StoragePort | undefined;
  status: StorageStatus | undefined;
  loaded: boolean;
  reconfirming: boolean;
  reconfirmError: string | undefined;
  configure: (storage: StoragePort) => void;
  load: () => Promise<void>;
  reconfirm: () => Promise<void>;
}

export const useStorageStatusStore = create<StorageStatusState>((set, get) => ({
  storage: undefined,
  status: undefined,
  loaded: false,
  reconfirming: false,
  reconfirmError: undefined,
  configure: (storage) => set({ storage }),
  async load() {
    const { storage } = get();
    if (!storage) return;
    const status = await storage.getStorageStatus();
    set({ status, loaded: true });
  },
  async reconfirm() {
    const { storage } = get();
    if (!storage) return;
    set({ reconfirming: true, reconfirmError: undefined });
    try {
      await storage.reconfirmFileSystemAccess();
      const status = await storage.getStorageStatus();
      set({ status, reconfirming: false });
    } catch (error: unknown) {
      set({
        reconfirming: false,
        reconfirmError:
          error instanceof Error
            ? error.message
            : 'Could not reconfirm access — try again.',
      });
    }
  },
}));
