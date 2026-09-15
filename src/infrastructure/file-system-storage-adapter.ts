import type {
  StoragePort,
  DateRange,
  LoggingDraft,
  BulkImportInput,
} from '../application/ports/storage-port';
import type { Settings } from '../application/ports/settings';
import type { Session } from '../domain/session';
import type { Exercise } from '../domain/exercise';
import type { SessionId, ExerciseId } from '../domain/ids';
import { StorageError } from '../application/errors';
import { toPersistableDraft } from '../application/logging/draft';
import {
  migrateExerciseCatalogue,
  migrateExerciseTemplateDefaults as withTemplateDefaults,
} from '../application/schema-migration';
import {
  SESSIONS_DIR,
  EXERCISES_FILE,
  DRAFT_FILE,
  BAND_LABELS_FILE,
  SETTINGS_FILE,
  META_FILE,
  PENDING_BULK_WRITE_FILE,
  sessionFileName,
} from './file-system/layout';
import {
  GymLogDatabase,
  FILE_SYSTEM_HANDLE_ROW_KEY,
} from './indexed-db/schema';
import { CURRENT_SCHEMA_VERSION, decideSchemaAction } from './schema-version';
import {
  draftReferencesExercise,
  repointDraftExerciseId,
  pruneDraftExerciseId,
} from './draft-cascade';

/** Acquires (or re-acquires, e.g. via a user gesture) the root directory handle. Never called except from `#resolveHandle` when no cached, still-permitted handle exists (spec 003 research.md §2). */
export type FileSystemHandleProvider = () => Promise<FileSystemDirectoryHandle>;

const SESSION_KEY_PREFIX = 'session:';

type OverlayEntry = { kind: 'value'; value: unknown } | { kind: 'deleted' };

/**
 * The write-ahead journal `importBulk`/`resetToFreshInstall` write before
 * touching any target file, and delete once every target write succeeds
 * (spec 006 research.md §2 — the File System Access API has no native
 * multi-file transaction, so this is how those two methods still satisfy
 * `StoragePort`'s all-or-nothing contract: a journal left behind on the
 * next launch means the prior attempt was interrupted, and gets replayed
 * before anything else runs).
 */
type PendingBulkWrite =
  | { kind: 'import'; input: BulkImportInput }
  | { kind: 'reset'; seedExercises: Exercise[]; schemaVersion: number };

/**
 * Durable `StoragePort` implementation backed by the File System Access
 * API (ADR-0002; spec 003 FR-002). Selected by the composition root
 * wherever the API is available (spec 003 FR-004).
 *
 * Never calls `showDirectoryPicker()` itself — `getHandle` (constructor
 * param) is the composition root's own acquisition call (production) or a
 * test's OPFS `navigator.storage.getDirectory()` (research.md §2/§3).
 * Once acquired, the handle is cached in `db`'s `fileSystemHandle` table
 * so a later launch reuses it via a silent `queryPermission` check, never
 * a re-prompt.
 *
 * Read/write split (FR-004a): a *read* never calls `getHandle()` — on a
 * device with no handle yet there is by definition nothing to read, so
 * reads return their "empty" result with no dialog. Only a *write* calls
 * `getHandle()`, as the last resort when nothing is cached.
 *
 * Gesture-gated acquisition and the write overlay: `showDirectoryPicker()`
 * requires a live user gesture, but this app's very first write can be a
 * schema-version migration (`#checkSchema`/`#migrateExerciseTemplateDefaults`,
 * triggered lazily by whichever write happens first) rather than anything
 * the user directly asked for — so it can still land before the user has
 * done anything to click. (Before ADR-0009, an empty `LoggingDraft` was
 * also auto-created and saved the instant the logging screen opened —
 * spec 001's original `openLoggingForm` — which made this the common case
 * rather than the rare one; opening the form no longer writes anything by
 * itself, but the schema-check path still can, so the mechanism stays.)
 * Rather than reject that write (which would
 * deadlock the screen — it never renders the interactive controls a
 * gesture could come from), a `getHandle()` failure is treated as
 * "not yet available," not a hard error: the write is kept in `#overlay`
 * (in memory) and the call still resolves normally. The next write that
 * *does* carry a real gesture (the user's first tap — searching an
 * exercise, confirming a set) successfully acquires the handle and
 * flushes every buffered overlay entry to real files before proceeding —
 * so nothing is lost, and no dialog blocks app open (Principle II). A
 * handle that exists but has lost its permission grant
 * (`#assertPermission`) is a different, real failure (`kind:
 * 'permission-lost'`) and is never shadowed this way.
 */
