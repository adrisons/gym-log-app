# Contract: Storage Port (`application/ports/storage-port.ts`), finalized

Supersedes `specs/000-scaffolding/contracts/storage-port.md`'s Phase-0
version. That contract's own closing note said Phase 1 "replaces them with
the real `docs/requirements.md` §3 entities and MAY add, rename, or drop
methods" — this document is that replacement, made concrete rather than
deferred to `/speckit-plan` (spec-reviewer finding on FR-017/FR-018 of
`spec.md`: a method set punted to "adjust as needed" is not testable).

## Contract rules (carried over from spec 000, still binding)

1. **Vocabulary**: every method name and parameter is a domain concept. No
   `table`, `row`, `query`, `transaction`, `store`, `handle`, `IndexedDB`,
   `FileSystem` anywhere in the signature or doc comment.
2. **Types**: parameters and return types are `domain/` types (this spec's
   entities/value objects) or plain value objects. No `infrastructure/`
   type crosses this boundary.
3. **Location**: `src/application/ports/storage-port.ts`. Imported by
   `infrastructure/` (implements) and the composition root (wires).
   `domain/` and `presentation/` MUST NOT import it, directly or via a
   barrel — enforced by the boundary rule (spec 000 FR-005/FR-006, and the
   composition-root/barrel fixes recorded in `docs/architecture.md`).
4. **Async**: all methods return `Promise<…>` (constitution Principle II —
   the port is the "confirm after" side of an optimistic write).
5. **Failure**: methods reject with `StorageError` (`application/errors.ts`),
   never an infrastructure error object.
6. **Determinism of the fake**: `test/support/in-memory-storage.ts` stays
   fully deterministic, keeps its `reset()`, needs no browser API, and
   remains the one documented shared-doubles location (spec 000 FR-015).

## Method set (finalized)

```ts
interface StoragePort {
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
   * kept, the loser's name becomes an alias of the survivor). Irreversible
   * — no corresponding "unmerge". Rejects with StorageError if either id
   * does not resolve to an existing Exercise, or if survivorId === loserId
   * (spec-reviewer finding #7: a merge with identical or non-existent ids
   * is a rejected operation, not a silent no-op).
   */
  mergeExercises(survivorId: ExerciseId, loserId: ExerciseId): Promise<void>;

  /**
   * Deletes an Exercise and cascades: every Session's Block/Exercise
   * entry/Set that referenced it is removed too (spec 002 FR-013; spec 001
   * FR-018). Confirmation and the merge-instead offer are an
   * application/presentation-layer concern (this port has no notion of a
   * confirmation dialog) — by the time this is called, confirmation has
   * already happened. Rejects with StorageError if the id does not
   * resolve to an existing Exercise.
   */
  deleteExerciseCascade(id: ExerciseId): Promise<void>;

  // Body measurements
  saveBodyMeasurement(measurement: BodyMeasurement): Promise<void>;
  listBodyMeasurements(range: DateRange): Promise<BodyMeasurement[]>;

  // The logging draft (spec 001 FR-024) — UI/session state that must
  // still survive an app close/kill, but is explicitly NOT a Session
  // (spec 001's own Key Entities section: "not a Session... does not
  // appear where a Session would"). Kept as its own narrow surface, not
  // modeled as a partial/nullable Session, so the schema-version rule
  // (docs/requirements.md §6) never has to reason about a half-built
  // Session — the draft's own shape can evolve independently of the
  // Session schema version, per spec 001's explicit statement that losing
  // a draft to a format change is a UX regression, not history loss.
  saveDraft(draft: LoggingDraft): Promise<void>;
  getDraft(): Promise<LoggingDraft | undefined>;
  discardDraft(): Promise<void>;

  // Schema version (docs/requirements.md §6). Migrate/same/refuse logic
  // is Phase 2's job; this port only exposes the read/write seam.
  getSchemaVersion(): Promise<number>;
  setSchemaVersion(v: number): Promise<void>;
}
```

### Why `mergeExercises`/`deleteExerciseCascade` are dedicated methods, not composed from save/get/delete

Spec 000's Phase-0 placeholder only had per-record save/get/list/delete,
leaving merge and cascade-delete to be assembled by a caller issuing many
individual `saveSession` calls. Spec-reviewer's finding #2 on the draft
spec correctly identified that this leaves merge/cascade unspecified at
the contract level, even though spec 001 depends on both happening
correctly against persisted state (spec 001 FR-017/FR-018, and FR-024's
requirement that a merge/cascade-delete rewrites the pending draft too).
Making them atomic port operations means:

- The in-memory fake (and, in Phase 2, each real adapter) owns getting the
  reassignment/cascade right in one place, instead of every caller
  re-implementing "find every Set referencing this Exercise" correctly.
- A single `StorageError` failure mode for the whole operation, rather
  than a caller having to reason about partial completion across many
  separate save calls.

### `LoggingDraft`'s shape is intentionally NOT specified here

Per spec 001's own Key Entities section, the draft's representation
(in-progress date-time, partial blocks/entries/sets, load-type selections)
"is not part of the schema version and evolves independently of it." This
contract only commits to the port having a narrow, three-method surface
for it (save/get/discard) — the `LoggingDraft` type itself is an
application-layer (spec 001) concern, not a domain entity this spec
(002) defines. This resolves spec-reviewer's finding #1: the draft is
acknowledged here, at the port boundary, rather than silently absent.

## Verification

- `test/unit/storage-port-fake.test.ts`: every method above round-trips a
  real domain-shaped value through the in-memory fake — including a
  `mergeExercises` test asserting every affected Set's reference resolves
  to the survivor afterward, and a `deleteExerciseCascade` test asserting
  every dependent Block/Exercise-entry/Set is gone.
- `mergeExercises`/`deleteExerciseCascade` each get a rejection test for
  their stated failure modes (identical/non-existent ids; non-existent id)
  — the red half of spec 002's FR-020 red/green discipline, extended to
  the port level.
- `test/integration/harness.test.ts`: unchanged pattern from spec 000 —
  the harness wires the fake at the composition seam.
- The boundary check (spec 000 FR-006/FR-008, `test/boundaries/`) still
  confirms `domain/` and `presentation/` cannot import this file, directly
  or via `src/application/index.ts`.

`exportAll`/`importAll` (FR-12, a later phase) remain out of this
interface, per spec 000's original note — still true, not revisited here.
