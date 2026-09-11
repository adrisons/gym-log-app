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
  #bandLabels: string[] = [];
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

  async listBandLabels(): Promise<string[]> {
    return [...this.#bandLabels];
  }

  async saveBandLabels(labels: string[]): Promise<void> {
    this.#bandLabels = [...labels];
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
    this.#bandLabels = [];
    this.#schemaVersion = 0;
  }

  // Real nested-draft tree walk (spec 001 contracts/storage-port-extension.md
  // §1), replacing spec 002's flat `exerciseId`-convention placeholder now
  // that spec 001 owns LoggingDraft's real shape
  // (src/application/ports/logging-draft.ts).
  #referencesExercise(draft: LoggingDraft, exerciseId: ExerciseId): boolean {
    return draft.blocks.some((block) =>
      block.exercises.some((entry) => entry.exerciseId === exerciseId),
    );
  }

  /**
   * Merge repoint: every matching `DraftExerciseEntry.exerciseId` across
   * every block is repointed from `fromId` to `toId`. Sets already
   * recorded on that entry are kept unchanged — only the reference moves
   * (spec.md's clarification: "the draft's exercise entry is rewritten in
   * place... it now points at the survivor").
   */
  #repointDraftExerciseId(
    draft: LoggingDraft,
    fromId: ExerciseId,
    toId: ExerciseId,
  ): LoggingDraft {
    return {
      ...draft,
      blocks: draft.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.map((entry) =>
          entry.exerciseId === fromId ? { ...entry, exerciseId: toId } : entry,
        ),
      })),
    };
  }

  /**
   * Cascade-delete prune: every `DraftExerciseEntry` referencing
   * `exerciseId`, in every block, is removed along with its sets. A block
   * that becomes empty as a result stays in the draft — FR-017's "zero
   * blocks/entries is valid" applies to a draft, not only a submitted
   * `Session` (contracts/storage-port-extension.md §1).
   */
  #pruneDraftExerciseId(
    draft: LoggingDraft,
    exerciseId: ExerciseId,
  ): LoggingDraft {
    return {
      ...draft,
      blocks: draft.blocks.map((block) => ({
        ...block,
        exercises: block.exercises.filter(
          (entry) => entry.exerciseId !== exerciseId,
        ),
      })),
    };
  }
}
