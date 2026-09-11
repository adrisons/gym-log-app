/**
 * The storage port — the single interface the application layer states in
 * domain terms for persisting and loading canonical records (ADR-0002).
 *
 * FINALIZED (Phase 1, `specs/002-domain-and-ports`), superseding the
 * Phase-0 placeholder. Method set and rules match
 * `specs/002-domain-and-ports/contracts/storage-port.md` exactly.
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

import type { Session } from '../../domain/session';
import type { Exercise } from '../../domain/exercise';
import type { BodyMeasurement } from '../../domain/body-measurement';
import type { SessionId, ExerciseId } from '../../domain/ids';

/** A closed date-time range, both bounds inclusive, ISO 8601 strings. */
export interface DateRange {
  from: string;
  to: string;
}

/**
 * UI/session state for spec 001's "Logging draft" — explicitly NOT a
 * domain entity this spec (002) defines. Per `contracts/storage-port.md`,
 * this type exists only so `saveDraft`/`getDraft`/`discardDraft` have a
 * concrete parameter/return type the build can typecheck against; its real
 * shape (in-progress date-time, partial blocks/entries/sets, load-type
 * selections) is spec 001's own design job. Deliberately opaque and
 * extensible here — `id` is the one field this phase's fake needs to key
 * storage on; everything else is caller-defined.
 */
export interface LoggingDraft {
  id: string;
  [key: string]: unknown;
}

export interface StoragePort {
  // Sessions
  saveSession(session: Session): Promise<void>;
  getSession(id: SessionId): Promise<Session | undefined>;
  listSessions(range: DateRange): Promise<Session[]>;
  deleteSession(id: SessionId): Promise<void>;

  // Exercise catalogue
  saveExercise(exercise: Exercise): Promise<void>;
  getExercise(id: ExerciseId): Promise<Exercise | undefined>;
  listExercises(): Promise<Exercise[]>;

  /**
   * Merges `loserId` into `survivorId`: every Session's Set that (via its
   * Exercise entry) referenced `loserId` is reassigned to `survivorId`
   * (spec 002 FR-012; spec 001 FR-017 — survivor's own name/defaults are
   * kept, the loser's name becomes an alias of the survivor). Also
   * repoints or removes any matching reference in the pending
   * `LoggingDraft`, if one is stored. Irreversible — no corresponding
   * "unmerge". Rejects with `StorageError` if either id does not resolve
   * to an existing Exercise, or if `survivorId === loserId` (FR-019: a
   * merge with identical or non-existent ids is a rejected operation, not
   * a silent no-op).
   */
  mergeExercises(survivorId: ExerciseId, loserId: ExerciseId): Promise<void>;

  /**
   * Deletes an Exercise and cascades: every Session's Block/Exercise
   * entry/Set that referenced it is removed too (spec 002 FR-013; spec 001
   * FR-018). Also prunes or repoints any matching reference in the pending
   * `LoggingDraft`, if one is stored. Confirmation and the merge-instead
   * offer are an application/presentation-layer concern (this port has no
   * notion of a confirmation dialog) — by the time this is called,
   * confirmation has already happened. Rejects with `StorageError` if the
   * id does not resolve to an existing Exercise.
   */
  deleteExerciseCascade(id: ExerciseId): Promise<void>;

  // Body measurements
  saveBodyMeasurement(measurement: BodyMeasurement): Promise<void>;
  listBodyMeasurements(range: DateRange): Promise<BodyMeasurement[]>;

  // The logging draft (spec 001 FR-024) — UI/session state that must
  // still survive an app close/kill, but is explicitly NOT a Session. Kept
  // as its own narrow surface, not modeled as a partial/nullable Session,
  // so the schema-version rule (docs/requirements.md §6) never has to
  // reason about a half-built Session.
  saveDraft(draft: LoggingDraft): Promise<void>;
  getDraft(): Promise<LoggingDraft | undefined>;
  discardDraft(): Promise<void>;

  /** The schema version that travels with the data (`docs/requirements.md` §6). */
  getSchemaVersion(): Promise<number>;
  setSchemaVersion(version: number): Promise<void>;
}
