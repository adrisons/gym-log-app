import type {
  StoragePort,
  SessionRecord,
  SessionId,
  ExerciseRecord,
  ExerciseId,
  DateRange,
} from '../../src/application/ports/storage-port';

/**
 * In-memory fake of the `StoragePort` (spec 000 FR-014; ADR-0002's third,
 * test-only implementation). `Map`-backed, fully deterministic, no browser
 * storage API involved. Used by every phase that needs a `StoragePort`
 * without a real adapter.
 *
 * Imported from `test/support/` — the one documented location for shared
 * test doubles (FR-015).
 */
export class InMemoryStorage implements StoragePort {
  #sessions = new Map<SessionId, SessionRecord>();
  #exercises = new Map<ExerciseId, ExerciseRecord>();
  #schemaVersion = 0;

  async saveSession(session: SessionRecord): Promise<void> {
    this.#sessions.set(session.id, session);
  }

  async getSession(id: SessionId): Promise<SessionRecord | undefined> {
    return this.#sessions.get(id);
  }

  async listSessions(range: DateRange): Promise<SessionRecord[]> {
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

  async saveExercise(exercise: ExerciseRecord): Promise<void> {
    this.#exercises.set(exercise.id, exercise);
  }

  async getExercise(id: ExerciseId): Promise<ExerciseRecord | undefined> {
    return this.#exercises.get(id);
  }

  async listExercises(): Promise<ExerciseRecord[]> {
    return [...this.#exercises.values()];
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
    this.#schemaVersion = 0;
  }
}
