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
import { migrateExerciseCatalogue } from '../application/schema-migration';
import {
  GymLogDatabase,
  DRAFT_ROW_KEY,
  BAND_LABELS_ROW_KEY,
  SETTINGS_ROW_KEY,
  SCHEMA_VERSION_ROW_KEY,
} from './indexed-db/schema';
import { CURRENT_SCHEMA_VERSION, decideSchemaAction } from './schema-version';
import {
  draftReferencesExercise,
  repointDraftExerciseId,
  pruneDraftExerciseId,
} from './draft-cascade';

/**
 * Durable `StoragePort` implementation backed by IndexedDB via Dexie
 * (ADR-0002; spec 003 FR-001). Selected by the composition root
 * (`src/presentation/main.tsx`) wherever the File System Access API is
 * unavailable — notably iOS Safari (spec 003 FR-004).
 *
 * Cascade methods (`mergeExercises`/`deleteExerciseCascade`) share the same
 * tree-walk logic `InMemoryStorageAdapter` already established
 * (spec 001/002), wrapped in a single Dexie `transaction('rw', ...)` for
 * atomicity (spec 003 FR-011, research.md §4) instead of hand-rolled
 * rollback — Dexie/IndexedDB transactions are atomic and isolated by the
 * platform itself.
 */
export class IndexedDbStorageAdapter implements StoragePort {
  readonly #db: GymLogDatabase;
  #schemaCheck: Promise<void> | undefined;

  constructor(db: GymLogDatabase = new GymLogDatabase()) {
    this.#db = db;
  }