export class FileSystemStorageAdapter implements StoragePort {
  readonly #getHandle: FileSystemHandleProvider;
  readonly #db: GymLogDatabase;
  #root: FileSystemDirectoryHandle | undefined;
  #permissionVerified = false;
  #schemaCheck: Promise<void> | undefined;
  readonly #overlay = new Map<string, OverlayEntry>();
  /**
   * Every exercise id ever removed by `mergeExercises` (the loser) or
   * `deleteExerciseCascade` while running against the `EXERCISES_FILE`
   * overlay. `#reconcileQueuedExercisesOnAcquire` can't otherwise tell "id
   * absent from the queued snapshot because shadow mode never touched it"
   * (keep the real on-disk record) apart from "absent because shadow mode
   * merged/deleted it away" (must NOT resurrect it from disk) — both look
   * identical from the queued array alone. This set is the difference.
   */
  readonly #tombstonedExerciseIds = new Set<ExerciseId>();

  /**
   * `knownHandle` is a testability seam only — production (the
   * composition root) never passes it, always relying on the Dexie
   * handle-cache (research.md §2) to resolve a handle across a real
   * reload. When given, this instance treats the handle as already
   * resolved and verified, skipping both `getHandle()` and the Dexie
   * cache lookup entirely. The contract suite's "restart" simulation
   * (spec 003 tasks.md, `test/contract/storage-adapter-contract.ts`)
   * uses this to construct its "reader" instance directly from the
   * OPFS handle its own test harness already holds in memory, rather
   * than round-tripping it through IndexedDB — CI's Chromium build
   * reproducibly failed every scenario that read a
   * `FileSystemDirectoryHandle` back out of IndexedDB (never reproduced
   * locally, and unaffected by five different unrelated mitigations),
   * so the suite no longer relies on that specific mechanism to prove
   * what it actually cares about: does the *data* survive a restart.
   * The Dexie-cache path itself is still real production code, still
   * exercised by the dedicated permission-loss test
   * (`test/e2e/file-system-adapter.contract.spec.ts`), which does rely
   * on it and passes reliably.
   */
  constructor(
    getHandle: FileSystemHandleProvider,
    db: GymLogDatabase = new GymLogDatabase(),
    knownHandle?: FileSystemDirectoryHandle,
  ) {
    this.#getHandle = getHandle;
    this.#db = db;
    if (knownHandle) {
      this.#root = knownHandle;
      this.#permissionVerified = true;
    }
  }

