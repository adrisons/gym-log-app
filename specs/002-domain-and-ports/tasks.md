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

- [x] T001 Remove `src/domain/placeholder.ts` (Phase 0 stand-in, no longer needed)
- [x] T002 [P] Create `src/domain/errors.ts`: `DomainError` abstract base class, `InvalidSetError`, `InvalidLoadError`, `InvalidVolumeError`, `InvalidBodyMeasurementError`, `ExerciseMergeError`, `ExerciseDeleteConfirmationRequiredError` (data-model.md "Domain errors", extended per T003/T004's scope)

**Checkpoint**: `src/domain/errors.ts` exists — every user story below constructs on top of it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the value objects every entity is built from (FR-007..FR-009, FR-015, FR-022). Every user story's entities reference `Load`/`Volume`/`Effort`, so these MUST exist first.

**⚠️ CRITICAL**: No entity task in Phase 3+ can begin until this phase is complete.

- [x] T003 [P] Create `src/domain/load.ts`: the `Load` sum type (`weight` | `band` | `bodyweight` | `freeText` | `none`, discriminant field `kind`) and a `createLoad(...)` smart constructor — the only supported way to produce a `Load` value (the exported union type itself is structural and, like any TypeScript interface, cannot by itself prevent a caller from building an object literal directly instead of calling the constructor; treat bypassing `createLoad` as a code-review-enforced convention documented in `src/domain/load.ts`'s own doc comment, the same boundary `exercise.ts`'s smart constructors rely on). `createLoad` throws `InvalidLoadError` when `bodyweight.addedOrAssistedKg` is outside -300..+300, and canonicalizes a `bodyweight` component of exactly `0` to `addedOrAssistedKg: undefined` (spec 001 FR-014 precedent: "0 meaning no component" is one representation, not two) (data-model.md "Load (FR-007)"; FR-015: stored exactly as entered otherwise)
- [x] T004 [P] Create `src/domain/volume.ts`: the `Volume` sum type (`reps` | `duration` | `distance`, discriminant field `kind`) and a `createVolume(...)` smart constructor that throws a new `InvalidVolumeError` (add to T002's list in `src/domain/errors.ts`) when `reps.count` is not a positive integer — `Duration`/`Distance` remain unrestricted decimals (FR-008: "Reps (integer)"; data-model.md "Volume (FR-008)"; FR-015)
- [x] T005 [P] Create `src/domain/effort.ts`: the `Effort` type as the integer literal union `1 | 2 | 3 | 4 | 5`, with no "none"/absent variant (FR-009, FR-022)
- [x] T006 [P] Add branded `SessionId`/`ExerciseId` opaque string types to `src/domain/ids.ts` (data-model.md "Identifiers")
- [x] T007 [P] [US1] Unit test `test/unit/domain/load.test.ts`: construct all five `Load` variants via `createLoad`; assert `createLoad` throws `InvalidLoadError` for an out-of-range `bodyweight.addedOrAssistedKg` and canonicalizes `addedOrAssistedKg: 0` the same as `undefined`; construct a `Weight` with a decimal value (e.g. `1.2` kg) via `createLoad` and assert the stored value is unchanged — no rounding, no unit conversion. (A compile-time check that the `Load` union type itself rejects a sixth variant, e.g. a `// @ts-expect-error` fixture, is a separate concern from this runtime test — track it as part of implementing T003, not asserted here since Vitest cannot observe type-level rejection.) (FR-007, FR-015, edge case in spec.md)
- [x] T008 [P] [US1] Unit test `test/unit/domain/volume.test.ts`: construct all three `Volume` variants via `createVolume`; assert `createVolume` throws `InvalidVolumeError` for a non-integer `reps.count` (e.g. `1.5`) (FR-008); construct a `Duration`/`Distance` with a decimal value and assert it is stored unchanged (FR-015); assert two `Set`s in the same entry may use different `Volume` variants (edge case in spec.md — this assertion belongs in T018's `Set` test, cross-referenced here)

**Checkpoint**: `Load`, `Volume`, `Effort`, and both ID types exist and are unit-tested — entity work in every user story below can now proceed.

---

## Phase 3: User Story 1 - The domain model exists and is technology-free (Priority: P1) 🎯 MVP

**Goal**: every entity type (`Exercise`, `Session`, `Block`, `ExerciseEntry`, `Set`, `BodyMeasurement`) is importable from `src/domain/`, built only from the value objects above, with zero imports from `application/`, `infrastructure/`, or `presentation/`.

**Independent Test**: construct a `Session` containing a `Block` containing an `ExerciseEntry` containing `Set`s with each `Load`/`Volume` variant, with no non-domain import anywhere in the test file — the existing boundary rule (spec 000) fails the build if one sneaks in.

### Tests for User Story 1

- [x] T009 [P] [US1] Unit test `test/unit/domain/set.test.ts` (equality/shape half only — the rejection-rule half is T018 in US2): construct a `Set` with a `Weight` load and a `Reps` volume; assert deep-equality against an independently-constructed value with the same fields (spec.md Acceptance Scenario 1.1)
- [x] T010 [P] [US1] Unit test `test/unit/domain/session-block-entry.test.ts` (construction half only — the empty-list rule is T019 in US2): construct a `Session` with one `Block` with one `ExerciseEntry` with one `Set` of each `Load`/`Volume` variant; assert no import from `application/`, `infrastructure/`, or `presentation/` appears in the test file (grep-checked in CI per spec 000's boundary pattern)

### Implementation for User Story 1

- [x] T011 [P] [US1] Create `src/domain/exercise.ts`: the `Exercise` (catalogue) entity — `id`, `canonicalName`, `aliases`, `movementPattern?`, `muscleGroups?` (both optional, `docs/requirements.md` §3.1), `defaultLoadType`, `unilateral`, `discipline: 'Strength'` (canonical casing, `docs/requirements.md` §1.4/§3.1) (data-model.md "Exercise (catalogue)"; FR-001)
- [x] T012 [P] [US1] Create `src/domain/set.ts`: the `Set` entity shape — `volume?`, `load`, `effort?`, `setKind`, `completed` (data-model.md "Set"; FR-005) — construction rule enforcement is US2's job (T019)
- [x] T013 [P] [US1] Create `src/domain/exercise-entry.ts`: the `ExerciseEntry` entity — `exerciseId` (reference by id), `notes`, `sets: Set[]` (data-model.md "Exercise entry"; FR-004)
- [x] T014 [P] [US1] Create `src/domain/block.ts`: the `Block` entity — `name?`, `type`, `exercises: ExerciseEntry[]` (data-model.md "Block"; FR-003)
- [x] T015 [US1] Create `src/domain/session.ts`: the `Session` entity — `id`, `dateTime`, `blocks: Block[]`, `notes`, `overallFeeling?`, `durationSeconds?`, no lifecycle field (data-model.md "Session"; FR-002) (depends on T014)
- [x] T016 [P] [US1] Create `src/domain/body-measurement.ts`: the `BodyMeasurement` entity shape — `date`, `bodyWeightKg`, `fatPercentage?`, `musclePercentageOrMassKg?`, `notes` (data-model.md "Body measurement"; FR-006) — construction rule enforcement is US2's job (T021)
- [x] T017 [US1] Create `src/domain/index.ts`: barrel exporting every type from T003-T006, T011-T016 as the public domain surface (depends on T003-T006, T011-T016)

**Checkpoint**: every entity and value object is constructible and technology-free. User Story 1 is independently testable and demoable.

---

## Phase 4: User Story 2 - Domain rules are enforced, not just documented (Priority: P1)

**Goal**: every rule in `docs/requirements.md` §3.3 is enforced by a thrown `DomainError`, not merely documented — a violation is rejected at construction/operation time.

**Independent Test**: for each rule in §3.3, a test that attempts the violation and asserts rejection, paired with a test that performs the valid operation and asserts success (spec.md User Story 2).

### Tests for User Story 2

⚠️ Write each test below FIRST against the not-yet-rule-enforcing entity from Phase 3, confirm it fails, then implement the corresponding task to make it pass.

- [x] T018 [P] [US2] Add to `test/unit/domain/set.test.ts`: constructing a `Set` with `volume` absent AND `load.kind === 'none'` throws `InvalidSetError`; the same construction with either present succeeds (FR-010; red/green pair) — also assert two `Set`s in the same `ExerciseEntry` may use different `Volume` variants (edge case, cross-ref T008)
- [x] T019 [US2] Add to `test/unit/domain/session-block-entry.test.ts`: a `Block` with zero `ExerciseEntry` items and a `Session` with zero `Block`s are both valid (FR-017; green-only, no violation to reject); assert order is list-position-only — no separate `order` field is readable/settable anywhere (FR-018). Not parallel with T023a — same file.
- [x] T020 [US2] Create `test/unit/domain/exercise.test.ts`: renaming an `Exercise` preserves every existing `ExerciseEntry` reference (id-based, FR-011); `mergeExerciseIdentities` on two distinct existing ids returns the survivor with the loser's name appended to `aliases` (FR-012's `Exercise`-local half); merging the same id as survivor and loser, or a nonexistent id, throws `ExerciseMergeError` (FR-019, red). The cross-session `Set`-reassignment half of FR-012 is NOT asserted here (no session data available to an `Exercise`-only test) — it is asserted in US3's T031 against the storage-port fake instead; see T026's scope note. Not parallel with T021/T036 — same file.
- [x] T021 [US2] Add to `test/unit/domain/exercise.test.ts`: deleting an `Exercise` with logged history without confirmation throws `ExerciseDeleteConfirmationRequiredError` (a stable, named error — no separate message/payload contract needed since the error's type alone signals "merge is the alternative"; the caller/UI layer maps that type to the merge prompt) and asserts on it directly (FR-013, red); deleting the same exercise with confirmation succeeds (FR-013, green); deleting an `Exercise` with **no** logged history succeeds without confirmation (FR-020). Not parallel with T020/T036 — same file.
- [x] T022 [P] [US2] Create `test/unit/domain/body-measurement.test.ts`: constructing a `BodyMeasurement` with no `bodyWeightKg` throws `InvalidBodyMeasurementError` (FR-021, red); constructing one with `bodyWeightKg` present (fat/muscle fields omitted) succeeds (FR-021, green)
- [x] T023 [P] [US2] Create `test/unit/domain/effort.test.ts` (also touches `test/unit/domain/load.test.ts`): assert `Load`'s `none` variant models "load doesn't apply" while `Effort` has no equivalent "none" — a `Set` with no recorded effort is represented by `Set.effort` being `undefined`, never a sentinel `Effort` value (FR-022)
- [x] T023a [US2] Add to `test/unit/domain/session-block-entry.test.ts`: assert `src/domain/index.ts`'s public surface exposes no runtime constructor or function that creates an `ExerciseEntry` (or adds one to a `Block`) except by being passed an explicit, caller-supplied `ExerciseEntry` value — i.e. there is no "auto-add an entry for every catalogue exercise" or similar implicit-population API (FR-014). This is a runtime-API-surface assertion (enumerate `Object.keys` of the domain barrel and confirm no matching factory exists), not a compile-time type-erasure proof — it documents/locks the absence at the exported-function level, which is what a caller can actually invoke; it does not by itself prove no *unexported* internal helper could later be exposed by mistake (that stays covered by code review, not this test). Not parallel with T019 — same file.

### Implementation for User Story 2

- [x] T024 [US2] Add a `createSet(...)` smart constructor to `src/domain/set.ts` enforcing FR-010 (throws `InvalidSetError` when `volume` absent and `load.kind === 'none'`) (depends on T012, T018; makes T018 pass)
- [x] T025 [US2] Add `createBlock(...)`/`createSession(...)` smart constructors to `src/domain/block.ts`/`src/domain/session.ts` accepting empty lists (FR-017) with no separate order field on any type (FR-018) (depends on T014, T015, T019; makes T019 pass)
- [x] T026 [US2] Add `renameExercise(...)` and a pure `mergeExerciseIdentities(...)` helper to `src/domain/exercise.ts`. Scope note: `Exercise` alone has no access to the `Session`/`ExerciseEntry` data that reference it, so the *reassignment* of every dependent `Set` (FR-012's full effect) cannot be performed by an `exercise.ts` function acting on an `Exercise` value alone — it needs the full set of sessions, which only the storage layer holds. `mergeExerciseIdentities(...)` therefore does only the `Exercise`-local part: validates the survivor/loser ids are distinct and both resolve (throwing `ExerciseMergeError` otherwise, FR-019) and returns the survivor with the loser's name appended to `aliases`. The cross-session `Set`-reference rewrite itself is `mergeExercises` on `StoragePort` (T034/T035, US3) — T020's merge test asserts only the `Exercise`-local half here; the reassignment half is asserted by T031 in US3 against the fake, which has the necessary session access. Rename updates `canonicalName` only — no other code path needs to change since references stay id-based (FR-011). (depends on T011, T020; makes T020's rename+alias assertions pass; T020's reassignment assertion is satisfied only once T031/T035 land — note this in T020 when writing it)
- [x] T027 [US2] Add a `deleteExercise(...)` domain function to `src/domain/exercise.ts`: throws `ExerciseDeleteConfirmationRequiredError` when history exists and no confirmation flag is passed; proceeds when confirmed or when no history exists (FR-013, FR-020) (depends on T011, T021; makes T021 pass)
- [x] T028 [US2] Add a `createBodyMeasurement(...)` smart constructor to `src/domain/body-measurement.ts` enforcing FR-021 (depends on T016, T022; makes T022 pass)
- [x] T029 [US2] Update `src/domain/index.ts` barrel to export the smart constructors and domain functions from T024-T028 (depends on T017, T024-T028)

**Checkpoint**: every §3.3 rule is enforced with a red/green pair. User Stories 1 and 2 together are independently testable — `docs/agent-brief.md`'s "complete business rules... tested without touching disk" target is met for entities/value objects/§3.3.

---

## Phase 5: User Story 3 - The storage port is finalized and the in-memory fake matches it (Priority: P1)

**Goal**: `StoragePort` matches [contracts/storage-port.md](./contracts/storage-port.md) exactly, in real entity terms, with a working in-memory fake.

**Independent Test**: run `test/unit/storage-port-fake.test.ts` against the finalized interface — every method round-trips a real domain-shaped value with no real storage API involved (spec.md User Story 3).

### Tests for User Story 3

**Note on sequencing**: T030-T033 below describe fake-fixture round-trip *tests*, but they exercise methods (`saveBodyMeasurement`, `mergeExercises`, `deleteExerciseCascade`, `saveDraft`/`getDraft`/`discardDraft`) that don't exist on the Phase-0 `StoragePort` yet. Per this project's TDD convention (constitution Principle III), write T030-T033 first against the current interface — they will fail to *typecheck*, which is the expected red state here (not a runtime assertion failure) — then implement T034 (the interface) before T035 (the fake), which is what actually turns them green. List them in test-first order for traceability, but do not attempt to run T030-T033 before T034 exists.

### Tests for User Story 3 (continued)

- [x] T030 [US3] Rewrite `test/unit/storage-port-fake.test.ts`: round-trip a `Session` with nested `Block`/`ExerciseEntry`/`Set` data through `saveSession`/`getSession` (deep-equal, FR-023; Acceptance Scenario 3.1); round-trip an `Exercise` through `saveExercise`/`getExercise`/`listExercises`; round-trip a `BodyMeasurement` through `saveBodyMeasurement`/`listBodyMeasurements`. Written against the finalized interface (T034) — depends on T017, T029, **and T034** (typechecks only once T034 lands, per the sequencing note above).
- [x] T031 [US3] Add to `test/unit/storage-port-fake.test.ts`: `mergeExercises` reassigns every dependent `Set` reference (the cross-session half of FR-012 that T020 in US2 could not test — see T026's scope note) and also repoints/removes any matching reference in the pending `LoggingDraft` if one is stored (`contracts/storage-port.md`'s merge/cascade-must-touch-the-draft rule); rejects same/nonexistent ids with `StorageError` (FR-019, FR-024). `deleteExerciseCascade` removes the exercise and every dependent `ExerciseEntry`/`Set` data, also pruning/repointing a matching draft reference, and rejects a nonexistent id with `StorageError` (FR-024). Not parallel with T030/T032/T033 — same file; depends on T034.
- [x] T032 [US3] Add to `test/unit/storage-port-fake.test.ts`: `saveDraft`/`getDraft`/`discardDraft` round-trip an opaque payload of the minimal `LoggingDraft` shape from T034a below, without the fake interpreting its shape beyond what merge/cascade repointing (T031) requires (FR-025; Acceptance Scenario 3 equivalent). Not parallel with T030/T031/T033 — same file; depends on T034.
- [x] T033 [US3] Add to `test/unit/storage-port-fake.test.ts`: `getSchemaVersion`/`setSchemaVersion` still round-trip, carried over from Phase 0 (FR-026; Acceptance Scenario 3.2). Not parallel with T030/T031/T032 — same file; depends on T034.

### Implementation for User Story 3

- [x] T034 [US3] Revise `src/application/ports/storage-port.ts` to match `contracts/storage-port.md` exactly: remove `SessionRecord`/`ExerciseRecord` placeholders, import real types from `src/domain/`, add `mergeExercises`, `deleteExerciseCascade`, `saveDraft`, `getDraft`, `discardDraft` (FR-023, FR-024, FR-025; retain `getSchemaVersion`/`setSchemaVersion`, FR-026) (depends on T017, T029)
- [x] T034a [US3] Define a minimal `LoggingDraft` type for this phase's port signatures only: an opaque, intentionally under-specified shape (e.g. `interface LoggingDraft { id: string; [key: string]: unknown }` or equivalent) living alongside `storage-port.ts` — per FR-025/`contracts/storage-port.md`, this spec does NOT design the draft's real shape (that's spec 001's job); this task exists only so `saveDraft`/`getDraft`/`discardDraft` have a concrete parameter/return type the build can typecheck against, not a design decision about the draft's eventual contents. (depends on T034)
- [x] T035 [US3] Revise `test/support/in-memory-storage.ts` to implement the finalized `StoragePort`: `Map`-backed storage of real entities; `mergeExercises` reassignment across every stored `Session`'s `ExerciseEntry`s plus draft repointing; `deleteExerciseCascade` cascade-delete across sessions plus draft pruning; opaque draft storage keyed by the `LoggingDraft.id` from T034a (FR-027) (depends on T034, T034a; makes T030-T033 pass)

**Checkpoint**: the storage port is finalized and fully round-trip tested. All three P1 user stories (US1, US2, US3) are complete — `specs/001-log-a-session`'s `/speckit-plan` and Phase 2 (Persistence) are both unblocked.

---

## Phase 6: User Story 4 - The seed-catalogue shape is accommodated, not populated (Priority: P2)

**Goal**: confirm the `Exercise` shape needs no "is seed" marker.

**Independent Test**: construct an `Exercise` using only fields an ordinary user-created entry would have; confirm nothing requires a seed/system-provided marker (spec.md User Story 4).

### Tests for User Story 4

- [x] T036 [US4] Add to `test/unit/domain/exercise.test.ts`: construct an `Exercise` using only ordinary fields (no `isSeed`/`source`/similar); assert it is valid and behaves identically to any other `Exercise` in a merge/rename/delete flow (FR-016; Acceptance Scenario 4.1) (depends on T011, T026, T027)

**Checkpoint**: all four user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: verification sweeps spec.md's Success Criteria require, beyond what any single user story's tests already cover.

- [x] T037 [P] Grep sweep confirming no `fs`, `node:fs`, `indexedDB`, or `fetch(` import appears anywhere under `test/unit/domain/` or in `test/unit/storage-port-fake.test.ts` (SC-003, FR-028)
- [x] T038 [P] Grep sweep confirming no file under `src/domain/` imports from `application/`, `infrastructure/`, or `presentation/` (SC-001 cross-check, reinforcing the existing eslint-boundaries rule from spec 000)
- [x] T039 Manual cross-check: every type spec 001's Key Entities section names as part of a `Session` has a corresponding `src/domain/` export; record the check inline as a spec.md SC-004 confirmation (no code change expected — a gap here would mean returning to Phase 3/4)
- [x] T040 Run [quickstart.md](./quickstart.md) end-to-end and confirm every one of its six sections passes
- [x] T041 Update spec.md's `**Status**` line from `Planned` to `Implemented — merged to main via PR #<N>` as part of the merging commit/PR (per `.claude/skills/sdd-workflow/SKILL.md`'s Status convention). Per Copilot review on PR #8: do this in the merge commit itself, not before — the spec must not claim `Implemented` while the PR is still open.

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
- T018 (`set.test.ts`, shares a file with T009 — sequential with it), T022/T023 (new files — parallel with each other and with T018) can proceed in parallel with one another; T019/T023a (both edit `session-block-entry.test.ts`) are sequential with each other, and T020/T021 (both edit `exercise.test.ts`) are sequential with each other — none of T018-T023a carry a `[P]` marker where they share a file (corrected from an earlier draft that marked same-file tasks `[P]` in error).
- T031, T032, T033 (US3 additional fake tests) — same file (`storage-port-fake.test.ts`) as T030, sequential; none carry `[P]` (corrected from an earlier draft).
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