  /**
   * FR-008/009/010: run once per adapter instance, before any other
   * storage operation. Cached as a promise so every public method can
   * `await` it cheaply without repeating the check.
   */
  #ensureSchemaChecked(): Promise<void> {
    this.#schemaCheck ??= this.#checkSchema();
    return this.#schemaCheck;
  }

  async #checkSchema(): Promise<void> {
    const stored = await this.#readSchemaVersionRaw();
    const action = decideSchemaAction(stored, CURRENT_SCHEMA_VERSION);
    if (action === 'refuse') {
      throw new StorageError(
        `Stored schema version ${String(stored)} is newer than this app understands (current: ${String(CURRENT_SCHEMA_VERSION)}). Update the app before continuing — nothing has been written.`,
        undefined,
        'schema-too-new',
      );
    }
    if (action === 'migrate' && stored < 2) {
      // v1 -> v2 (ADR-0006): every stored Exercise gains
      // defaultVolumeKind/trackEffort. Additive with safe defaults
      // (reps / effort not tracked) — no other stored shape changes, so
      // this is the whole v2 migration. Gated on `stored < 2` rather than
      // just `action === 'migrate'` — a v2 record upgrading straight to
      // v3 already has these fields, and running this unconditionally on
      // every future version bump would keep re-rewriting every Exercise
      // for a backfill it no longer needs (Copilot review, PR #21).
      await this.#migrateExerciseTemplateDefaults();
    }
    // v2 -> v3 (ADR-0008): Block.rounds was optional, and its absence in
    // every already-stored Session was itself valid v3 data — no stored
    // shape changes, so this step never had a backfill of its own to run.
    // v3 -> v4 (ADR-0013): removes `rounds` again (redundant with each
    // exercise entry's own set count). Still no backfill: a v3 record's
    // leftover `rounds` key is inert data `Block`'s own type no longer
    // declares — nothing reads it, and nothing needs to strip it either,
    // the same "additive/removal needs no data rewrite" reasoning v2 -> v3
    // itself already relied on. `docs/requirements.md` §6 still requires
    // the version bump itself for any change to a canonical persisted
    // shape, even one with no backfill of its own (Copilot review, PR #30).
    if (action === 'migrate' || stored === 0) {
      // `stored === 0` (the never-initialized sentinel, itself decided
      // as 'open' since there is nothing to migrate) still needs this
      // same write: FR-007a requires the adapter to adopt
      // CURRENT_SCHEMA_VERSION on its first real write, not leave the
      // sentinel in place forever.
      await this.setSchemaVersion(CURRENT_SCHEMA_VERSION);
    }
    // action === 'open' with stored already at CURRENT_SCHEMA_VERSION:
    // nothing to do. The 'refuse' case above already returned by
    // throwing, so every other caller of #ensureSchemaChecked may
    // proceed.
  }

  async #readSchemaVersionRaw(): Promise<number> {
    const row = await this.#db.meta.get(SCHEMA_VERSION_ROW_KEY);
    return row?.value ?? 0;
  }

  /** ADR-0006's v1->v2 migration: see the call site's comment. Delegates to
   * the shared `migrateExerciseCatalogue` (spec 006 research.md §3) rather
   * than its own copy of the backfill logic. */
  async #migrateExerciseTemplateDefaults(): Promise<void> {
    const exercises = await this.#db.exercises.toArray();
    await this.#run(() =>
      this.#db.exercises.bulkPut(migrateExerciseCatalogue(exercises, 1)),
    );
  }

  // Sessions

  async saveSession(session: Session): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() => this.#db.sessions.put(session));
  }

  async getSession(id: SessionId): Promise<Session | undefined> {
    await this.#ensureSchemaChecked();
    return this.#db.sessions.get(id);
  }

  async listSessions(range: DateRange): Promise<Session[]> {
    await this.#ensureSchemaChecked();
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    const all = await this.#db.sessions.toArray();
    return all.filter((s) => {
      const dateTime = Date.parse(s.dateTime);
      return dateTime >= from && dateTime <= to;
    });
  }

  async deleteSession(id: SessionId): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() => this.#db.sessions.delete(id));
  }

  // Exercise catalogue

  async saveExercise(exercise: Exercise): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() => this.#db.exercises.put(exercise));
  }

  async getExercise(id: ExerciseId): Promise<Exercise | undefined> {
    await this.#ensureSchemaChecked();
    return this.#db.exercises.get(id);
  }

  async listExercises(): Promise<Exercise[]> {
    await this.#ensureSchemaChecked();
    return this.#db.exercises.toArray();
  }

  async mergeExercises(
    survivorId: ExerciseId,
    loserId: ExerciseId,
  ): Promise<void> {
    await this.#ensureSchemaChecked();
    if (survivorId === loserId) {
      throw new StorageError(
        'mergeExercises: survivorId and loserId must be distinct.',
      );
    }
    await this.#run(() =>
      this.#db.transaction(
        'rw',
        [this.#db.exercises, this.#db.sessions, this.#db.draft],
        async () => {
          const survivor = await this.#db.exercises.get(survivorId);
          const loser = await this.#db.exercises.get(loserId);
          if (!survivor || !loser) {
            throw new StorageError(
              'mergeExercises: both survivorId and loserId must resolve to an existing Exercise.',
            );
          }

          await this.#db.exercises.put({
            ...survivor,
            aliases: [...survivor.aliases, loser.canonicalName],
          });
          await this.#db.exercises.delete(loserId);

          const sessions = await this.#db.sessions.toArray();
          for (const session of sessions) {
            const nextBlocks = session.blocks.map((block) => ({
              ...block,
              exercises: block.exercises.map((entry) =>
                entry.exerciseId === loserId
                  ? { ...entry, exerciseId: survivorId }
                  : entry,
              ),
            }));
            await this.#db.sessions.put({ ...session, blocks: nextBlocks });
          }

          const draftRow = await this.#db.draft.get(DRAFT_ROW_KEY);
          if (draftRow && draftReferencesExercise(draftRow.value, loserId)) {
            await this.#db.draft.put({
              key: DRAFT_ROW_KEY,
              value: repointDraftExerciseId(
                draftRow.value,
                loserId,
                survivorId,
              ),
            });
          }
        },
      ),
    );
  }

  async deleteExerciseCascade(id: ExerciseId): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() =>
      this.#db.transaction(
        'rw',
        [this.#db.exercises, this.#db.sessions, this.#db.draft],
        async () => {
          const exists = await this.#db.exercises.get(id);
          if (!exists) {
            throw new StorageError(
              'deleteExerciseCascade: id must resolve to an existing Exercise.',
            );
          }
          await this.#db.exercises.delete(id);

          const sessions = await this.#db.sessions.toArray();
          for (const session of sessions) {
            const nextBlocks = session.blocks.map((block) => ({
              ...block,
              exercises: block.exercises.filter(
                (entry) => entry.exerciseId !== id,
              ),
            }));
            await this.#db.sessions.put({ ...session, blocks: nextBlocks });
          }

          const draftRow = await this.#db.draft.get(DRAFT_ROW_KEY);
          if (draftRow && draftReferencesExercise(draftRow.value, id)) {
            await this.#db.draft.put({
              key: DRAFT_ROW_KEY,
              value: pruneDraftExerciseId(draftRow.value, id),
            });
          }
        },
      ),
    );
  }

  // The logging draft

  async saveDraft(draft: LoggingDraft): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() =>
      this.#db.draft.put({
        key: DRAFT_ROW_KEY,
        value: draft,
      }),
    );
  }

  async getDraft(): Promise<LoggingDraft | undefined> {
    await this.#ensureSchemaChecked();
    const row = await this.#db.draft.get(DRAFT_ROW_KEY);
    return row?.value;
  }

  async discardDraft(): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() => this.#db.draft.delete(DRAFT_ROW_KEY));
  }

  // Band labels

  async listBandLabels(): Promise<string[]> {
    await this.#ensureSchemaChecked();
    const row = await this.#db.bandLabels.get(BAND_LABELS_ROW_KEY);
    return row ? [...row.value] : [];
  }

  async saveBandLabels(labels: string[]): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() =>
      this.#db.bandLabels.put({ key: BAND_LABELS_ROW_KEY, value: [...labels] }),
    );
  }

  // Schema version

  async getSchemaVersion(): Promise<number> {
    return this.#readSchemaVersionRaw();
  }

  async setSchemaVersion(version: number): Promise<void> {
    await this.#run(() =>
      this.#db.meta.put({ key: SCHEMA_VERSION_ROW_KEY, value: version }),
    );
  }

  // Settings (spec 006 FR-001/002)

  async getSettings(): Promise<Settings | undefined> {
    await this.#ensureSchemaChecked();
    const row = await this.#db.settings.get(SETTINGS_ROW_KEY);
    return row?.value;
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() =>
      this.#db.settings.put({ key: SETTINGS_ROW_KEY, value: settings }),
    );
  }

  // Bulk atomic write (spec 006 FR-011/FR-015-016)

  async importBulk(input: BulkImportInput): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() =>
      this.#db.transaction(
        'rw',
        [
          this.#db.sessions,
          this.#db.exercises,
          this.#db.draft,
          this.#db.bandLabels,
          this.#db.settings,
          this.#db.meta,
        ],
        async () => {
          if (input.exercises.length > 0) {
            await this.#db.exercises.bulkPut(input.exercises);
          }
          if (input.sessions.length > 0) {
            await this.#db.sessions.bulkPut(input.sessions);
          }
          if (input.bandLabels !== undefined) {
            await this.#db.bandLabels.put({
              key: BAND_LABELS_ROW_KEY,
              value: [...input.bandLabels],
            });
          }
          if (input.settings !== undefined) {
            await this.#db.settings.put({
              key: SETTINGS_ROW_KEY,
              value: input.settings,
            });
          }
          if (input.loggingDraft !== undefined) {
            await this.#db.draft.put({
              key: DRAFT_ROW_KEY,
              value: input.loggingDraft,
            });
          }
          await this.#db.meta.put({
            key: SCHEMA_VERSION_ROW_KEY,
            value: input.schemaVersion,
          });
        },
      ),
    );
  }

  async resetToFreshInstall(seedExercises: Exercise[]): Promise<void> {
    await this.#ensureSchemaChecked();
    await this.#run(() =>
      this.#db.transaction(
        'rw',
        [
          this.#db.sessions,
          this.#db.exercises,
          this.#db.draft,
          this.#db.bandLabels,
          this.#db.settings,
          this.#db.meta,
        ],
        async () => {
          await this.#db.sessions.clear();
          await this.#db.exercises.clear();
          await this.#db.exercises.bulkPut(seedExercises);
          await this.#db.draft.delete(DRAFT_ROW_KEY);
          await this.#db.bandLabels.put({
            key: BAND_LABELS_ROW_KEY,
            value: [],
          });
          await this.#db.settings.delete(SETTINGS_ROW_KEY);
          await this.#db.meta.put({
            key: SCHEMA_VERSION_ROW_KEY,
            value: CURRENT_SCHEMA_VERSION,
          });
        },
      ),
    );
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
          : 'IndexedDB storage operation failed.',
        error,
        isQuotaExceeded ? 'quota-exceeded' : undefined,
      );
    }
  }
}