  /**
   * Returns the already-acquired handle, if any — never calls
   * `getHandle()`. Checks permission at most once per adapter instance
   * (research.md §2: "on every later *launch*" — a launch is one adapter
   * instance's lifetime, not every individual operation, which is what
   * this used to do: querying permission on literally every read/write
   * call reproducibly crashed CI's Chromium under this suite's restart
   * simulation, calling it many times per scenario). Once verified, later
   * calls reuse `#root` without re-querying. Real permission loss is
   * still caught — once — on this instance's first use, whether the
   * handle came from a fresh `getHandle()` acquisition or the persisted
   * cache.
   */
  async #tryDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
    if (this.#root) {
      if (!this.#permissionVerified) {
        await this.#assertPermission(this.#root);
        this.#permissionVerified = true;
      }
      return this.#root;
    }
    const cached = await this.#db.fileSystemHandle.get(
      FILE_SYSTEM_HANDLE_ROW_KEY,
    );
    if (!cached) return undefined;
    await this.#assertPermission(cached.value);
    this.#permissionVerified = true;
    this.#root = cached.value;
    return this.#root;
  }

  /**
   * `force: false` (reads): returns the handle if already acquired, else
   * `undefined` — never calls `getHandle()`. `force: true` (writes):
   * additionally falls back to `getHandle()`; if that fails (most
   * commonly, no user gesture yet), returns `undefined` rather than
   * throwing — the caller writes to `#overlay` instead (see class doc
   * comment). On a successful fresh acquisition, flushes `#overlay` to
   * real files before returning the handle.
   */
  async #resolveHandle(
    force: boolean,
  ): Promise<FileSystemDirectoryHandle | undefined> {
    const existing = await this.#tryDirectoryHandle();
    if (existing) return existing;
    if (!force) return undefined;

    let handle: FileSystemDirectoryHandle;
    try {
      handle = await this.#getHandle();
    } catch {
      return undefined;
    }
    // Validate before committing to this handle at all — a rejected
    // (schema-too-new) directory must never be cached, or the *next* call
    // would return it straight from `#tryDirectoryHandle`'s cache without
    // ever revalidating, silently bypassing the "write nothing" refusal.
    await this.#reconcileSchemaOnAcquire(handle);
    await this.#db.fileSystemHandle.put({
      key: FILE_SYSTEM_HANDLE_ROW_KEY,
      value: handle,
    });
    this.#root = handle;
    // Before flushing anything queued while this instance had no handle
    // at all: a queued *whole-file* write (`exercises.json`) was computed
    // by code that could not read the real file yet and so assumed it was
    // empty — flushing it as-is would silently discard every real
    // pre-existing record the check above just migrated. Reconciling it
    // against what's actually on disk first keeps both.
    await this.#reconcileQueuedExercisesOnAcquire(handle);
    await this.#flushOverlay(handle);
    return handle;
  }

  /**
   * A queued `EXERCISES_FILE` overlay write (from `saveExercise`/
   * `mergeExercises`/`deleteExerciseCascade` running with no handle
   * reachable yet) is a *whole-array* snapshot built from what those
   * methods could read at the time — which, with no handle, is nothing.
   * Flushing that snapshot as-is onto a directory that turns out to
   * already hold real records (this instance's first-ever real
   * acquisition) would silently drop every record the queued snapshot
   * didn't know about. Replaces the queued entry with a merge — the real
   * on-disk record for any id the overlay never touched, the overlay's
   * own record (already `withTemplateDefaults`-shaped, since it went
   * through the normal read/write path) for every id it did — so the
   * flush that follows writes the combined result instead.
   *
   * An id absent from the queued array is ambiguous on its own: it could
   * mean shadow mode never touched it (keep the real record), or that a
   * queued `mergeExercises`/`deleteExerciseCascade` call removed it (must
   * NOT resurrect it from disk — `#tombstonedExerciseIds` is exactly the
   * set of ids that fall in the second case).
   */
  async #reconcileQueuedExercisesOnAcquire(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    const queued = this.#overlay.get(EXERCISES_FILE);
    if (!queued || queued.kind !== 'value') return;
    const queuedExercises = queued.value as Exercise[];
    const realExercises =
      (await this.#readJsonFromHandle<Exercise[]>(handle, EXERCISES_FILE)) ??
      [];
    const queuedIds = new Set(queuedExercises.map((e) => e.id));
    const merged = [
      ...realExercises.filter(
        (e) => !queuedIds.has(e.id) && !this.#tombstonedExerciseIds.has(e.id),
      ),
      ...queuedExercises,
    ];
    this.#overlay.set(EXERCISES_FILE, { kind: 'value', value: merged });
  }

  /**
   * Runs exactly once per instance, the moment a real directory handle is
   * first acquired via a live user gesture — which can happen well after
   * this same instance already ran `#checkSchema` in shadow mode (no
   * handle reachable at all, e.g. the mount-time draft save that has no
   * gesture to work with yet). That shadow-mode check can only guess
   * "never initialized" (there is nothing to read) and may have queued a
   * `META_FILE` overlay write claiming `CURRENT_SCHEMA_VERSION` — a guess
   * that is simply wrong if the directory the user goes on to pick
   * already holds real v1 data: flushing that guess as-is would mark the
   * store "already migrated" without ever having backfilled its actual
   * `exercises.json`, permanently skipping the migration this session
   * should have run.
   *
   * Fixes this by re-deriving the schema action from the real,
   * newly-reachable files (bypassing the overlay entirely, since it may
   * hold exactly the stale guess being corrected here) before any queued
   * write is flushed on top of it, and discarding any shadow-mode
   * `META_FILE` guess in favor of whatever this real check produces.
   */
  async #reconcileSchemaOnAcquire(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    this.#overlay.delete(META_FILE);
    const realMeta = await this.#readJsonFromHandle<{
      schemaVersion: number;
    }>(handle, META_FILE);
    const stored = realMeta?.schemaVersion ?? 0;
    const action = decideSchemaAction(stored, CURRENT_SCHEMA_VERSION);
    if (action === 'refuse') {
      throw new StorageError(
        `Stored schema version ${String(stored)} is newer than this app understands (current: ${String(CURRENT_SCHEMA_VERSION)}). Update the app before continuing — nothing has been written.`,
        undefined,
        'schema-too-new',
      );
    }
    if (action === 'migrate' && stored < 2) {
      // See #checkSchema's own v1 -> v2 comment — same gate applies here.
      const exercises =
        (await this.#readJsonFromHandle<Exercise[]>(handle, EXERCISES_FILE)) ??
        [];
      if (exercises.length > 0) {
        await this.#writeJsonToHandle(
          handle,
          EXERCISES_FILE,
          exercises.map(withTemplateDefaults),
        );
      }
    }
    if (action === 'migrate' || stored === 0) {
      await this.#writeJsonToHandle(handle, META_FILE, {
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
    }
    // Whatever `#ensureSchemaCheckedForWrite` had cached (a shadow-mode
    // run, or nothing yet) is now superseded by this real check.
    this.#schemaCheck = Promise.resolve();
  }

  async #flushOverlay(root: FileSystemDirectoryHandle): Promise<void> {
    if (this.#overlay.size === 0) return;
    const entries = [...this.#overlay];
    this.#overlay.clear();
    for (const [key, entry] of entries) {
      const isSession = key.startsWith(SESSION_KEY_PREFIX);
      const path = isSession
        ? sessionFileName(key.slice(SESSION_KEY_PREFIX.length) as SessionId)
        : key;
      const dir = isSession
        ? await root.getDirectoryHandle(SESSIONS_DIR, { create: true })
        : root;
      await this.#run(async () => {
        if (entry.kind === 'deleted') {
          try {
            await dir.removeEntry(path);
          } catch (error) {
            if (!(
              error instanceof DOMException && error.name === 'NotFoundError'
            )) {
              throw error;
            }
          }
          return;
        }
        const fileHandle = await dir.getFileHandle(path, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(entry.value));
        await writable.close();
      });
    }
  }

  /** Background permission check — never prompts (`docs/requirements.md` §7.5). */
  async #assertPermission(handle: FileSystemDirectoryHandle): Promise<void> {
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      throw new StorageError(
        'File System Access permission was lost or revoked for this directory.',
        undefined,
        'permission-lost',
      );
    }
  }

  /**
   * Write paths only. Not cached across a failed (shadow-mode) attempt —
   * `??=` only "sticks" once `#checkSchema` actually completes without
   * needing a handle it couldn't get, so a later write retries for real.
   */
  #ensureSchemaCheckedForWrite(): Promise<void> {
    this.#schemaCheck ??= this.#checkSchema().catch((error: unknown) => {
      this.#schemaCheck = undefined;
      throw error;
    });
    return this.#schemaCheck;
  }

  async #checkSchema(): Promise<void> {
    // Finish any bulk write a prior session was interrupted mid-operation
    // (spec 006 research.md §2) before doing anything else on this write
    // path — a stale journal describes writes that must land before the
    // normal schema-version read/migrate logic below is meaningful.
    await this.#replayPendingBulkWriteIfAny();
    const stored = await this.#readSchemaVersionRaw(true);
    const action = decideSchemaAction(stored, CURRENT_SCHEMA_VERSION);
    if (action === 'refuse') {
      throw new StorageError(
        `Stored schema version ${String(stored)} is newer than this app understands (current: ${String(CURRENT_SCHEMA_VERSION)}). Update the app before continuing — nothing has been written.`,
        undefined,
        'schema-too-new',
      );
    }
    if (action === 'migrate' && stored < 2) {
      // v1 -> v2 (ADR-0006): see IndexedDbStorageAdapter's own migration
      // comment — every stored Exercise gains defaultVolumeKind/trackEffort
      // with safe defaults. Gated on `stored < 2`, not just
      // `action === 'migrate'` — see IndexedDbStorageAdapter's #checkSchema
      // (Copilot review, PR #21).
      await this.#migrateExerciseTemplateDefaults();
    }
    // v2 -> v3 (ADR-0008): see IndexedDbStorageAdapter's #checkSchema —
    // nothing to backfill for this step.
    if (action === 'migrate' || stored === 0) {
      // See IndexedDbStorageAdapter's #checkSchema for the full rationale
      // — the never-initialized sentinel (stored === 0) needs the same
      // "adopt current version" write FR-007a requires, not just a real
      // 'migrate' transition.
      await this.#writeJson(META_FILE, {
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
    }
  }

  /** ADR-0006's v1->v2 migration: see the call site's comment. Delegates to
   * the shared `migrateExerciseCatalogue` (spec 006 research.md §3). */
  async #migrateExerciseTemplateDefaults(): Promise<void> {
    const exercises =
      (await this.#readJson<Exercise[]>(EXERCISES_FILE, true)) ?? [];
    if (exercises.length === 0) return;
    await this.#writeJson(
      EXERCISES_FILE,
      migrateExerciseCatalogue(exercises, 1),
    );
  }

  async #readSchemaVersionRaw(forceHandle: boolean): Promise<number> {
    const meta = await this.#readJson<{ schemaVersion: number }>(
      META_FILE,
      forceHandle,
    );
    return meta?.schemaVersion ?? 0;
  }

  // Low-level file helpers (flat, top-level files only — sessions live
  // under their own subdirectory and use their own methods below). Every
  // real write serializes its full payload before calling write() once
  // then close() — File System Access's own swap-on-close semantics mean
  // a failure before close() never touches the real file (research.md §4).

  async #getFileHandle(
    dir: FileSystemDirectoryHandle,
    name: string,
    create: boolean,
  ): Promise<FileSystemFileHandle | undefined> {
    try {
      return await dir.getFileHandle(name, { create });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Reads a JSON file directly from an already-resolved handle — no
   * overlay lookup, no `#resolveHandle` call. Used by `#readJson` once it
   * has a root, and by `#reconcileSchemaOnAcquire`, which must bypass the
   * overlay entirely (it may hold exactly the stale guess that function
   * is correcting).
   */
  async #readJsonFromHandle<T>(
    root: FileSystemDirectoryHandle,
    path: string,
  ): Promise<T | undefined> {
    const fileHandle = await this.#getFileHandle(root, path, false);
    if (!fileHandle) return undefined;
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  }

  /** Writes a JSON file directly to an already-resolved handle — see `#readJsonFromHandle`'s doc comment. */
  async #writeJsonToHandle(
    root: FileSystemDirectoryHandle,
    path: string,
    value: unknown,
  ): Promise<void> {
    await this.#run(async () => {
      const fileHandle = await root.getFileHandle(path, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(value));
      await writable.close();
    });
  }

  /** `forceHandle: false` (the default) never triggers a picker — used by every read method (FR-004a). */
  async #readJson<T>(
    path: string,
    forceHandle = false,
  ): Promise<T | undefined> {
    const overlayEntry = this.#overlay.get(path);
    if (overlayEntry) {
      return overlayEntry.kind === 'deleted'
        ? undefined
        : (overlayEntry.value as T);
    }
    const root = await this.#resolveHandle(forceHandle);
    if (!root) return undefined;
    return this.#readJsonFromHandle<T>(root, path);
  }

  async #writeJson(path: string, value: unknown): Promise<void> {
    const root = await this.#resolveHandle(true);
    if (!root) {
      this.#overlay.set(path, { kind: 'value', value });
      return;
    }
    await this.#writeJsonToHandle(root, path, value);
  }

  async #deleteFile(path: string): Promise<void> {
    const root = await this.#resolveHandle(true);
    if (!root) {
      this.#overlay.set(path, { kind: 'deleted' });
      return;
    }
    await this.#run(async () => {
      try {
        await root.removeEntry(path);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          return;
        }
        throw error;
      }
    });
  }

  /** `forceHandle: false` (the default) never triggers a picker — used by every read method. */
  async #getSessionsDir(
    forceHandle = false,
  ): Promise<FileSystemDirectoryHandle | undefined> {
    const root = await this.#resolveHandle(forceHandle);
    if (!root) return undefined;
    try {
      return await root.getDirectoryHandle(SESSIONS_DIR, { create: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return undefined;
      }
      throw error;
    }
  }

  #overlaySessionEntries(): Session[] {
    const sessions: Session[] = [];
    for (const [key, entry] of this.#overlay) {
      if (key.startsWith(SESSION_KEY_PREFIX) && entry.kind === 'value') {
        sessions.push(entry.value as Session);
      }
    }
    return sessions;
  }

  // Sessions

  async saveSession(session: Session): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    const root = await this.#resolveHandle(true);
    if (!root) {
      this.#overlay.set(`${SESSION_KEY_PREFIX}${session.id}`, {
        kind: 'value',
        value: session,
      });
      return;
    }
    await this.#run(async () => {
      const dir = await root.getDirectoryHandle(SESSIONS_DIR, {
        create: true,
      });
      const fileHandle = await dir.getFileHandle(sessionFileName(session.id), {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(session));
      await writable.close();
    });
  }

  async getSession(id: SessionId): Promise<Session | undefined> {
    const overlayEntry = this.#overlay.get(`${SESSION_KEY_PREFIX}${id}`);
    if (overlayEntry) {
      return overlayEntry.kind === 'deleted'
        ? undefined
        : (overlayEntry.value as Session);
    }
    const dir = await this.#getSessionsDir();
    if (!dir) return undefined;
    const fileHandle = await this.#getFileHandle(
      dir,
      sessionFileName(id),
      false,
    );
    if (!fileHandle) return undefined;
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text()) as Session;
  }

  async listSessions(range: DateRange): Promise<Session[]> {
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    const inRange = (s: Session): boolean => {
      const dateTime = Date.parse(s.dateTime);
      return dateTime >= from && dateTime <= to;
    };

    const handle = await this.#tryDirectoryHandle();
    if (!handle) {
      return this.#overlaySessionEntries().filter(inRange);
    }

    const dir = await this.#getSessionsDir();
    if (!dir) return [];
    const sessions: Session[] = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      const session = JSON.parse(await file.text()) as Session;
      if (inRange(session)) sessions.push(session);
    }
    return sessions;
  }

  async deleteSession(id: SessionId): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    const root = await this.#resolveHandle(true);
    if (!root) {
      this.#overlay.set(`${SESSION_KEY_PREFIX}${id}`, { kind: 'deleted' });
      return;
    }
    await this.#run(async () => {
      try {
        const dir = await root.getDirectoryHandle(SESSIONS_DIR, {
          create: false,
        });
        await dir.removeEntry(sessionFileName(id));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          return;
        }
        throw error;
      }
    });
  }

  // Exercise catalogue

  async saveExercise(exercise: Exercise): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    const exercises =
      (await this.#readJson<Exercise[]>(EXERCISES_FILE, true)) ?? [];
    const next = exercises.filter((e) => e.id !== exercise.id);
    next.push(exercise);
    await this.#writeJson(EXERCISES_FILE, next);
  }

  async getExercise(id: ExerciseId): Promise<Exercise | undefined> {
    const exercises = (await this.#readJson<Exercise[]>(EXERCISES_FILE)) ?? [];
    const exercise = exercises.find((e) => e.id === id);
    return exercise && withTemplateDefaults(exercise);
  }

  async listExercises(): Promise<Exercise[]> {
    const exercises = (await this.#readJson<Exercise[]>(EXERCISES_FILE)) ?? [];
    return exercises.map(withTemplateDefaults);
  }

  async mergeExercises(
    survivorId: ExerciseId,
    loserId: ExerciseId,
  ): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    if (survivorId === loserId) {
      throw new StorageError(
        'mergeExercises: survivorId and loserId must be distinct.',
      );
    }
    const exercises =
      (await this.#readJson<Exercise[]>(EXERCISES_FILE, true)) ?? [];
    const survivor = exercises.find((e) => e.id === survivorId);
    const loser = exercises.find((e) => e.id === loserId);
    if (!survivor || !loser) {
      throw new StorageError(
        'mergeExercises: both survivorId and loserId must resolve to an existing Exercise.',
      );
    }

    const nextExercises = exercises
      .filter((e) => e.id !== loserId)
      .map((e) =>
        e.id === survivorId
          ? { ...e, aliases: [...e.aliases, loser.canonicalName] }
          : e,
      );
    this.#tombstonedExerciseIds.add(loserId);
    await this.#writeJson(EXERCISES_FILE, nextExercises);

    for (const session of await this.listSessions({
      from: '0000-01-01',
      to: '9999-12-31',
    })) {
      if (
        !session.blocks.some((block) =>
          block.exercises.some((entry) => entry.exerciseId === loserId),
        )
      ) {
        continue;
      }
      const nextBlocks = session.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.map((entry) =>
          entry.exerciseId === loserId
            ? { ...entry, exerciseId: survivorId }
            : entry,
        ),
      }));
      await this.saveSession({ ...session, blocks: nextBlocks });
    }

    const draft = await this.#readJson<LoggingDraft>(DRAFT_FILE, true);
    if (draft && draftReferencesExercise(draft, loserId)) {
      await this.#writeJson(
        DRAFT_FILE,
        repointDraftExerciseId(draft, loserId, survivorId),
      );
    }
  }

  async deleteExerciseCascade(id: ExerciseId): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    const exercises =
      (await this.#readJson<Exercise[]>(EXERCISES_FILE, true)) ?? [];
    if (!exercises.some((e) => e.id === id)) {
      throw new StorageError(
        'deleteExerciseCascade: id must resolve to an existing Exercise.',
      );
    }
    this.#tombstonedExerciseIds.add(id);
    await this.#writeJson(
      EXERCISES_FILE,
      exercises.filter((e) => e.id !== id),
    );

    for (const session of await this.listSessions({
      from: '0000-01-01',
      to: '9999-12-31',
    })) {
      if (
        !session.blocks.some((block) =>
          block.exercises.some((entry) => entry.exerciseId === id),
        )
      ) {
        continue;
      }
      const nextBlocks = session.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.filter((entry) => entry.exerciseId !== id),
      }));
      await this.saveSession({ ...session, blocks: nextBlocks });
    }

    const draft = await this.#readJson<LoggingDraft>(DRAFT_FILE, true);
    if (draft && draftReferencesExercise(draft, id)) {
      await this.#writeJson(DRAFT_FILE, pruneDraftExerciseId(draft, id));
    }
  }

  // The logging draft

  async saveDraft(draft: LoggingDraft): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    await this.#writeJson(DRAFT_FILE, toPersistableDraft(draft));
  }

  async getDraft(): Promise<LoggingDraft | undefined> {
    return this.#readJson<LoggingDraft>(DRAFT_FILE);
  }

  async discardDraft(): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    await this.#deleteFile(DRAFT_FILE);
  }

  // Band labels

  async listBandLabels(): Promise<string[]> {
    return (await this.#readJson<string[]>(BAND_LABELS_FILE)) ?? [];
  }

  async saveBandLabels(labels: string[]): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    await this.#writeJson(BAND_LABELS_FILE, [...labels]);
  }

  // Schema version

  async getSchemaVersion(): Promise<number> {
    return this.#readSchemaVersionRaw(false);
  }

  async setSchemaVersion(version: number): Promise<void> {
    await this.#writeJson(META_FILE, { schemaVersion: version });
  }

  // Settings (spec 006 FR-001/002)

  async getSettings(): Promise<Settings | undefined> {
    return this.#readJson<Settings>(SETTINGS_FILE);
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    await this.#writeJson(SETTINGS_FILE, settings);
  }

  // Bulk atomic write (spec 006 FR-011/FR-015-016) — write-ahead journal,
  // research.md §2. Both methods force a real directory handle up front:
  // unlike the schema-check/mount-time writes the overlay mechanism exists
  // for, these two are always explicitly user-gesture-initiated (a tap on
  // "Import"/"Delete everything" in Settings), so there is always a live
  // gesture to acquire one with.

  async importBulk(input: BulkImportInput): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    const root = await this.#resolveHandle(true);
    if (!root) {
      throw new StorageError(
        'Import needs File System Access permission — try again from a direct tap on Import.',
      );
    }
    const journal: PendingBulkWrite = { kind: 'import', input };
    await this.#writeJsonToHandle(root, PENDING_BULK_WRITE_FILE, journal);
    await this.#applyBulkWriteToHandle(root, input);
    await this.#removeEntryIfPresent(root, PENDING_BULK_WRITE_FILE);
  }

  async resetToFreshInstall(seedExercises: Exercise[]): Promise<void> {
    await this.#ensureSchemaCheckedForWrite();
    const root = await this.#resolveHandle(true);
    if (!root) {
      throw new StorageError(
        'Delete everything needs File System Access permission — try again from a direct tap on Delete everything.',
      );
    }
    const journal: PendingBulkWrite = {
      kind: 'reset',
      seedExercises,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    await this.#writeJsonToHandle(root, PENDING_BULK_WRITE_FILE, journal);
    await this.#applyResetToHandle(root, journal);
    await this.#removeEntryIfPresent(root, PENDING_BULK_WRITE_FILE);
  }

  /** Replayed on the next write-path schema check if a journal is found —
   * re-applying the same target-file writes is idempotent, so this simply
   * finishes whatever `importBulk`/`resetToFreshInstall` call was cut off
   * (spec 006 research.md §2). Only reachable via a write path (this
   * adapter never acquires a handle from a read, FR-004a), same
   * documented limitation as this adapter's other migration steps. */
  async #replayPendingBulkWriteIfAny(): Promise<void> {
    const root = await this.#resolveHandle(true);
    if (!root) return;
    const pending = await this.#readJsonFromHandle<PendingBulkWrite>(
      root,
      PENDING_BULK_WRITE_FILE,
    );
    if (!pending) return;
    if (pending.kind === 'import') {
      await this.#applyBulkWriteToHandle(root, pending.input);
    } else {
      await this.#applyResetToHandle(root, pending);
    }
    await this.#removeEntryIfPresent(root, PENDING_BULK_WRITE_FILE);
  }

  async #applyBulkWriteToHandle(
    root: FileSystemDirectoryHandle,
    input: BulkImportInput,
  ): Promise<void> {
    if (input.exercises.length > 0) {
      const existing =
        (await this.#readJsonFromHandle<Exercise[]>(root, EXERCISES_FILE)) ??
        [];
      const byId = new Map(existing.map((e) => [e.id, e]));
      for (const exercise of input.exercises) byId.set(exercise.id, exercise);
      await this.#writeJsonToHandle(root, EXERCISES_FILE, [...byId.values()]);
    }
    if (input.sessions.length > 0) {
      const dir = await root.getDirectoryHandle(SESSIONS_DIR, {
        create: true,
      });
      for (const session of input.sessions) {
        await this.#run(async () => {
          const fileHandle = await dir.getFileHandle(
            sessionFileName(session.id),
            { create: true },
          );
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(session));
          await writable.close();
        });
      }
    }
    if (input.bandLabels !== undefined) {
      await this.#writeJsonToHandle(root, BAND_LABELS_FILE, [
        ...input.bandLabels,
      ]);
    }
    if (input.settings !== undefined) {
      await this.#writeJsonToHandle(root, SETTINGS_FILE, input.settings);
    }
    if (input.loggingDraft !== undefined) {
      await this.#writeJsonToHandle(
        root,
        DRAFT_FILE,
        toPersistableDraft(input.loggingDraft),
      );
    }
    await this.#writeJsonToHandle(root, META_FILE, {
      schemaVersion: input.schemaVersion,
    });
  }

  async #applyResetToHandle(
    root: FileSystemDirectoryHandle,
    payload: { seedExercises: Exercise[]; schemaVersion: number },
  ): Promise<void> {
    const sessionsDir = await this.#run(() =>
      root.getDirectoryHandle(SESSIONS_DIR, { create: true }),
    );
    const names: string[] = [];
    for await (const [name, handle] of sessionsDir.entries()) {
      if (handle.kind === 'file') names.push(name);
    }
    for (const name of names) {
      await this.#run(() => sessionsDir.removeEntry(name));
    }
    for (const key of [...this.#overlay.keys()]) {
      if (key.startsWith(SESSION_KEY_PREFIX)) this.#overlay.delete(key);
    }
    await this.#writeJsonToHandle(root, EXERCISES_FILE, payload.seedExercises);
    await this.#removeEntryIfPresent(root, DRAFT_FILE);
    await this.#writeJsonToHandle(root, BAND_LABELS_FILE, []);
    await this.#removeEntryIfPresent(root, SETTINGS_FILE);
    await this.#writeJsonToHandle(root, META_FILE, {
      schemaVersion: payload.schemaVersion,
    });
  }

  async #removeEntryIfPresent(
    root: FileSystemDirectoryHandle,
    path: string,
  ): Promise<void> {
    await this.#run(async () => {
      try {
        await root.removeEntry(path);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          return;
        }
        throw error;
      }
    });
  }

  /** Wraps every write in `StorageError`, classifying quota failures (FR-012/FR-012a). */
  async #run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof StorageError) throw error;
      const isQuotaExceeded =
        error instanceof DOMException && error.name === 'QuotaExceededError';
      throw new StorageError(
        isQuotaExceeded
          ? 'Storage quota exceeded — nothing was written.'
          : 'File System Access storage operation failed.',
        error,
        isQuotaExceeded ? 'quota-exceeded' : undefined,
      );
    }
  }
}
