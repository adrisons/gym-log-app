---

description: "Task list for Domain Model and Ports (Phase 1, scoped)"

---

# Tasks: Domain Model and Ports

**Input**: Design documents from `specs/002-domain-and-ports/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [data-model.md](./data-model.md), [contracts/storage-port.md](./contracts/storage-port.md)

**Tests**: spec.md FR-028 explicitly requires exhaustive red/green unit tests for every domain rule and value-object variant — test tasks are included and are NOT optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## Path Conventions

Single project (`src/`, `test/` at repository root), per [plan.md](./plan.md)'s Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: nothing new to initialize — Phase 0 already set up TypeScript, Vitest, ESLint boundaries, and the `src/domain/` placeholder directory. This phase only removes the placeholder and opens the error module all entities depend on.

- [ ] T001 Remove `src/domain/placeholder.ts` (Phase 0 stand-in, no longer needed)
- [ ] T002 [P] Create `src/domain/errors.ts`: `DomainError` abstract base class, `InvalidSetError`, `InvalidBodyMeasurementError`, `ExerciseMergeError`, `ExerciseDeleteConfirmationRequiredError` (data-model.md "Domain errors")

**Checkpoint**: `src/domain/errors.ts` exists — every user story below constructs on top of it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the value objects every entity is built from (FR-007..FR-009, FR-015, FR-022). Every user story's entities reference `Load`/`Volume`/`Effort`, so these MUST exist first.

**⚠️ CRITICAL**: No entity task in Phase 3+ can begin until this phase is complete.

- [ ] T003 [P] Create `src/domain/load.ts`: the `Load` sum type (`weight` | `band` | `bodyweight` | `freeText` | `none`, discriminant field `kind`) and a `createLoad(...)` smart constructor that rejects a `bodyweight.addedOrAssistedKg` outside -300..+300 (data-model.md "Load (FR-007)"; FR-015: stored exactly as entered)
- [ ] T004 [P] Create `src/domain/volume.ts`: the `Volume` sum type (`reps` | `duration` | `distance`, discriminant field `kind`) (data-model.md "Volume (FR-008)"; FR-015)
- [ ] T005 [P] Create `src/domain/effort.ts`: the `Effort` type as the integer literal union `1 | 2 | 3 | 4 | 5`, with no "none"/absent variant (FR-009, FR-022)
- [ ] T006 [P] Add branded `SessionId`/`ExerciseId` opaque string types to `src/domain/ids.ts` (data-model.md "Identifiers")
- [ ] T007 [P] [US1] Unit test `test/unit/domain/load.test.ts`: construct all five `Load` variants; assert the type system/constructor rejects a sixth variant and an out-of-range `bodyweight.addedOrAssistedKg` (FR-007, edge case in spec.md)
- [ ] T008 [P] [US1] Unit test `test/unit/domain/volume.test.ts`: construct all three `Volume` variants (FR-008); assert two `Set`s in the same entry may use different `Volume` variants (edge case in spec.md — this assertion belongs in T018's `Set` test, cross-referenced here)

**Checkpoint**: `Load`, `Volume`, `Effort`, and both ID types exist and are unit-tested — entity work in every user story below can now proceed.

---

## Phase 3: User Story 1 - The domain model exists and is technology-free (Priority: P1) 🎯 MVP

**Goal**: every entity type (`Exercise`, `Session`, `Block`, `ExerciseEntry`, `Set`, `BodyMeasurement`) is importable from `src/domain/`, built only from the value objects above, with zero imports from `application/`, `infrastructure/`, or `presentation/`.

**Independent Test**: construct a `Session` containing a `Block` containing an `ExerciseEntry` containing `Set`s with each `Load`/`Volume` variant, with no non-domain import anywhere in the test file — the existing boundary rule (spec 000) fails the build if one sneaks in.

### Tests for User Story 1

- [ ] T009 [P] [US1] Unit test `test/unit/domain/set.test.ts` (equality/shape half only — the rejection-rule half is T019 in US2): construct a `Set` with a `Weight` load and a `Reps` volume; assert deep-equality against an independently-constructed value with the same fields (spec.md Acceptance Scenario 1.1)
- [ ] T010 [P] [US1] Unit test `test/unit/domain/session-block-entry.test.ts` (construction half only — the empty-list rule is T020 in US2): construct a `Session` with one `Block` with one `ExerciseEntry` with one `Set` of each `Load`/`Volume` variant; assert no import from `application/`, `infrastructure/`, or `presentation/` appears in the test file (grep-checked in CI per spec 000's boundary pattern)

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create `src/domain/exercise.ts`: the `Exercise` (catalogue) entity — `id`, `canonicalName`, `aliases`, `movementPattern`, `muscleGroups`, `defaultLoadType`, `unilateral`, `discipline: 'strength'` (data-model.md "Exercise (catalogue)"; FR-001)
- [ ] T012 [P] [US1] Create `src/domain/set.ts`: the `Set` entity shape — `volume?`, `load`, `effort?`, `setKind`, `completed` (data-model.md "Set"; FR-005) — construction rule enforcement is US2's job (T019)
- [ ] T013 [P] [US1] Create `src/domain/exercise-entry.ts`: the `ExerciseEntry` entity — `exerciseId` (reference by id), `notes`, `sets: Set[]` (data-model.md "Exercise entry"; FR-004)
- [ ] T014 [P] [US1] Create `src/domain/block.ts`: the `Block` entity — `name?`, `type`, `exercises: ExerciseEntry[]` (data-model.md "Block"; FR-003)
- [ ] T015 [US1] Create `src/domain/session.ts`: the `Session` entity — `id`, `dateTime`, `blocks: Block[]`, `notes`, `overallFeeling?`, `durationSeconds?`, no lifecycle field (data-model.md "Session"; FR-002) (depends on T014)
- [ ] T016 [P] [US1] Create `src/domain/body-measurement.ts`: the `BodyMeasurement` entity shape — `date`, `bodyWeightKg`, `fatPercentage?`, `musclePercentageOrMassKg?`, `notes` (data-model.md "Body measurement"; FR-006) — construction rule enforcement is US2's job (T021)
- [ ] T017 [US1] Create `src/domain/index.ts`: barrel exporting every type from T003-T006, T011-T016 as the public domain surface (depends on T003-T006, T011-T016)

**Checkpoint**: every entity and value object is constructible and technology-free. User Story 1 is independently testable and demoable.

---

## Phase 4: User Story 2 - Domain rules are enforced, not just documented (Priority: P1)

**Goal**: every rule in `docs/requirements.md` §3.3 is enforced by a thrown `DomainError`, not merely documented — a violation is rejected at construction/operation time.

**Independent Test**: for each rule in §3.3, a test that attempts the violation and asserts rejection, paired with a test that performs the valid operation and asserts success (spec.md User Story 2).

### Tests for User Story 2

⚠️ Write each test below FIRST against the not-yet-rule-enforcing entity from Phase 3, confirm it fails, then implement the corresponding task to make it pass.

- [ ] T018 [P] [US2] Add to `test/unit/domain/set.test.ts`: constructing a `Set` with `volume` absent AND `load.kind === 'none'` throws `InvalidSetError`; the same construction with either present succeeds (FR-010; red/green pair) — also assert two `Set`s in the same `ExerciseEntry` may use different `Volume` variants (edge case, cross-ref T008)
- [ ] T019 [P] [US2] Add to `test/unit/domain/session-block-entry.test.ts`: a `Block` with zero `ExerciseEntry` items and a `Session` with zero `Block`s are both valid (FR-017; green-only, no violation to reject); assert order is list-position-only — no separate `order` field is readable/settable anywhere (FR-018)
- [ ] T020 [P] [US2] Create `test/unit/domain/exercise.test.ts`: renaming an `Exercise` preserves every existing `ExerciseEntry` reference (id-based, FR-011); merging reassigns every `Set` (via its `ExerciseEntry`) to the survivor's id and retains the loser's name as an alias (FR-012); merging the same id as survivor and loser, or a nonexistent id, throws `ExerciseMergeError` (FR-019, red); a valid merge of two distinct existing ids succeeds (FR-019, green counterpart)
- [ ] T021 [P] [US2] Add to `test/unit/domain/exercise.test.ts`: deleting an `Exercise` with logged history without confirmation throws `ExerciseDeleteConfirmationRequiredError` and the thrown error/return value names merge as the alternative (FR-013, red); deleting the same exercise with confirmation succeeds (FR-013, green); deleting an `Exercise` with **no** logged history succeeds without confirmation (FR-020)
- [ ] T022 [P] [US2] Create `test/unit/domain/body-measurement.test.ts`: constructing a `BodyMeasurement` with no `bodyWeightKg` throws `InvalidBodyMeasurementError` (FR-021, red); constructing one with `bodyWeightKg` present (fat/muscle fields omitted) succeeds (FR-021, green)
- [ ] T023 [P] [US2] Add to `test/unit/domain/load.test.ts` and `effort.test.ts` (new file): assert `Load`'s `none` variant models "load doesn't apply" while `Effort` has no equivalent "none" — a `Set` with no recorded effort is represented by `Set.effort` being `undefined`, never a sentinel `Effort` value (FR-022)

### Implementation for User Story 2

- [ ] T024 [US2] Add a `createSet(...)` smart constructor to `src/domain/set.ts` enforcing FR-010 (throws `InvalidSetError` when `volume` absent and `load.kind === 'none'`) (depends on T012, T018; makes T018 pass)
- [ ] T025 [US2] Add `createBlock(...)`/`createSession(...)` smart constructors to `src/domain/block.ts`/`src/domain/session.ts` accepting empty lists (FR-017) with no separate order field on any type (FR-018) (depends on T014, T015, T019; makes T019 pass)
- [ ] T026 [US2] Add `renameExercise(...)` and `mergeExercises(...)` domain functions to `src/domain/exercise.ts`: rename updates `canonicalName` only (references stay id-based, no code change needed elsewhere — FR-011 is a property of using ids, verified not implemented); merge reassigns every `Set` reference and adds the loser's name to `aliases`, throwing `ExerciseMergeError` on same/nonexistent id (FR-012, FR-019) (depends on T011, T020; makes T020 pass)
- [ ] T027 [US2] Add a `deleteExercise(...)` domain function to `src/domain/exercise.ts`: throws `ExerciseDeleteConfirmationRequiredError` when history exists and no confirmation flag is passed; proceeds when confirmed or when no history exists (FR-013, FR-020) (depends on T011, T021; makes T021 pass)
- [ ] T028 [US2] Add a `createBodyMeasurement(...)` smart constructor to `src/domain/body-measurement.ts` enforcing FR-021 (depends on T016, T022; makes T022 pass)
- [ ] T029 [US2] Update `src/domain/index.ts` barrel to export the smart constructors and domain functions from T024-T028 (depends on T017, T024-T028)

**Checkpoint**: every §3.3 rule is enforced with a red/green pair. User Stories 1 and 2 together are independently testable — `docs/agent-brief.md`'s "complete business rules... tested without touching disk" target is met for entities/value objects/§3.3.

---

## Phase 5: User Story 3 - The storage port is finalized and the in-memory fake matches it (Priority: P1)

**Goal**: `StoragePort` matches [contracts/storage-port.md](./contracts/storage-port.md) exactly, in real entity terms, with a working in-memory fake.

**Independent Test**: run `test/unit/storage-port-fake.test.ts` against the finalized interface — every method round-trips a real domain-shaped value with no real storage API involved (spec.md User Story 3).

### Tests for User Story 3

- [ ] T030 [US3] Rewrite `test/unit/storage-port-fake.test.ts`: round-trip a `Session` with nested `Block`/`ExerciseEntry`/`Set` data through `saveSession`/`getSession` (deep-equal, FR-023; Acceptance Scenario 3.1); round-trip an `Exercise` through `saveExercise`/`getExercise`/`listExercises`; round-trip a `BodyMeasurement` through `saveBodyMeasurement`/`listBodyMeasurements` (depends on T017, T029)
- [ ] T031 [P] [US3] Add to `test/unit/storage-port-fake.test.ts`: `mergeExercises` reassigns every dependent `Set` reference and rejects same/nonexistent ids with `StorageError` (FR-019, FR-024); `deleteExerciseCascade` removes the exercise and every dependent `ExerciseEntry`/`Set` data (FR-024)
- [ ] T032 [P] [US3] Add to `test/unit/storage-port-fake.test.ts`: `saveDraft`/`getDraft`/`discardDraft` round-trip an opaque payload without the fake interpreting its shape (FR-025; Acceptance Scenario 3 equivalent)
- [ ] T033 [P] [US3] Add to `test/unit/storage-port-fake.test.ts`: `getSchemaVersion`/`setSchemaVersion` still round-trip, carried over from Phase 0 (FR-026; Acceptance Scenario 3.2)

### Implementation for User Story 3

- [ ] T034 [US3] Revise `src/application/ports/storage-port.ts` to match `contracts/storage-port.md` exactly: remove `SessionRecord`/`ExerciseRecord` placeholders, import real types from `src/domain/`, add `mergeExercises`, `deleteExerciseCascade`, `saveDraft`, `getDraft`, `discardDraft` (FR-023, FR-024, FR-025; retain `getSchemaVersion`/`setSchemaVersion`, FR-026) (depends on T017, T029)
- [ ] T035 [US3] Revise `test/support/in-memory-storage.ts` to implement the finalized `StoragePort`: `Map`-backed storage of real entities, `mergeExercises`/`deleteExerciseCascade` reassignment/cascade logic, opaque draft storage (FR-027) (depends on T034; makes T030-T033 pass)

**Checkpoint**: the storage port is finalized and fully round-trip tested. All three P1 user stories (US1, US2, US3) are complete — `specs/001-log-a-session`'s `/speckit-plan` and Phase 2 (Persistence) are both unblocked.

---

## Phase 6: User Story 4 - The seed-catalogue shape is accommodated, not populated (Priority: P2)

**Goal**: confirm the `Exercise` shape needs no "is seed" marker.

**Independent Test**: construct an `Exercise` using only fields an ordinary user-created entry would have; confirm nothing requires a seed/system-provided marker (spec.md User Story 4).

### Tests for User Story 4

- [ ] T036 [US4] Add to `test/unit/domain/exercise.test.ts`: construct an `Exercise` using only ordinary fields (no `isSeed`/`source`/similar); assert it is valid and behaves identically to any other `Exercise` in a merge/rename/delete flow (FR-016; Acceptance Scenario 4.1) (depends on T011, T026, T027)

**Checkpoint**: all four user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: verification sweeps spec.md's Success Criteria require, beyond what any single user story's tests already cover.

- [ ] T037 [P] Grep sweep confirming no `fs`, `node:fs`, `indexedDB`, or `fetch(` import appears anywhere under `test/unit/domain/` or in `test/unit/storage-port-fake.test.ts` (SC-003, FR-028)
- [ ] T038 [P] Grep sweep confirming no file under `src/domain/` imports from `application/`, `infrastructure/`, or `presentation/` (SC-001 cross-check, reinforcing the existing eslint-boundaries rule from spec 000)
- [ ] T039 Manual cross-check: every type spec 001's Key Entities section names as part of a `Session` has a corresponding `src/domain/` export; record the check inline as a spec.md SC-004 confirmation (no code change expected — a gap here would mean returning to Phase 3/4)
- [ ] T040 Run [quickstart.md](./quickstart.md) end-to-end and confirm every one of its six sections passes
- [ ] T041 Update spec.md's `**Status**` line from `Planned` to `Implemented — merged to main via PR #<N>` as part of the merging commit/PR (per `.claude/skills/sdd-workflow/SKILL.md`'s Status convention)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup (needs `src/domain/errors.ts` for nothing directly, but T001 must land first so `placeholder.ts` isn't still exporting from the directory) — BLOCKS every user story.
- **User Story 1 (Phase 3)**: depends on Foundational (needs `Load`/`Volume`/`Effort`/ids).
- **User Story 2 (Phase 4)**: depends on User Story 1 (rules are added to the entities US1 creates) — not independent of US1 in this feature, unlike the general template's assumption, because a rule cannot be enforced on a type that doesn't exist yet.
- **User Story 3 (Phase 5)**: depends on User Story 1 and User Story 2 (the port is expressed in terms of the fully rule-enforcing entities).
- **User Story 4 (Phase 6)**: depends on User Story 2 (exercises `Exercise`'s merge/rename/delete functions).
- **Polish (Phase 7)**: depends on all four user stories being complete.

### Within Each User Story

- Tests are written first and confirmed failing before their implementation task (T018 before T024, T019 before T025, etc.) — TDD per constitution Principle III.
- Value objects (Phase 2) before entities (Phase 3) before rule-enforcement (Phase 4) before the port (Phase 5).

### Parallel Opportunities

- T003, T004, T005, T006 (Phase 2 value objects/ids) — different files, no dependencies among them.
- T007, T008 (Phase 2 tests) — different files.
- T009, T010 (US1 tests) — different files.
- T011, T012, T013, T014, T016 (US1 entities) — different files; T015 (Session) depends on T014 (Block) so is not parallel with it.
- T018-T023 (US2 tests) — different files (T018/T019 touch files T009/T010 already created, but as additions in a different section — treat as sequential within those two files; T020-T023 are new files, parallel with each other and with T018/T019).
- T031, T032, T033 (US3 additional fake tests) — same file (`storage-port-fake.test.ts`) as T030 but different describe blocks; safe to write in sequence within one PR, not meaningfully parallelizable across agents.
- T037, T038 (Polish grep sweeps) — independent checks.

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Create src/domain/load.ts: the Load sum type..."
Task: "Create src/domain/volume.ts: the Volume sum type..."
Task: "Create src/domain/effort.ts: the Effort type..."
Task: "Add branded SessionId/ExerciseId opaque string types to src/domain/ids.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1, and US2 depends on US1's types)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (value objects + ids) — blocks everything.
3. Complete Phase 3: User Story 1 (entities, unenforced).
4. Complete Phase 4: User Story 2 (rules enforced) — **this is the actual MVP boundary**: `docs/agent-brief.md`'s Phase 1 target ("complete business rules... tested without touching disk") is met here, before the storage port exists.
5. **STOP and VALIDATE**: run `test/unit/domain/` — all green, all rules covered red+green.

### Incremental Delivery

1. Setup + Foundational → value objects ready.
2. US1 → entities constructible (not yet rule-enforcing) → not independently shippable alone (spec.md frames US1 and US2 as inseparable in practice — US1's own acceptance scenarios need the types, but the business-rules deliverable needs US2 too).
3. US1 + US2 → domain layer complete and rule-enforcing → **this is the meaningful stopping point** for `specs/001-log-a-session` to start importing types (though it still needs US3's port to persist anything in a fake).
4. + US3 → storage port finalized → Phase 2 (Persistence) and spec 001's `/speckit-plan` both fully unblocked.
5. + US4 → seed-catalogue shape confirmed (cheap, low-risk addition).
6. + Polish → done.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Unlike the general template, US1 and US2 are not independently shippable from each other in this feature — US1 without US2 leaves every domain rule unenforced, which spec.md's own Success Criteria (SC-002) treats as incomplete. Treat US1+US2 as one combined MVP increment.
- Verify each red test fails against the pre-implementation entity before writing the task that makes it pass.
- Commit after each phase checkpoint, not after every single task — this project's PR/commit conventions favor one concern per commit (`commit-and-pr-conventions` skill), and a phase checkpoint is the natural "one concern" boundary here.
- Avoid: a domain rule implemented without its red/green pair (FR-028 requires both); a `Set`/`BodyMeasurement` construction path that bypasses the smart constructor.
