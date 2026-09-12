import type {
  StoragePort,
  DateRange,
  LoggingDraft,
} from '../application/ports/storage-port';
import type { Session } from '../domain/session';
import type { Exercise } from '../domain/exercise';
import type { SessionId, ExerciseId } from '../domain/ids';
import { StorageError } from '../application/errors';
import {
  SESSIONS_DIR,
  EXERCISES_FILE,
  DRAFT_FILE,
  BAND_LABELS_FILE,
  META_FILE,
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
 * ADR-0006's v1->v2 backfill, applied wherever an `Exercise` crosses this
 * adapter's boundary — not only inside `#migrateExerciseTemplateDefaults`.
 * This adapter's schema check only runs on a write path (the doc comment
 * above), so `getExercise`/`listExercises` can otherwise hand back a
 * pre-migration v1 record whose `defaultVolumeKind`/`trackEffort` are
 * missing; a caller that then round-trips that record through
 * `saveExercise` (e.g. `renameExerciseWithCollisionCheck`) would have its
 * own write's schema-check migration immediately overwritten by that
 * stale, still-v1-shaped object — permanently, since the stored version
 * is already 2 by the time that happens. Applying the same defaults on
 * every read closes that gap at the source.
 */
function withTemplateDefaults(exercise: Exercise): Exercise {
  return {
    ...exercise,
    defaultVolumeKind: exercise.defaultVolumeKind ?? 'reps',
    trackEffort: exercise.trackEffort ?? false,
  };
}

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
 * requires a live user gesture, but this app's very first write (an empty
 * `LoggingDraft` auto-created and saved the instant the logging screen
 * opens — spec 001 `openLoggingForm`) happens on mount, before the user
 * has done anything to click. Rather than reject that write (which would
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
    await this.#db.fileSystemHandle.put({
      key: FILE_SYSTEM_HANDLE_ROW_KEY,
      value: handle,
    });
    this.#root = handle;
    await this.#flushOverlay(handle);
    return handle;
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
    const stored = await this.#readSchemaVersionRaw(true);
    const action = decideSchemaAction(stored, CURRENT_SCHEMA_VERSION);
    if (action === 'refuse') {
      throw new StorageError(
        `Stored schema version ${String(stored)} is newer than this app understands (current: ${String(CURRENT_SCHEMA_VERSION)}). Update the app before continuing — nothing has been written.`,
        undefined,
        'schema-too-new',
      );
    }
    if (action === 'migrate') {
      // v1 -> v2 (ADR-0006): see IndexedDbStorageAdapter's own migration
      // comment — every stored Exercise gains defaultVolumeKind/trackEffort
      // with safe defaults.
      await this.#migrateExerciseTemplateDefaults();
    }
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

  /** ADR-0006's v1->v2 migration: see the call site's comment. */
  async #migrateExerciseTemplateDefaults(): Promise<void> {
    const exercises =
      (await this.#readJson<Exercise[]>(EXERCISES_FILE, true)) ?? [];
    if (exercises.length === 0) return;
    await this.#writeJson(EXERCISES_FILE, exercises.map(withTemplateDefaults));
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
    const fileHandle = await this.#getFileHandle(root, path, false);
    if (!fileHandle) return undefined;
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  }

  async #writeJson(path: string, value: unknown): Promise<void> {
    const root = await this.#resolveHandle(true);
    if (!root) {
      this.#overlay.set(path, { kind: 'value', value });
      return;
    }
    await this.#run(async () => {
      const fileHandle = await root.getFileHandle(path, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(value));
      await writable.close();
    });
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
    await this.#writeJson(DRAFT_FILE, draft);
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
