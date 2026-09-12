/**
 * Loaded by `test/e2e/indexed-db-adapter.contract.spec.ts` and
 * `test/e2e/file-system-adapter.contract.spec.ts` (spec 003 research.md
 * §3) via `storage-harness.html`. Exposes `window.__runContractScenario`
 * (one scenario per call — see its doc comment for why) and
 * `window.__runContractSuite` (all scenarios in one call, kept for the
 * IndexedDB suite and for local/manual use) so Playwright can drive the
 * shared contract suite (`test/contract/storage-adapter-contract.ts`)
 * against a real adapter, in a real browser — jsdom has neither IndexedDB
 * nor File System Access.
 *
 * `'file-system'` acquires its directory handle via
 * `navigator.storage.getDirectory()` (Origin Private File System), not
 * `showDirectoryPicker()` — OPFS needs no user gesture and no dialog, so
 * it exercises the exact same adapter code (written against
 * `FileSystemDirectoryHandle`, not against which API produced one) while
 * staying fully automatable. Production's composition root
 * (`src/presentation/main.tsx`) still calls `showDirectoryPicker()`.
 *
 * Every scenario gets its own uniquely named Dexie database (and, for File
 * System, its own OPFS subdirectory) so scenarios — and separate calls —
 * never see each other's data; each store's `dispose` closes that Dexie
 * connection (and removes the OPFS subdirectory) once its scenario
 * finishes.
 */
import {
  runStorageAdapterContract,
  runOneScenario,
  findScenario,
  type ContractResult,
} from '../../contract/storage-adapter-contract';
import { IndexedDbStorageAdapter } from '../../../src/infrastructure/indexed-db-storage-adapter';
import { FileSystemStorageAdapter } from '../../../src/infrastructure/file-system-storage-adapter';
import {
  GymLogDatabase,
  SCHEMA_VERSION_ROW_KEY,
} from '../../../src/infrastructure/indexed-db/schema';
import type { StoragePort } from '../../../src/application/ports/storage-port';
import { StorageError } from '../../../src/application/errors';
import type { Exercise } from '../../../src/domain/exercise';
import type { ExerciseId } from '../../../src/domain/ids';

type AdapterKind = 'indexed-db' | 'file-system';

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createIndexedDbStore(): Promise<{
  makeAdapter: () => Promise<StoragePort>;
  dispose: () => void;
}> {
  const db = new GymLogDatabase(uniqueName('contract-idb'));
  return {
    makeAdapter: async (): Promise<StoragePort> =>
      new IndexedDbStorageAdapter(db),
    dispose: () => db.close(),
  };
}

async function createFileSystemStore(): Promise<{
  makeAdapter: () => Promise<StoragePort>;
  dispose: () => Promise<void>;
}> {
  const opfsRoot = await navigator.storage.getDirectory();
  const dirName = uniqueName('contract-fs');
  const storeDir = await opfsRoot.getDirectoryHandle(dirName, {
    create: true,
  });
  const db = new GymLogDatabase(uniqueName('contract-fs-handles'));
  return {
    // Passes storeDir directly as the third (`knownHandle`) constructor
    // arg — see FileSystemStorageAdapter's doc comment on why the
    // contract suite's "restart" simulation avoids round-tripping the
    // handle through the Dexie cache (CI-only, unreproduced locally).
    makeAdapter: async (): Promise<StoragePort> =>
      new FileSystemStorageAdapter(async () => storeDir, db, storeDir),
    dispose: async () => {
      db.close();
      await opfsRoot
        .removeEntry(dirName, { recursive: true })
        .catch(() => undefined);
    },
  };
}

function createStoreFor(kind: AdapterKind) {
  return kind === 'indexed-db' ? createIndexedDbStore : createFileSystemStore;
}

window.__runContractSuite = async (adapterKind) =>
  runStorageAdapterContract(createStoreFor(adapterKind));

/**
 * Runs exactly one named scenario (`test/contract/storage-adapter-contract.ts`'s
 * `CONTRACT_SCENARIOS`) in its own call — see `runOneScenario`'s doc
 * comment for why the Playwright specs drive the suite this way instead
 * of one `__runContractSuite` call per adapter.
 */
window.__runContractScenario = async (adapterKind, scenarioName) => {
  const scenario = findScenario(scenarioName);
  if (!scenario) {
    return { passed: false, error: `Unknown scenario: ${scenarioName}` };
  }
  return runOneScenario(scenario, createStoreFor(adapterKind));
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
  } finally {
    db.close();
  }
};

export interface MigrationTestResult {
  /** The pre-migration record's own fields survived untouched. */
  canonicalNamePreserved: boolean;
  defaultLoadTypePreserved: boolean;
  /** Backfilled by the v1->v2 migration (ADR-0006), read back through the port. */
  defaultVolumeKind: Exercise['defaultVolumeKind'] | undefined;
  trackEffort: Exercise['trackEffort'] | undefined;
  /** The *stored* schema version after a write has actually run — see
   * this function's own doc comment for why File System needs an extra
   * write to reach this, unlike IndexedDB. */
  storedSchemaVersion: number;
}

