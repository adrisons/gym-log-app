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
import type { Session } from '../../../src/domain/session';
import type { ExerciseId, SessionId } from '../../../src/domain/ids';
import {
  SESSIONS_DIR,
  sessionFileName,
} from '../../../src/infrastructure/file-system/layout';

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
  /**
   * Whether the raw on-disk `exercises.json` itself (read directly, not
   * through the port's own normalizing `getExercise`/`listExercises` —
   * see file-system-storage-adapter.ts's `withTemplateDefaults`) actually
   * has the backfilled fields. `getExercise` would report a correctly
   * shaped record either way, since it normalizes whatever it reads
   * regardless of what actually made it to disk — this is the one field
   * that can tell a real physical migration apart from that read-time
   * safety net alone. `undefined` where a scenario doesn't check it.
   */
  rawFileMigrated?: boolean;
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

const LEGACY_EXERCISE = {
  id: 'legacy-1',
  canonicalName: 'Legacy squat',
  aliases: [],
  defaultLoadType: 'weight',
  unilateral: false,
  discipline: 'Strength',
};

/** Seeds a real, genuinely pre-migration v1 directory: `exercises.json` with one legacy-shaped record, `_meta.json` at schemaVersion 1. */
async function seedLegacyDirectory(): Promise<{
  opfsRoot: FileSystemDirectoryHandle;
  dirName: string;
  storeDir: FileSystemDirectoryHandle;
}> {
  const opfsRoot = await navigator.storage.getDirectory();
  const dirName = uniqueName('migration-fs');
  const storeDir = await opfsRoot.getDirectoryHandle(dirName, {
    create: true,
  });

  const exercisesHandle = await storeDir.getFileHandle('exercises.json', {
    create: true,
  });
  const exercisesWritable = await exercisesHandle.createWritable();
  await exercisesWritable.write(JSON.stringify([LEGACY_EXERCISE]));
  await exercisesWritable.close();

  const metaHandle = await storeDir.getFileHandle('_meta.json', {
    create: true,
  });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(JSON.stringify({ schemaVersion: 1 }));
  await metaWritable.close();

  return { opfsRoot, dirName, storeDir };
}

async function runMigrationTestFileSystem(): Promise<MigrationTestResult> {
  const { opfsRoot, dirName, storeDir } = await seedLegacyDirectory();

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

  // Read the raw file directly — bypassing the port's own read-time
  // normalization (`readNormalized` above, which reports a correctly
  // shaped record either way, migrated or not) — to prove the *disk*
  // itself was actually rewritten by this, the ordinary (non-fresh-
  // acquisition) migration path, not just the metadata version bump.
  const rawExercisesFile = await storeDir.getFileHandle('exercises.json');
  const rawExercises = JSON.parse(
    await (await rawExercisesFile.getFile()).text(),
  ) as { defaultVolumeKind?: string; trackEffort?: boolean }[];
  const rawFileMigrated =
    rawExercises[0]?.defaultVolumeKind === 'reps' &&
    rawExercises[0]?.trackEffort === false;

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
    rawFileMigrated,
  };
}

/**
 * Reproduces the exact sequence a Copilot review comment flagged: this
 * adapter's schema check can run in "shadow mode" (no directory handle
 * reachable at all — e.g. the mount-time draft save, which has no user
 * gesture to acquire one with yet) and, finding nothing to read, guesses
 * "never initialized" and queues a `_meta.json` write claiming
 * `CURRENT_SCHEMA_VERSION` in the in-memory overlay. If the directory the
 * user goes on to pick already holds real v1 data, flushing that guess
 * as-is would mark the store "migrated" without ever having backfilled
 * the real `exercises.json` — permanently, since the stored version is
 * already current by the time anything looks again.
 *
 * `getHandle` here fails until `gestureAvailable` flips true, simulating
 * a real device where the first write has no gesture and a later one
 * does; `#reconcileSchemaOnAcquire` (file-system-storage-adapter.ts) is
 * what makes the second write's real handle acquisition re-derive the
 * schema action from the real files instead of trusting that queued
 * guess.
 */
