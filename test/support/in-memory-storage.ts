import type {
  StoragePort,
  DateRange,
  LoggingDraft,
} from '../../src/application/ports/storage-port';
import type { Session } from '../../src/domain/session';
import type { Exercise } from '../../src/domain/exercise';
import type { BodyMeasurement } from '../../src/domain/body-measurement';
import type { SessionId, ExerciseId } from '../../src/domain/ids';
import { StorageError } from '../../src/application/errors';

/**
 * In-memory fake of the `StoragePort` (spec 000 FR-014; spec 002 FR-027;
 * ADR-0002's third, test-only implementation). `Map`-backed, fully
 * deterministic, no browser storage API involved. Used by every phase that
 * needs a `StoragePort` without a real adapter.
 *
 * Imported from `test/support/` — the one documented location for shared
 * test doubles (FR-015).
 */
export class InMemoryStorage implements StoragePort {
  #sessions = new Map<SessionId, Session>();
  #exercises = new Map<ExerciseId, Exercise>();
  #bodyMeasurements: BodyMeasurement[] = [];
  #draft: LoggingDraft | undefined;
  #schemaVersion = 0;

  async saveSession(session: Session): Promise<void> {
    this.#sessions.set(session.id, session);
  }

  async getSession(id: SessionId): Promise<Session | undefined> {
    return this.#sessions.get(id);
  }

  async listSessions(range: DateRange): Promise<Session[]> {
    // Compare parsed instants, not raw ISO 8601 strings: two equivalent
    // timestamps with different offsets (e.g. "20:00+02:00" vs a "Z"
    // bound) don't compare correctly as strings, which could wrongly
    // exclude an in-range session.
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    return [...this.#sessions.values()].filter((s) => {
      const dateTime = Date.parse(s.dateTime);
      return dateTime >= from && dateTime <= to;
    });
  }

  async deleteSession(id: SessionId): Promise<void> {
    this.#sessions.delete(id);
  }

  async saveExercise(exercise: Exercise): Promise<void> {
    this.#exercises.set(exercise.id, exercise);
  }

  async getExercise(id: ExerciseId): Promise<Exercise | undefined> {
    return this.#exercises.get(id);
  }

  async listExercises(): Promise<Exercise[]> {
    return [...this.#exercises.values()];
  }

  async mergeExercises(
    survivorId: ExerciseId,
    loserId: ExerciseId,
  ): Promise<void> {
    if (survivorId === loserId) {
      throw new StorageError(
        'mergeExercises: survivorId and loserId must be distinct.',
      );
    }
    const survivor = this.#exercises.get(survivorId);
    const loser = this.#exercises.get(loserId);
    if (!survivor || !loser) {
      throw new StorageError(
        'mergeExercises: both survivorId and loserId must resolve to an existing Exercise.',
      );
    }

    // Exercise-local half: keep the survivor, alias the loser's name.
    this.#exercises.set(survivorId, {
      ...survivor,
      aliases: [...survivor.aliases, loser.canonicalName],
    });
    this.#exercises.delete(loserId);

    // Cross-session half: reassign every Set reference (via its Exercise
    // entry) that pointed at the loser to the survivor.
    for (const [sessionId, session] of this.#sessions) {
      const nextBlocks = session.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.map((entry) =>
          entry.exerciseId === loserId
            ? { ...entry, exerciseId: survivorId }
            : entry,
        ),
      }));
      this.#sessions.set(sessionId, { ...session, blocks: nextBlocks });
    }

    // Repoint/remove a matching reference in the pending draft, if any.
    if (this.#draft && this.#referencesExercise(this.#draft, loserId)) {
      this.#draft = this.#repointDraftExerciseId(
        this.#draft,
        loserId,
        survivorId,
      );
    }
  }

  async deleteExerciseCascade(id: ExerciseId): Promise<void> {
    if (!this.#exercises.has(id)) {
      throw new StorageError(
        'deleteExerciseCascade: id must resolve to an existing Exercise.',
      );
    }
    this.#exercises.delete(id);

    for (const [sessionId, session] of this.#sessions) {
      const nextBlocks = session.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.filter((entry) => entry.exerciseId !== id),
      }));
      this.#sessions.set(sessionId, { ...session, blocks: nextBlocks });
    }

    // Prune a matching reference in the pending draft, if any.
    if (this.#draft && this.#referencesExercise(this.#draft, id)) {
      this.#draft = this.#pruneDraftExerciseId(this.#draft, id);
    }
  }

  async saveBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
    this.#bodyMeasurements.push(measurement);
  }

  async listBodyMeasurements(range: DateRange): Promise<BodyMeasurement[]> {
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    return this.#bodyMeasurements.filter((m) => {
      const date = Date.parse(m.date);
      return date >= from && date <= to;
    });
  }

  async saveDraft(draft: LoggingDraft): Promise<void> {
    this.#draft = draft;
  }

  async getDraft(): Promise<LoggingDraft | undefined> {
    return this.#draft;
  }

  async discardDraft(): Promise<void> {
    this.#draft = undefined;
  }

  async getSchemaVersion(): Promise<number> {
    return this.#schemaVersion;
  }

  async setSchemaVersion(version: number): Promise<void> {
    this.#schemaVersion = version;
  }

  /** Test isolation: clears all state between tests. */
  reset(): void {
    this.#sessions.clear();
    this.#exercises.clear();
    this.#bodyMeasurements = [];
    this.#draft = undefined;
    this.#schemaVersion = 0;
  }

  // The fake intentionally does not interpret LoggingDraft's shape beyond
  // what merge/cascade repointing requires (FR-025) — it only looks for an
  // `exerciseId` field at the top level, the minimal convention this
  // phase's tests exercise. Spec 001 owns the draft's real shape.
  #referencesExercise(draft: LoggingDraft, exerciseId: ExerciseId): boolean {
    return draft['exerciseId'] === exerciseId;
  }

  #repointDraftExerciseId(
    draft: LoggingDraft,
    fromId: ExerciseId,
    toId: ExerciseId,
  ): LoggingDraft {
    if (draft['exerciseId'] !== fromId) return draft;
    return { ...draft, exerciseId: toId };
  }

  #pruneDraftExerciseId(
    draft: LoggingDraft,
    exerciseId: ExerciseId,
  ): LoggingDraft | undefined {
    if (draft['exerciseId'] !== exerciseId) return draft;
    const rest: LoggingDraft = { ...draft };
    delete rest['exerciseId'];
    return rest;
  }
}
