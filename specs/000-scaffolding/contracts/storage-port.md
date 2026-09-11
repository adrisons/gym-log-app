# Contract: Storage Port (`application/ports/storage-port.ts`)

The one interface Phase 0 exposes for later phases to build against. This
is the **contract**, not the implementation. ADR-0002 fixes that it exists,
lives in `application/`, is written in domain terms, and has three
implementations (two real adapters in Phase 2, one in-memory fake in
Phase 0).

## Contract rules

1. **Vocabulary**: every method name and parameter is a domain concept
   (session, block, exercise, date range, schema version). No `table`,
   `row`, `query`, `transaction`, `store`, `handle`, `IndexedDB`,
   `FileSystem` anywhere in the signature or the doc comment.
2. **Types**: parameters and return types are `domain/` types or plain
   value objects. No `infrastructure/` type crosses this boundary. (In
   Phase 0 the `domain/` types do not exist yet, so the interface uses
   minimal placeholder shapes that Phase 1 replaces — this is expected and
   allowed.)
3. **Location**: `src/application/ports/storage-port.ts`. Imported by
   `infrastructure/` (implements) and by the composition root (wires).
   `domain/` and `presentation/` MUST NOT import it — enforced by the
   boundary rule.
4. **Async**: all methods return `Promise<…>`. Persistence confirms after
   the UI updates (constitution Principle II) — the port is the "confirm
   after" side.
5. **Failure**: methods reject with a typed application-layer error, never
   an infrastructure error object. The error policy is finalized in Phase 1;
   Phase 0 defines the error type stub.
6. **Determinism of the fake**: the in-memory implementation
   (`test/support/in-memory-storage.ts`) is fully deterministic, has a
   `reset()` for test isolation, and needs no browser API. It is importable
   from `test/support/` (the one documented doubles location, FR-015).

## Method set (Phase 0 first version — Phase 1 refines)

```
interface StoragePort {
  saveSession(session: SessionRecord): Promise<void>;
  getSession(id: SessionId): Promise<SessionRecord | undefined>;
  listSessions(range: DateRange): Promise<SessionRecord[]>;
  deleteSession(id: SessionId): Promise<void>;

  saveExercise(exercise: ExerciseRecord): Promise<void>;
  getExercise(id: ExerciseId): Promise<ExerciseRecord | undefined>;
  listExercises(): Promise<ExerciseRecord[]>;

  getSchemaVersion(): Promise<number>;
  setSchemaVersion(v: number): Promise<void>;
}
```

`SessionRecord`, `ExerciseRecord`, `SessionId`, `ExerciseId`, `DateRange`
are placeholder types in Phase 0 (`type SessionId = string`,
`type SessionRecord = { id: SessionId; [k: string]: unknown }`, …). Phase 1
replaces them with the real `docs/requirements.md` §3 entities and MAY add,
rename, or drop methods.

`exportAll` / `importAll` (FR-12, Phase 7) are **not** in the Phase 0
interface — added when that phase is specified, to avoid a stale placeholder.

## Verification (Phase 0)

- `test/unit/storage-port-fake.test.ts`: for every method on the interface,
  the in-memory fake round-trips a value (save → get, save → list,
  delete → get-returns-undefined, version set → get).
- `test/integration/harness.test.ts`: the integration harness
  (`test/support/integration-harness.ts`) wires the fake as the `StoragePort`
  at the composition seam and a test drives a save-then-read through that
  wiring — proving the harness supplies the standard composition without the
  test rebuilding it (FR-016).
- The boundary check confirms `domain/` and `presentation/` cannot import
  `application/ports/storage-port.ts`, directly or via
  `src/application/index.ts` (FR-006/FR-008).