async function runMigrationTestFileSystemFreshAcquire(): Promise<MigrationTestResult> {
  const { opfsRoot, dirName, storeDir } = await seedLegacyDirectory();

  let gestureAvailable = false;
  const getHandle = async (): Promise<FileSystemDirectoryHandle> => {
    if (!gestureAvailable) {
      throw new DOMException('No active user gesture.', 'NotAllowedError');
    }
    return storeDir;
  };

  const db = new GymLogDatabase(uniqueName('migration-fs-fresh-handles'));
  const adapter = new FileSystemStorageAdapter(getHandle, db);

  // The mount-time write: no gesture yet, degrades to the in-memory
  // overlay (this is what used to queue the wrong `_meta.json` guess).
  await adapter.saveBandLabels([]);

  // A later write, now with a real gesture — first real handle
  // acquisition against a directory that already holds v1 data.
  gestureAvailable = true;
  await adapter.saveBandLabels(['after-gesture']);

  const migrated = await adapter.getExercise('legacy-1' as ExerciseId);
  const storedSchemaVersion = await adapter.getSchemaVersion();

  // Read the raw file directly — bypassing the port's own read-time
  // normalization entirely — to prove the *disk* was actually migrated,
  // not just whatever `getExercise` reports back.
  const rawExercisesFile = await storeDir.getFileHandle('exercises.json');
  const rawExercises = JSON.parse(
    await (await rawExercisesFile.getFile()).text(),
  ) as { defaultVolumeKind?: string; trackEffort?: boolean }[];
  const rawFileMigrated =
    rawExercises[0]?.defaultVolumeKind === 'reps' &&
    rawExercises[0]?.trackEffort === false;

  db.close();
  await opfsRoot
    .removeEntry(dirName, { recursive: true })
    .catch(() => undefined);

  return {
    canonicalNamePreserved: migrated?.canonicalName === 'Legacy squat',
    defaultLoadTypePreserved: migrated?.defaultLoadType === 'weight',
    defaultVolumeKind: migrated?.defaultVolumeKind,
    trackEffort: migrated?.trackEffort,
    storedSchemaVersion,
    rawFileMigrated,
  };
}

export interface V2ToV3MigrationResult {
  storedSchemaVersion: number;
  /** A v2 Session's Block genuinely has no `rounds` field at all (not
   * merely `undefined`) — ADR-0008 requires that absence to stay exactly
   * that once the store reports schemaVersion 3, never backfilled to some
   * default. */
  roundsStillAbsent: boolean;
  blockNamePreserved: boolean;
}

/** A genuine pre-ADR-0008 v2 Session shape: a Block with no `rounds` key. */
const V2_SESSION = {
  id: 'v2-session-1',
  dateTime: '2026-01-01T10:00:00.000Z',
  notes: '',
  blocks: [
    {
      name: 'Legs',
      type: 'straightSets',
      exercises: [],
    },
  ],
};

async function runV2ToV3MigrationTestIndexedDb(): Promise<V2ToV3MigrationResult> {
  const db = new GymLogDatabase(uniqueName('migration-v2-idb'));
  await db.sessions.put(V2_SESSION as unknown as Session);
  await db.meta.put({ key: SCHEMA_VERSION_ROW_KEY, value: 2 });

  const adapter = new IndexedDbStorageAdapter(db);
  const migrated = await adapter.getSession('v2-session-1' as SessionId);
  const storedSchemaVersion = await adapter.getSchemaVersion();
  db.close();

  return {
    storedSchemaVersion,
    roundsStillAbsent:
      migrated?.blocks[0] !== undefined && !('rounds' in migrated.blocks[0]),
    blockNamePreserved: migrated?.blocks[0]?.name === 'Legs',
  };
}

