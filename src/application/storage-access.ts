/**
 * Holds the single `StoragePort` instance the composition root configures
 * once at mount (`presentation/main.tsx`), shared read-only by the diary,
 * search and progression screens (spec 004) — mirrors
 * `logging/logging-store.ts`'s own `storage`/`configure` pattern, kept
 * separate from it because those three screens have no session-draft
 * state to manage, only reads.
 */
import { create } from 'zustand';
import type { StoragePort } from './ports/storage-port';

interface StorageAccessState {
  storage: StoragePort | undefined;
  configure: (storage: StoragePort) => void;
}

export const useStorageAccess = create<StorageAccessState>((set) => ({
  storage: undefined,
  configure: (storage) => set({ storage }),
}));

/** Throws if called before the composition root's `configure()`. */
export function requireStorage(): StoragePort {
  const { storage } = useStorageAccess.getState();
  if (!storage) {
    throw new Error('useStorageAccess: not configured yet.');
  }
  return storage;
}
