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
import type { SessionId, ExerciseId } from '../../domain/ids';
import type { LoggingDraft } from './logging-draft';
import type { Settings } from './settings';
import type { StorageStatus } from './storage-status';

/** A closed date-time range, both bounds inclusive, ISO 8601 strings. */
export interface DateRange {
  from: string;
  to: string;
}

/**
 * UI/session state for spec 001's "Logging draft" — explicitly NOT a
 * domain entity spec 002 defines. Real shape defined in
 * `./logging-draft.ts` (`specs/001-log-a-session/data-model.md`
 * "LoggingDraft") — kept in `application/ports/`, not
 * `application/logging/`, so this file can reference it without an
 * `application-ports` → `application` import (`docs/architecture.md`'s
 * table only allows `application-ports` → `domain`); re-exported here as
 * the port's own vocabulary for it.
 */
export type { LoggingDraft };

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

  /**
   * The user's own preferences (spec 006 FR-001/002). `undefined` means no
   * Settings record has ever been saved on this device — mirrors
   * `getDraft()`'s presence contract exactly (not a canonical entity,
   * D14; see `./settings.ts`). Application code that wants an
   * always-defined `Settings` applies `withSettingsDefaults()` over this
   * raw result rather than the port doing so itself, so export/import
   * (FR-010) can tell "never saved" from "saved with default values"
   * apart.
   */
  getSettings(): Promise<Settings | undefined>;
  saveSettings(settings: Settings): Promise<void>;

  /**
   * Atomically applies a multi-record import (spec 006 FR-011): either
   * every one of `input`'s writes lands, or — if interrupted — none of
   * them is left half-applied. `sessions`/`exercises` are upserted by id
   * (added if new, replaced if an existing id matches); `settings`/
   * `loggingDraft` each replace the device's own singleton
   * record when present in `input` and are left completely untouched when
   * absent. `schemaVersion` becomes the new stored schema version (the
   * caller has already migrated `input`'s data to it, spec 006 FR-012 —
   * this method performs no migration of its own).
   */
  importBulk(input: BulkImportInput): Promise<void>;

  /**
   * Atomically resets the device to a fresh-install state (spec 006
   * FR-015/016): every Session gone, the Exercise catalogue replaced with
   * exactly `seedExercises`, the draft discarded,
   * Settings cleared (a later `getSettings()` returns `undefined`,
   * same as a genuine fresh install), and the stored schema version set to
   * `CURRENT_SCHEMA_VERSION` (`src/infrastructure/schema-version.ts` — the
   * caller passes the concrete number, this port has no notion of that
   * constant). Same all-or-nothing guarantee as `importBulk`.
   */
  resetToFreshInstall(seedExercises: Exercise[]): Promise<void>;

  /**
   * Read-only, derived description of which adapter (ADR-0002) is active
   * and, for the File System Access adapter, the chosen folder's display
   * name and whether its permission is still valid (spec 009
   * FR-006-009). Never triggers a picker or a permission prompt — mirrors
   * every other read method's FR-004a discipline. Never throws for the
   * "permission lost" case; that state is reported via the return
   * value's `permission` field, not a rejection.
   */
  getStorageStatus(): Promise<StorageStatus>;

  /**
   * Re-requests permission for the File System Access adapter's
   * already-chosen folder (spec 009 FR-017) — the one deliberate
   * exception to "background code checks permission and never prompts"
   * (`docs/requirements.md` §7.5), since this method is only ever called
   * from a live user gesture (a Settings-screen button tap). Never
   * offers to choose a *different* folder. A no-op, resolving
   * immediately, on the IndexedDB and in-memory adapters (there is
   * nothing to reconfirm). Rejects with `StorageError` (existing
   * `'permission-lost'` cause) if the user declines the re-request.
   */
  reconfirmFileSystemAccess(): Promise<void>;
}

/** Input to `StoragePort.importBulk` (spec 006 contracts/storage-port-additions.md). */
export interface BulkImportInput {
  sessions: Session[];
  exercises: Exercise[];
  settings?: Settings;
  loggingDraft?: LoggingDraft;
  schemaVersion: number;
}