async function runV2ToV3MigrationTestFileSystem(): Promise<V2ToV3MigrationResult> {
  const opfsRoot = await navigator.storage.getDirectory();
  const dirName = uniqueName('migration-v2-fs');
  const storeDir = await opfsRoot.getDirectoryHandle(dirName, {
    create: true,
  });

  const sessionsDir = await storeDir.getDirectoryHandle(SESSIONS_DIR, {
    create: true,
  });
  const sessionHandle = await sessionsDir.getFileHandle(
    sessionFileName('v2-session-1' as SessionId),
    { create: true },
  );
  const sessionWritable = await sessionHandle.createWritable();
  await sessionWritable.write(JSON.stringify(V2_SESSION));
  await sessionWritable.close();

  const metaHandle = await storeDir.getFileHandle('_meta.json', {
    create: true,
  });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(JSON.stringify({ schemaVersion: 2 }));
  await metaWritable.close();

  const db = new GymLogDatabase(uniqueName('migration-v2-fs-handles'));
  const adapter = new FileSystemStorageAdapter(
    async () => storeDir,
    db,
    storeDir,
  );

  const migrated = await adapter.getSession('v2-session-1' as SessionId);
  // A real write is what actually migrates the stored `_meta.json` version
  // (see `runMigrationTestFileSystem`'s own doc comment).
  await adapter.saveBandLabels([]);
  const storedSchemaVersion = await adapter.getSchemaVersion();

  db.close();
  await opfsRoot
    .removeEntry(dirName, { recursive: true })
    .catch(() => undefined);

  return {
    storedSchemaVersion,
    roundsStillAbsent:
      migrated?.blocks[0] !== undefined && !('rounds' in migrated.blocks[0]),
    blockNamePreserved: migrated?.blocks[0]?.name === 'Legs',
  };
}

window.__runV2ToV3MigrationTest = (adapterKind) =>
  adapterKind === 'indexed-db'
    ? runV2ToV3MigrationTestIndexedDb()
    : runV2ToV3MigrationTestFileSystem();

export interface V3ToV4MigrationResult {
  storedSchemaVersion: number;
  /** ADR-0013 removes `Block.rounds` from the type going forward, but
   * migrating old data needs no rewrite (no v3->v4 backfill of its own to
   * run, `#checkSchema`'s own comment) — a v3 record's `rounds` value is
   * left on disk exactly as stored, unread by any `Block`-typed code path
   * (the type no longer declares it) but still structurally present on
   * the plain object this port hands back. Checked here as "unchanged",
   * not "gone" — a rewrite that silently dropped or altered it would be
   * its own, separate bug this ADR never asked for. */
  roundsLeftUnchangedOnDisk: boolean;
  blockNamePreserved: boolean;
}

/** A genuine pre-ADR-0013 v3 Session shape: a Block with `rounds` set. */
const V3_SESSION = {
  id: 'v3-session-1',
  dateTime: '2026-01-01T10:00:00.000Z',
  notes: '',
  blocks: [
    {
      name: 'Circuit A',
      type: 'circuit',
      rounds: 3,
      exercises: [],
    },
  ],
};

async function runV3ToV4MigrationTestIndexedDb(): Promise<V3ToV4MigrationResult> {
  const db = new GymLogDatabase(uniqueName('migration-v3-idb'));
  await db.sessions.put(V3_SESSION as unknown as Session);
  await db.meta.put({ key: SCHEMA_VERSION_ROW_KEY, value: 3 });

  const adapter = new IndexedDbStorageAdapter(db);
  const migrated = await adapter.getSession('v3-session-1' as SessionId);
  const storedSchemaVersion = await adapter.getSchemaVersion();
  db.close();

  return {
    storedSchemaVersion,
    roundsLeftUnchangedOnDisk:
      (migrated?.blocks[0] as unknown as { rounds?: number } | undefined)
        ?.rounds === 3,
    blockNamePreserved: migrated?.blocks[0]?.name === 'Circuit A',
  };
}

