/**
 * The storage port — the single interface the application layer states in
 * domain terms for persisting and loading canonical records (ADR-0002).
 *
 * PHASE 0 NOTE: this is a first version. The `domain/` entities do not exist
 * yet (Phase 1), so the record and id types below are deliberate
 * placeholders. Phase 1 owns this interface and MAY add, rename, or remove
 * methods and replace these placeholder types with the real
 * `docs/requirements.md` §3 entities.
 *
 * Rules this interface must always respect:
 *  - Vocabulary is domain, never storage: no "table", "row", "query",
 *    "transaction", "IndexedDB", "file handle".
 *  - No `infrastructure/` type crosses this boundary.
 *  - Lives in `application/`; implemented by `infrastructure/`, wired by the
 *    composition root, never imported by `domain/` or `presentation/`
 *    (enforced by eslint-plugin-boundaries).
 *  - Every method returns a `Promise` — persistence confirms after the UI
 *    updates (constitution Principle II).
 *  - Methods reject with `StorageError` (see `../errors`), never an
 *    infrastructure error object.
 */

/** Placeholder — Phase 1 replaces with the real Session identity type. */
export type SessionId = string;

/** Placeholder — Phase 1 replaces with the real Exercise identity type. */
export type ExerciseId = string;

/**
 * Placeholder — Phase 1 replaces with the real Session entity
 * (`docs/requirements.md` §3.1).
 */
export interface SessionRecord {
  id: SessionId;
  /** ISO 8601 date-time fixed at creation (spec 001 FR-001). */
  dateTime: string;
  [key: string]: unknown;
}

/**
 * Placeholder — Phase 1 replaces with the real Exercise catalogue entry
 * (`docs/requirements.md` §3.1).
 */
export interface ExerciseRecord {
  id: ExerciseId;
  canonicalName: string;
  [key: string]: unknown;
}

/** A closed date-time range, both bounds inclusive, ISO 8601 strings. */
export interface DateRange {
  from: string;
  to: string;
}

export interface StoragePort {
  saveSession(session: SessionRecord): Promise<void>;
  getSession(id: SessionId): Promise<SessionRecord | undefined>;
  listSessions(range: DateRange): Promise<SessionRecord[]>;
  deleteSession(id: SessionId): Promise<void>;

  saveExercise(exercise: ExerciseRecord): Promise<void>;
  getExercise(id: ExerciseId): Promise<ExerciseRecord | undefined>;
  listExercises(): Promise<ExerciseRecord[]>;

  /** The schema version that travels with the data (`docs/requirements.md` §6). */
  getSchemaVersion(): Promise<number>;
  setSchemaVersion(version: number): Promise<void>;
}
