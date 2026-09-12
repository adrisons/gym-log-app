import type {
  StoragePort,
  DateRange,
  LoggingDraft,
} from '../application/ports/storage-port';
import type { Session } from '../domain/session';
import type { Exercise } from '../domain/exercise';
import type { SessionId, ExerciseId } from '../domain/ids';
import { StorageError } from '../application/errors';

/**
 * In-memory implementation of `StoragePort` (spec 000 FR-014; spec 002
 * FR-027; ADR-0002's third implementation, alongside the two real
 * adapters). `Map`-backed, fully deterministic, no browser storage API
 * involved.
 *
 * NOT DURABLE (research.md §1, spec 001): data lives only in this
 * instance's memory and is lost on reload/close. This is a deliberate,
 * documented scope boundary — spec 001 builds and tests the logging
 * feature's application/presentation layers against this adapter, but
 * does not implement `IndexedDbStorageAdapter`/`FileSystemStorageAdapter`
 * (`docs/agent-brief.md` Phase 2). The composition root
 * (`src/presentation/main.tsx`) wires this adapter today; swapping in a
 * real, feature-detected adapter later is the only change that follow-up
 * work needs to make there (research.md §6) — everything above the port
 * is unaffected either way.
 *
 * Lives in `infrastructure/`, not `test/support/`, because
 * `src/presentation/main.tsx` (the composition root) needs a real,
 * in-`src/`-layer `StoragePort` implementation to wire — `src/` must never
 * import from `test/`. `test/support/in-memory-storage.ts` re-exports this
 * same class under its historical test-facing name (`InMemoryStorage`) so
 * every existing test keeps working unchanged; this file is the one
 * canonical implementation.
 */
export class InMemoryStorageAdapter implements StoragePort {
  #sessions = new Map<SessionId, Session>();
  #exercises = new Map<ExerciseId, Exercise>();
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