async function runV3ToV4MigrationTestFileSystem(): Promise<V3ToV4MigrationResult> {
  const opfsRoot = await navigator.storage.getDirectory();
  const dirName = uniqueName('migration-v3-fs');
  const storeDir = await opfsRoot.getDirectoryHandle(dirName, {
    create: true,
  });

  const sessionsDir = await storeDir.getDirectoryHandle(SESSIONS_DIR, {
    create: true,
  });
  const sessionHandle = await sessionsDir.getFileHandle(
    sessionFileName('v3-session-1' as SessionId),
    { create: true },
  );
  const sessionWritable = await sessionHandle.createWritable();
  await sessionWritable.write(JSON.stringify(V3_SESSION));
  await sessionWritable.close();

  const metaHandle = await storeDir.getFileHandle('_meta.json', {
    create: true,
  });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(JSON.stringify({ schemaVersion: 3 }));
  await metaWritable.close();

  const db = new GymLogDatabase(uniqueName('migration-v3-fs-handles'));
  const adapter = new FileSystemStorageAdapter(
    async () => storeDir,
    db,
    storeDir,
  );

  const migrated = await adapter.getSession('v3-session-1' as SessionId);
  // A real write is what actually migrates the stored `_meta.json` version
  // (see `runMigrationTestFileSystem`'s own doc comment).
  await adapter.saveBandLabels([]);
  const storedSchemaVersion = await adapter.getSchemaVersion();

  db.close();
  await opfsRoot
    .removeEntry(dirName, { recursive: true })
    .catch(() => undefined);

  return {
    storedSchemaVersion,
    roundsLeftUnchangedOnDisk:
      (migrated?.blocks[0] as unknown as { rounds?: number } | undefined)
        ?.rounds === 3,
    blockNamePreserved: migrated?.blocks[0]?.name === 'Circuit A',
  };
}

window.__runV3ToV4MigrationTest = (adapterKind) =>
  adapterKind === 'indexed-db'
    ? runV3ToV4MigrationTestIndexedDb()
    : runV3ToV4MigrationTestFileSystem();

window.__runMigrationTest = (adapterKind) =>
  adapterKind === 'indexed-db'
    ? runMigrationTestIndexedDb()
    : runMigrationTestFileSystem();

window.__runMigrationTestFreshAcquire = () =>
  runMigrationTestFileSystemFreshAcquire();

export interface QueuedExerciseMergeResult {
  exerciseIds: string[];
}

/**
 * Reproduces a second Copilot finding on the same fresh-acquisition path:
 * `saveExercise` running with no handle reachable yet queues a *whole*
 * `exercises.json` snapshot built from what it could read at the time —
 * nothing. If the directory later acquired for real already holds other
 * records, flushing that queued snapshot as-is would silently drop them.
 * `#reconcileQueuedExercisesOnAcquire` (file-system-storage-adapter.ts)
 * merges the queued snapshot against the real on-disk file first.
 */
async function runQueuedExerciseMergeTest(): Promise<QueuedExerciseMergeResult> {
  const { opfsRoot, dirName, storeDir } = await seedLegacyDirectory();

  let gestureAvailable = false;
  const getHandle = async (): Promise<FileSystemDirectoryHandle> => {
    if (!gestureAvailable) {
      throw new DOMException('No active user gesture.', 'NotAllowedError');
    }
    return storeDir;
  };

  const db = new GymLogDatabase(uniqueName('merge-fs-handles'));
  const adapter = new FileSystemStorageAdapter(getHandle, db);

  // Gesture-less: queues exercises.json = [newExercise] in the overlay,
  // computed as if the catalogue were empty (no handle to read the real
  // one, which already has `legacy-1`).
  await adapter.saveExercise({
    id: 'new-1' as ExerciseId,
    canonicalName: 'New exercise',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  });

  // A later write, now with a real gesture — first real handle
  // acquisition against a directory that already holds `legacy-1`.
  gestureAvailable = true;
  await adapter.saveBandLabels(['after-gesture']);

  const all = await adapter.listExercises();

  db.close();
  await opfsRoot
    .removeEntry(dirName, { recursive: true })
    .catch(() => undefined);

  return { exerciseIds: all.map((e) => e.id).sort() };
}

window.__runQueuedExerciseMergeTest = () => runQueuedExerciseMergeTest();

export interface QueuedMergeTombstoneResult {
  exerciseIds: string[];
}