/**
 * ADR-0006's v1->v2 migration, exercised below the public `StoragePort` —
 * seeding a genuinely pre-migration record (missing `defaultVolumeKind`/
 * `trackEffort`) directly in the adapter's own underlying storage, the one
 * thing the contract suite itself cannot do (see
 * `test/contract/storage-adapter-contract.ts`'s own doc comment: every
 * public write runs the schema check first, so a legacy-shaped record
 * saved through the port would already be migrated by the time it lands).
 *
 * IndexedDB's schema check runs on every read (`#ensureSchemaChecked`), so
 * `getExercise` alone both returns the backfilled shape and physically
 * migrates the stored record. File System's check is write-only by design
 * (`FileSystemStorageAdapter`'s own doc comment — a read must never
 * prompt), so its `getExercise` normalizes the *returned* shape without
 * touching disk; a real write (`saveBandLabels` here, chosen only because
 * it touches no exercise data) is what actually backfills the stored
 * `exercises.json` and bumps `_meta.json`. Both paths are asserted here.
 */
async function runMigrationTestIndexedDb(): Promise<MigrationTestResult> {
  const legacyExercise = {
    id: 'legacy-1',
    canonicalName: 'Legacy squat',
    aliases: [],
    defaultLoadType: 'weight',
    unilateral: false,
    discipline: 'Strength',
    // defaultVolumeKind/trackEffort deliberately absent — a genuine v1 shape.
  } as unknown as Exercise;

  const db = new GymLogDatabase(uniqueName('migration-idb'));
  await db.exercises.put(legacyExercise);
  await db.meta.put({ key: SCHEMA_VERSION_ROW_KEY, value: 1 });

  const adapter = new IndexedDbStorageAdapter(db);
  const migrated = await adapter.getExercise('legacy-1' as ExerciseId);
  const storedSchemaVersion = await adapter.getSchemaVersion();
  db.close();

  return {
    canonicalNamePreserved: migrated?.canonicalName === 'Legacy squat',
    defaultLoadTypePreserved: migrated?.defaultLoadType === 'weight',
    defaultVolumeKind: migrated?.defaultVolumeKind,
    trackEffort: migrated?.trackEffort,
    storedSchemaVersion,
  };
}

async function runMigrationTestFileSystem(): Promise<MigrationTestResult> {
  const legacyExercise = {
    id: 'legacy-1',
    canonicalName: 'Legacy squat',
    aliases: [],
    defaultLoadType: 'weight',
    unilateral: false,
    discipline: 'Strength',
  };

  const opfsRoot = await navigator.storage.getDirectory();
  const dirName = uniqueName('migration-fs');
  const storeDir = await opfsRoot.getDirectoryHandle(dirName, {
    create: true,
  });

  const exercisesHandle = await storeDir.getFileHandle('exercises.json', {
    create: true,
  });
  const exercisesWritable = await exercisesHandle.createWritable();
  await exercisesWritable.write(JSON.stringify([legacyExercise]));
  await exercisesWritable.close();

  const metaHandle = await storeDir.getFileHandle('_meta.json', {
    create: true,
  });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(JSON.stringify({ schemaVersion: 1 }));
  await metaWritable.close();

  const db = new GymLogDatabase(uniqueName('migration-fs-handles'));
  const adapter = new FileSystemStorageAdapter(
    async () => storeDir,
    db,
    storeDir,
  );

  // Read-time normalization, before any write has touched disk.
  const readNormalized = await adapter.getExercise('legacy-1' as ExerciseId);

  // A real write is what actually migrates the on-disk files + version.
  await adapter.saveBandLabels([]);
  const storedSchemaVersion = await adapter.getSchemaVersion();

  db.close();
  await opfsRoot
    .removeEntry(dirName, { recursive: true })
    .catch(() => undefined);

  return {
    canonicalNamePreserved: readNormalized?.canonicalName === 'Legacy squat',
    defaultLoadTypePreserved: readNormalized?.defaultLoadType === 'weight',
    defaultVolumeKind: readNormalized?.defaultVolumeKind,
    trackEffort: readNormalized?.trackEffort,
    storedSchemaVersion,
  };
}

window.__runMigrationTest = (adapterKind) =>
  adapterKind === 'indexed-db'
    ? runMigrationTestIndexedDb()
    : runMigrationTestFileSystem();

declare global {
  interface Window {
    __runContractSuite: (adapterKind: AdapterKind) => Promise<ContractResult>;
    __runContractScenario: (
      adapterKind: AdapterKind,
      scenarioName: string,
    ) => Promise<{ passed: true } | { passed: false; error: string }>;
    __runPermissionLossTest: () => Promise<
      | { threw: false }
      | { threw: true; isStorageError: boolean; kind: string | undefined }
    >;
    __runMigrationTest: (
      adapterKind: AdapterKind,
    ) => Promise<MigrationTestResult>;
  }
}
