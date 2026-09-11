/**
 * Loaded by `test/e2e/indexed-db-adapter.contract.spec.ts` and
 * `test/e2e/file-system-adapter.contract.spec.ts` (spec 003 research.md
 * §3) via `storage-harness.html`. Exposes `window.__runContractSuite` so
 * Playwright can drive the shared contract suite
 * (`test/contract/storage-adapter-contract.ts`) against a real adapter,
 * in a real browser — jsdom has neither IndexedDB nor File System Access.
 *
 * `'file-system'` acquires its directory handle via
 * `navigator.storage.getDirectory()` (Origin Private File System), not
 * `showDirectoryPicker()` — OPFS needs no user gesture and no dialog, so
 * it exercises the exact same adapter code (written against
 * `FileSystemDirectoryHandle`, not against which API produced one) while
 * staying fully automatable. Production's composition root
 * (`src/presentation/main.tsx`) still calls `showDirectoryPicker()`.
 *
 * Every `runStorageAdapterContract` call gets its own uniquely named Dexie
 * database (and, for File System, its own OPFS subdirectory) so scenarios
 * — and separate `__runContractSuite` calls — never see each other's data.
 */
import {
  runStorageAdapterContract,
  type ContractResult,
} from '../../contract/storage-adapter-contract';
import { IndexedDbStorageAdapter } from '../../../src/infrastructure/indexed-db-storage-adapter';
import { FileSystemStorageAdapter } from '../../../src/infrastructure/file-system-storage-adapter';
import { GymLogDatabase } from '../../../src/infrastructure/indexed-db/schema';
import type { StoragePort } from '../../../src/application/ports/storage-port';
import { StorageError } from '../../../src/application/errors';

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function runIndexedDb(): Promise<ContractResult> {
  return runStorageAdapterContract(async () => {
    const db = new GymLogDatabase(uniqueName('contract-idb'));
    return async (): Promise<StoragePort> => new IndexedDbStorageAdapter(db);
  });
}

async function runFileSystem(): Promise<ContractResult> {
  return runStorageAdapterContract(async () => {
    const opfsRoot = await navigator.storage.getDirectory();
    const storeDir = await opfsRoot.getDirectoryHandle(
      uniqueName('contract-fs'),
      { create: true },
    );
    const db = new GymLogDatabase(uniqueName('contract-fs-handles'));
    return async (): Promise<StoragePort> =>
      new FileSystemStorageAdapter(async () => storeDir, db);
  });
}

window.__runContractSuite = async (adapterKind) => {
  if (adapterKind === 'indexed-db') return runIndexedDb();
  return runFileSystem();
};

/**
 * Simulates a lost/revoked File System Access permission (spec.md Edge
 * Cases; spec 003 tasks.md T029). OPFS handles always report `'granted'`
 * for same-origin access, so `queryPermission` is stubbed to resolve
 * `'denied'` on the *next* check — the only way to exercise this path
 * without a real cross-session revoke.
 */
window.__runPermissionLossTest = async () => {
  const opfsRoot = await navigator.storage.getDirectory();
  const storeDir = await opfsRoot.getDirectoryHandle(
    uniqueName('permission-loss'),
    { create: true },
  );
  (storeDir as { queryPermission: () => Promise<'denied'> }).queryPermission =
    () => Promise.resolve('denied');

  const db = new GymLogDatabase(uniqueName('permission-loss-handles'));
  const adapter = new FileSystemStorageAdapter(async () => storeDir, db);

  try {
    await adapter.saveBandLabels(['should-not-write']);
    return { threw: false as const };
  } catch (error) {
    return {
      threw: true as const,
      isStorageError: error instanceof StorageError,
      kind: error instanceof StorageError ? error.kind : undefined,
    };
  }
};

declare global {
  interface Window {
    __runContractSuite: (
      adapterKind: 'indexed-db' | 'file-system',
    ) => Promise<ContractResult>;
    __runPermissionLossTest: () => Promise<
      | { threw: false }
      | { threw: true; isStorageError: boolean; kind: string | undefined }
    >;
  }
}