/**
 * A third Copilot finding on `#reconcileQueuedExercisesOnAcquire`
 * (file-system-storage-adapter.ts): the merge above can't tell "this id is
 * absent from the queued snapshot because shadow mode never touched it"
 * (keep the real record) apart from "absent because a queued
 * `mergeExercises`/`deleteExerciseCascade` call folded/removed it" (must
 * NOT resurrect it from disk) — both look identical from the queued array
 * alone. `#tombstonedExerciseIds` is the fix.
 *
 * Reproduces it directly: seeds two *real* pre-existing exercises
 * (`legacy-a`, `legacy-b`), then — still with no gesture available —
 * re-creates both under the same ids (simulating the app already knowing
 * about them from before this adapter instance existed) and merges
 * `legacy-b` into `legacy-a`, all while queued. Acquiring a real handle
 * afterwards must not bring `legacy-b` back from the real, pre-merge file.
 */
async function runQueuedMergeTombstoneTest(): Promise<QueuedMergeTombstoneResult> {
  const opfsRoot = await navigator.storage.getDirectory();
  const dirName = uniqueName('merge-tombstone-fs');
  const storeDir = await opfsRoot.getDirectoryHandle(dirName, {
    create: true,
  });
  const seedExercises = [
    { ...LEGACY_EXERCISE, id: 'legacy-a', canonicalName: 'Legacy A' },
    { ...LEGACY_EXERCISE, id: 'legacy-b', canonicalName: 'Legacy B' },
  ];
  const exercisesHandle = await storeDir.getFileHandle('exercises.json', {
    create: true,
  });
  const exercisesWritable = await exercisesHandle.createWritable();
  await exercisesWritable.write(JSON.stringify(seedExercises));
  await exercisesWritable.close();
  const metaHandle = await storeDir.getFileHandle('_meta.json', {
    create: true,
  });
  const metaWritable = await metaHandle.createWritable();
  await metaWritable.write(JSON.stringify({ schemaVersion: 2 }));
  await metaWritable.close();

  let gestureAvailable = false;
  const getHandle = async (): Promise<FileSystemDirectoryHandle> => {
    if (!gestureAvailable) {
      throw new DOMException('No active user gesture.', 'NotAllowedError');
    }
    return storeDir;
  };

  const db = new GymLogDatabase(uniqueName('merge-tombstone-fs-handles'));
  const adapter = new FileSystemStorageAdapter(getHandle, db);

  // Gesture-less: queues both records into the overlay, then merges them
  // there — `legacy-b` never touches the real handle, all in shadow mode.
  await adapter.saveExercise({
    id: 'legacy-a' as ExerciseId,
    canonicalName: 'Legacy A',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  });
  await adapter.saveExercise({
    id: 'legacy-b' as ExerciseId,
    canonicalName: 'Legacy B',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  });
  await adapter.mergeExercises(
    'legacy-a' as ExerciseId,
    'legacy-b' as ExerciseId,
  );

  // A later write, now with a real gesture — first real handle
  // acquisition against a directory whose *real* file still has both.
  gestureAvailable = true;
  await adapter.saveBandLabels(['after-gesture']);

  const all = await adapter.listExercises();

  db.close();
  await opfsRoot
    .removeEntry(dirName, { recursive: true })
    .catch(() => undefined);

  return { exerciseIds: all.map((e) => e.id).sort() };
}

window.__runQueuedMergeTombstoneTest = () => runQueuedMergeTombstoneTest();

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
    __runMigrationTestFreshAcquire: () => Promise<MigrationTestResult>;
    __runV2ToV3MigrationTest: (
      adapterKind: AdapterKind,
    ) => Promise<V2ToV3MigrationResult>;
    __runV3ToV4MigrationTest: (
      adapterKind: AdapterKind,
    ) => Promise<V3ToV4MigrationResult>;
    __runQueuedExerciseMergeTest: () => Promise<QueuedExerciseMergeResult>;
    __runQueuedMergeTombstoneTest: () => Promise<QueuedMergeTombstoneResult>;
  }
}
