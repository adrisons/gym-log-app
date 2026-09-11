---

description: "Task list for Persistence (real durable StoragePort adapters)"

---

# Tasks: Persistence

**Input**: Design documents from `specs/003-persistence/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/storage-adapters.md](./contracts/storage-adapters.md), [quickstart.md](./quickstart.md)

**Tests**: The constitution's Development Workflow section requires "every new behaviour has at least one test" — test tasks are included and are NOT optional for this feature. Per plan.md's Technical Context, durability/reload behavior is proven via the shared contract suite run as Playwright tests in real browsers (not Vitest+jsdom); pure logic with no real storage involved (schema-version decision, `StorageError.kind`) is proven with ordinary Vitest unit tests.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

**Implementation note**: executed in one continuous pass rather than
literally stubbing every method with a placeholder throw and returning to
fill each in per-story (T009/T010's original description) — the full
method bodies were written directly, in story order, with each story's
own tests run and green before moving to the next. T032–T034 (File System
Access handle acquisition) required a real design correction not in the
original plan: `research.md` §2 now documents an in-memory write overlay
`FileSystemStorageAdapter` falls back to when `getHandle()` fails (most
commonly the app's very first, mount-time write, which carries no user
gesture) — without it, the screen deadlocked (see research.md §2's
"Implementation correction" for the full account). Every task below is
checked off against what was actually built and verified (`npm run
typecheck`, `npm run lint`, `npm run test:unit` — 268 tests green; the
full Playwright suite including both contract spec files, against real
Chromium — 5/5 green), not merely against the original task text.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

## Path Conventions

Single project (`src/`, `test/` at repository root), per [plan.md](./plan.md)'s Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: directory scaffolding and the one new npm script this feature needs. Dexie is already a `dependencies` entry (`docs/stack.md` Phase 0 sign-off) — nothing to install.

- [X] T001 Create the new directories this feature's files land in: `src/infrastructure/indexed-db/`, `src/infrastructure/file-system/`, `test/contract/`, `test/e2e/fixtures/` (no files yet — Phase 2 creates the first real content in each)
- [X] T002 [P] Add an npm script `test:contract-adapters` to `package.json` running `playwright test test/e2e/indexed-db-adapter.contract.spec.ts test/e2e/file-system-adapter.contract.spec.ts` (quickstart.md "Automated validation")

**Checkpoint**: directories and script exist — Phase 2 can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared decision logic, the `StorageError` extension, the physical-schema definitions, and both adapter class **skeletons** (every `StoragePort` method present and type-checking, real bodies filled in story-by-story below) — every user story's implementation tasks edit these same two adapter files, so the skeletons and their shared dependencies must exist first.

**⚠️ CRITICAL**: No user-story implementation task can begin until this phase is complete.

- [X] T003 [P] Create `src/infrastructure/schema-version.ts`: `export const CURRENT_SCHEMA_VERSION = 1` and `export function decideSchemaAction(stored: number, current: number): 'migrate' | 'open' | 'refuse'` — `stored === 0` → `'open'` (FR-007a's "never initialized" sentinel, no migration), `0 < stored && stored < current` → `'migrate'` (FR-008), `stored === current` → `'open'` (FR-009), `stored > current` → `'refuse'` (FR-010) (research.md §1)
- [X] T004 [P] Unit test `test/unit/infrastructure/schema-version.test.ts`: assert `decideSchemaAction` returns `'open'` for `(0, 1)`, `'migrate'` for `(1, 2)`-shaped inputs (use a fixture `current` of 2 to exercise the "older" branch since `CURRENT_SCHEMA_VERSION` is 1 — this test constructs its own current/stored pairs, it does not depend on the real constant equaling 2), `'open'` for `(1, 1)`, and `'refuse'` for `(2, 1)`
- [X] T005 [P] Add a `kind` param to `StorageError`'s constructor in `src/application/errors.ts`: `constructor(message: string, override readonly cause?: unknown, readonly kind?: 'quota-exceeded' | 'permission-lost' | 'schema-too-new')` — additive, existing two-arg call sites are unaffected (contracts/storage-adapters.md "StorageError.kind addition"; FR-012a — the one `application/` file this spec touches, per spec.md's Non-Goals exception)
- [X] T006 [P] Unit test `test/unit/application/errors.test.ts`: construct a `StorageError` with all three args and assert `.kind` reads back correctly for each of the three literal values; construct one with only `message`/`cause` and assert `.kind` is `undefined`
- [X] T007 Create `src/infrastructure/indexed-db/schema.ts`: a Dexie database definition with tables `sessions` (keyed by `Session.id`), `exercises` (keyed by `Exercise.id`), `bodyMeasurements` (keyed by `BodyMeasurement.id`), `draft` (fixed key `'current'`), `bandLabels` (fixed key `'current'`), `meta` (fixed key `'schemaVersion'`), `fileSystemHandle` (fixed key `'root'`, used only by `FileSystemStorageAdapter`'s own handle cache — not part of `StoragePort`) (data-model.md "IndexedDB (Dexie) — table map")
- [X] T008 [P] Create `src/infrastructure/file-system/layout.ts`: pure helpers returning the relative paths from data-model.md's "File System Access — file map" — `sessionFilePath(id: SessionId)` → `` `sessions/${id}.json` ``, plus fixed-path constants for `exercises.json`, `body-measurements.json`, `draft.json`, `band-labels.json`, `_meta.json`
- [X] T009 Create `src/infrastructure/indexed-db-storage-adapter.ts`: `export class IndexedDbStorageAdapter implements StoragePort`, constructed against T007's Dexie database, with every `StoragePort` method present and type-checking — methods this feature's later user-story tasks (T014+, T024+, T030+, T039+) own get a body now; every other method throws `new Error('not implemented — see specs/003-persistence/tasks.md')` as a temporary placeholder removed by the task that implements it
- [X] T010 Create `src/infrastructure/file-system-storage-adapter.ts`: `export class FileSystemStorageAdapter implements StoragePort`, constructed against a `FileSystemDirectoryHandle` passed in (research.md §2 — the composition root acquires it, this class never calls `showDirectoryPicker()` itself), using T008's path helpers — same "implements the full interface now, real bodies land story-by-story" placeholder convention as T009
- [X] T011 Create `test/contract/storage-adapter-contract.ts`: `export async function runStorageAdapterContract(makeAdapter: () => Promise<StoragePort>): Promise<{ passed: string[]; failed: { scenario: string; error: unknown }[] }>` — a skeleton that runs each scenario group from contracts/storage-adapters.md ("Sessions", "Draft", "Cross-adapter parity", "Schema version", "Cascades and atomicity", "Errors") as an internal array of `{ name, run }` entries, catching and recording failures per-scenario rather than throwing on the first one (so a single Playwright test call reports every scenario's pass/fail, not just the first failure) — the scenario arrays themselves start empty; each user-story task below (T012, T025, T031, T040) appends its own group's entries
- [X] T012 [P] Create `test/e2e/fixtures/storage-harness.html` + its script entry: a minimal page, served by the same Vite preview server `playwright.config.ts` already starts, that imports `IndexedDbStorageAdapter`, `FileSystemStorageAdapter`, and T011's `runStorageAdapterContract`, and exposes `window.__runContractSuite(adapterKind: 'indexed-db' | 'file-system')` returning the structured result as a JSON-serializable object — for `'file-system'`, the harness acquires its directory handle via `navigator.storage.getDirectory()` (OPFS), not `showDirectoryPicker()` (research.md §3)

**Checkpoint**: both adapter classes compile against `StoragePort` (with placeholder bodies), the shared contract-suite runner and browser harness exist — user-story implementation work can now begin.

---

## Phase 3: User Story 1 - A logged session survives closing the app (Priority: P1) 🎯 MVP

**Goal**: `saveSession`/`getSession`/`listSessions`/`deleteSession`, `saveExercise`/`getExercise`/`listExercises`, `saveBodyMeasurement`/`listBodyMeasurements`, and the `mergeExercises`/`deleteExerciseCascade` cascade (FR-013 — grouped here since both operate on Session/Exercise data, the concern this story owns) are real and durable on both adapters.

**Independent Test**: contracts/storage-adapters.md scenarios 1–3 and 12–13 pass against both `IndexedDbStorageAdapter` and `FileSystemStorageAdapter`.

### Tests for User Story 1

- [X] T013 [P] [US1] Append the "Sessions" and "Cascades and atomicity" scenario groups (contracts/storage-adapters.md scenarios 1–3, 12–13) to `test/contract/storage-adapter-contract.ts`'s scenario arrays (T011) — written against the `StoragePort` interface only, so they fail against both adapters' current placeholder bodies until the implementation tasks below land
- [X] T014 [P] [US1] Create `test/e2e/indexed-db-adapter.contract.spec.ts`: a Playwright test (both `chromium` and `webkit` projects — `playwright.config.ts` already defines them) that navigates to T012's harness and calls `window.__runContractSuite('indexed-db')`, asserting every scenario name from T013 appears in `passed`
- [X] T015 [P] [US1] Create `test/e2e/file-system-adapter.contract.spec.ts`: a Playwright test (`chromium` project only — File System Access has no WebKit implementation, matching FR-004's production fallback) calling `window.__runContractSuite('file-system')`, same assertion shape as T014

### Implementation for User Story 1

- [X] T016 [US1] Implement `IndexedDbStorageAdapter.saveSession`/`getSession`/`listSessions`/`deleteSession` in `src/infrastructure/indexed-db-storage-adapter.ts` against T007's `sessions` table; `listSessions(range)` filters by the `Session`'s date field falling within `range.from`..`range.to` inclusive (both bounds, per `DateRange`'s own doc comment in `src/application/ports/storage-port.ts`); every rejection wraps its cause in `StorageError` (FR-012), using `kind: 'quota-exceeded'` where the underlying Dexie/IndexedDB error indicates quota was exceeded
- [X] T017 [US1] Implement `IndexedDbStorageAdapter.saveExercise`/`getExercise`/`listExercises` against T007's `exercises` table, same `StorageError` wrapping convention as T016
- [X] T018 [US1] Implement `IndexedDbStorageAdapter.saveBodyMeasurement`/`listBodyMeasurements` against T007's `bodyMeasurements` table, same convention
- [X] T019 [US1] Implement `IndexedDbStorageAdapter.mergeExercises`/`deleteExerciseCascade` wrapped in one `db.transaction('rw', [sessions, exercises, draft], fn)` each (research.md §4 — atomicity via Dexie's native transaction, no hand-rolled rollback), reassigning/removing every referencing Session's Set per the cascade rules `src/application/ports/storage-port.ts`'s own doc comments already specify (spec 002), and repointing/pruning the draft row if it referenced the affected exercise; rejects with `StorageError` (no `kind`, per contracts/storage-adapters.md's error list) if either id does not resolve to an existing Exercise, or `survivorId === loserId` for `mergeExercises`
- [X] T020 [US1] Implement `FileSystemStorageAdapter.saveSession`/`getSession`/`listSessions`/`deleteSession` in `src/infrastructure/file-system-storage-adapter.ts` against T008's `sessionFilePath` helper — `listSessions` reads every file under `sessions/`, parses, and filters by range; each write serializes the full JSON payload before calling `createWritable()`'s `write()` once then `close()` (research.md §4's swap-on-close atomicity — never multiple partial writes to the same handle)
- [X] T021 [US1] Implement `FileSystemStorageAdapter.saveExercise`/`getExercise`/`listExercises` against the single `exercises.json` file (read-modify-write the whole array), same single-write-then-close convention as T020
- [X] T022 [US1] Implement `FileSystemStorageAdapter.saveBodyMeasurement`/`listBodyMeasurements` against `body-measurements.json`, same convention
- [X] T023 [US1] Implement `FileSystemStorageAdapter.mergeExercises`/`deleteExerciseCascade`: rewrite every affected `sessions/<id>.json` file, `exercises.json`, and `draft.json` (if referenced); if any file's write fails partway through the set, the whole call rejects with `StorageError` and every file write already completed for this call is left as-is (per-file atomicity — research.md §4 notes File System Access has no cross-file transaction primitive, matching FR-011's own "not required... across separate calls" scope, but each individual file's own swap-on-close guarantee still holds)

**Checkpoint**: User Story 1 is independently testable — `npm run test:contract-adapters` (once T014/T015 exist) proves Sessions/Exercises/BodyMeasurements/cascades durable on both adapters, even though `main.tsx` still wires `InMemoryStorageAdapter` (US3's job) and the draft/band-label/schema-version methods on both real adapters still throw the T009/T010 placeholder.

---

## Phase 4: User Story 2 - An in-progress draft survives closing the app (Priority: P1)

**Goal**: `saveDraft`/`getDraft`/`discardDraft` are real and durable on both adapters.

**Independent Test**: contracts/storage-adapters.md scenarios 4–5 pass against both adapters.

### Tests for User Story 2

- [X] T024 [P] [US2] Append the "Draft" scenario group (contracts/storage-adapters.md scenarios 4–5) to `test/contract/storage-adapter-contract.ts`

### Implementation for User Story 2

- [X] T025 [US2] Implement `IndexedDbStorageAdapter.saveDraft`/`getDraft`/`discardDraft` against T007's `draft` table (fixed key `'current'`; `discardDraft` deletes the row; `getDraft` returns `undefined` when absent, matching `StoragePort`'s own signature)
- [X] T026 [US2] Implement `FileSystemStorageAdapter.saveDraft`/`getDraft`/`discardDraft` against `draft.json` (`discardDraft` deletes the file; `getDraft` returns `undefined` when the file does not exist, not a thrown error — a missing file is the expected "no draft" state, not a failure)

**Checkpoint**: User Stories 1 and 2 both independently pass their contract scenarios. The Polish phase's `mergeExercises`/`deleteExerciseCascade`-and-draft interaction (already covered by T019/T023) can now be exercised end-to-end since drafts are real.

---

## Phase 5: User Story 3 - The app works the same way on every supported device (Priority: P2)

**Goal**: Band labels are real and durable on both adapters; the composition root selects the real adapter class via feature detection with no user-facing choice (FR-004); `FileSystemStorageAdapter`'s directory-handle acquisition is deferred to the first user-gesture-triggered write and persisted for reuse (FR-004a, research.md §2); the full contract suite (all groups appended so far) passes identically on both adapters, proving parity.

**Independent Test**: contracts/storage-adapters.md scenario 7 (band labels) and acceptance scenarios 1–5 under spec.md's User Story 3 — feature detection selects the correct class per platform, and the same contract suite run passes on both.

### Tests for User Story 3

- [X] T027 [P] [US3] Append the band-labels scenario (contracts/storage-adapters.md scenario 7) to `test/contract/storage-adapter-contract.ts`
- [X] T028 [US3] Unit test `test/unit/presentation/main-adapter-selection.test.ts` (or the nearest existing convention for testing `main.tsx`'s composition logic — check `test/unit/presentation/` for how spec 001 tested composition-root behavior without a real DOM `#root` mount): given `'showDirectoryPicker' in window` is `true`/`false` (mocked), assert the composition root's adapter-selection helper resolves to `FileSystemStorageAdapter`/`IndexedDbStorageAdapter` respectively (FR-004) — this test targets a small extracted `selectAdapterClass(hasFileSystemAccess: boolean)` function, not `main.tsx`'s `mount()` itself, so it is testable without a real browser
- [X] T029 [US3] Playwright test extending `test/e2e/file-system-adapter.contract.spec.ts` (or a new `test/e2e/file-system-adapter-permission.contract.spec.ts`): acquire a handle via OPFS, save something, simulate the handle's permission being revoked (Chromium DevTools Protocol permission override, or a second `FileSystemStorageAdapter` instance constructed against a handle whose `queryPermission` is stubbed to resolve `'denied'`), and assert the next write/read rejects with `StorageError` whose `kind` is `'permission-lost'`, distinguishable from `getDraft`'s ordinary `undefined` "no data yet" return (spec.md Edge Cases)

### Implementation for User Story 3

- [X] T030 [US3] Implement `IndexedDbStorageAdapter.listBandLabels`/`saveBandLabels` against T007's `bandLabels` table (fixed key `'current'`; order-significant, exactly the order last passed to `saveBandLabels` — no separate sort step, per `StoragePort`'s own doc comment)
- [X] T031 [US3] Implement `FileSystemStorageAdapter.listBandLabels`/`saveBandLabels` against `band-labels.json`, same order-preservation contract
- [X] T032 [US3] Add a directory-handle acquisition-and-persistence method to `FileSystemStorageAdapter` (e.g. `ensureDirectoryHandle(): Promise<FileSystemDirectoryHandle>`), called internally by every write method before it touches the filesystem: if a handle is already cached (constructor-injected, or previously acquired this session), reuse it after a background `queryPermission({ mode: 'readwrite' })` check; the composition root (T034) is the only caller that ever triggers `showDirectoryPicker()`, and only from inside an already-gesture-triggered write path (research.md §2) — this task does not call `showDirectoryPicker()` itself, it defines the seam T034 hangs the picker call from
- [X] T033 Add a small persisted handle cache: `IndexedDbStorageAdapter`-independent, a tiny Dexie table (T007's `fileSystemHandle` table, key `'root'`) that `FileSystemStorageAdapter` reads/writes its own `FileSystemDirectoryHandle` through, so the handle survives a reload without re-prompting (research.md §2) — this task is unscoped to either "IndexedDB" or "File System" as a StoragePort concern; it is `FileSystemStorageAdapter`'s own internal handle cache, implemented using the same Dexie helper library already in the stack
- [X] T034 [US3] Edit `src/presentation/main.tsx`: replace the `InMemoryStorageAdapter` wiring with feature detection (`'showDirectoryPicker' in window`) selecting `FileSystemStorageAdapter` or `IndexedDbStorageAdapter` (FR-004); for the `FileSystemStorageAdapter` path, defer the actual `showDirectoryPicker()` call to the first write T032's `ensureDirectoryHandle` seam triggers from inside an existing user-gesture-driven action (e.g. `logging-store.ts`'s confirm-a-set path already runs inside a tap) — no dialog shown at `mount()` time (FR-004a)

**Checkpoint**: the composition root now wires a real adapter; running the whole app in a real browser and reloading now genuinely persists data (User Stories 1–3's combined behavior), though schema-version migrate/refuse behavior (US4) is not yet wired into the startup sequence.

---

## Phase 6: User Story 4 - The stored schema version is honored on open (Priority: P2)

**Goal**: `getSchemaVersion`/`setSchemaVersion` are real and durable on both adapters, and each adapter calls T003's `decideSchemaAction` on startup, before any other storage operation, acting on its result per FR-008/009/010.

**Independent Test**: contracts/storage-adapters.md scenarios 8–11 pass against both adapters.

### Tests for User Story 4

- [X] T035 [P] [US4] Append the "Schema version" scenario group (contracts/storage-adapters.md scenarios 8–11, including the synthetic "version 0 with data"/"version > current" fixtures the suite constructs directly against each adapter's storage, bypassing the port) to `test/contract/storage-adapter-contract.ts`
- [X] T036 [P] [US4] Append the quota-exceeded and schema-too-new entries of the "Errors" scenario group (contracts/storage-adapters.md scenarios 15–16's `kind: 'schema-too-new'` half) to `test/contract/storage-adapter-contract.ts`

### Implementation for User Story 4

- [X] T037 [US4] Implement `IndexedDbStorageAdapter.getSchemaVersion`/`setSchemaVersion` against T007's `meta` table (fixed key `'schemaVersion'`; `getSchemaVersion` returns `0` — not `undefined` — when the row does not exist yet, per FR-007a)
- [X] T038 [US4] Implement `FileSystemStorageAdapter.getSchemaVersion`/`setSchemaVersion` against `_meta.json`; returns `0` when the file does not exist yet, same FR-007a convention
- [X] T039 [US4] Add a startup gate to both adapters (a method each calls internally before any other operation, e.g. `#ensureSchemaChecked()`; not a new `StoragePort` method — this is adapter-internal sequencing, not a port change): call T003's `decideSchemaAction(await getSchemaVersion(), CURRENT_SCHEMA_VERSION)`; on `'migrate'`, run the (currently trivial, no real migration exists yet at version 1 — spec.md Non-Goals) migration step and call `setSchemaVersion(CURRENT_SCHEMA_VERSION)`, recording that a migration happened (a log line is sufficient for v1 — no UI surface exists to show it yet); on `'open'`, do nothing; on `'refuse'`, every subsequent write on this adapter instance rejects with `StorageError` whose `kind` is `'schema-too-new'` and whose message explains the app is out of date, and no write is attempted
- [X] T040 [US4] Wire the startup gate (T039) to run once per adapter instance, before its first real operation — either in each adapter's constructor (kicking off the check as a cached promise every method `await`s first) or in a `main.tsx` call right after construction (FR-008's "before any other storage operation proceeds") — pick whichever keeps the adapter usable standalone in tests without requiring `main.tsx`; document the choice inline

**Checkpoint**: all four user stories are independently and jointly proven — `npm run test:contract-adapters` covers every scenario in contracts/storage-adapters.md against both real adapters, and the composition root uses them for real.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: full-suite validation and closing out the spec/tasks bookkeeping this project's `sdd-workflow` skill requires.

- [X] T041 [P] Run `npm run typecheck`, `npm run lint`, `npm run test:unit` and fix anything this feature's files introduced
- [X] T042 [P] Run `npm run test:e2e` (full Playwright suite, including the two new contract spec files and the existing app-shell/logging smoke specs) and confirm no regression in `test/e2e/shell-smoke.spec.ts`/`test/e2e/logging-smoke.spec.ts` now that `main.tsx` wires a real adapter instead of `InMemoryStorageAdapter`
- [X] T043 Ran quickstart.md's automated + IndexedDB-path manual steps against real Chromium in this environment (build+preview, real reload, a logged set survives — verified). The File System Access steps (9–10) need `showDirectoryPicker()` to actually show a dialog, which headless Chromium — the only browser this sandbox has — refuses by design (`AbortError`, confirmed by direct probe); quickstart.md's new "A note on headless/automated environments" section records this rather than silently skipping it. `FileSystemStorageAdapter`'s own logic is still fully proven, automatically, via the OPFS-backed contract suite (T014/T015) — only the literal native-dialog path needs a real human in a real (non-headless) browser, which this session cannot provide.
- [X] T044 [P] Update `docs/architecture.md`/`eslint.boundaries.js` only if this feature's implementation ended up needing a boundary edge neither already permits (expected: none — plan.md's Constitution Check found no new edge required; if implementation proves that wrong, this task closes the gap and re-runs `test/boundaries/edge-set.test.ts`)
- [X] T045 Update `specs/003-persistence/spec.md`'s **Status** line to `Implemented — merged to main via PR #<N>` once the implementing PR merges (sdd-workflow skill convention), and check off every task above as `[X]` — merged via PR #10 (squash commit `32f8454`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS every user story — both adapter classes must exist (even as placeholders) before any story can implement a method on them.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational only. Independent of US1's files (different methods, same two adapter classes) — safe to implement in either order, though T019/T023 (US1's cascade) touching the draft row means running US1 before US2 avoids a temporary "cascade repoints a draft that doesn't durably exist yet" gap in manual testing (not a hard technical dependency, since T019/T023 only need the draft row/file to exist as a concept, not to be durable yet).
- **User Story 3 (Phase 5)**: Depends on Foundational; T034 (composition-root swap) is safest after US1 and US2 are both done, since flipping `main.tsx` to a real adapter before Sessions/Drafts work would break the running app. Sequenced after Phase 4 for this reason, even though most of Phase 5 (band labels, handle-acquisition plumbing) has no hard technical dependency on US1/US2.
- **User Story 4 (Phase 6)**: Depends on Foundational (T003's `decideSchemaAction`). Independent of US1–US3's files; sequenced last here only because "the app is genuinely usable end-to-end" (US3's composition-root swap) is a more valuable checkpoint to reach first — teams with spare capacity could build US4 in parallel with US3.
- **Polish (Phase 7)**: Depends on every user story being complete.

### Parallel Opportunities

- T001–T002 (Setup) in parallel.
- T003–T006, T008 (Foundational) in parallel; T007 depends on nothing but is not marked `[P]` since T009 immediately depends on it; T009/T010 depend on T003, T005, T007/T008 respectively and on each other only in the sense both must exist before Phase 3 begins (different files, could still be done by two people at once).
- Within each user story, the `[P]`-marked test-authoring tasks can run alongside each other; implementation tasks touching the same adapter file (e.g. T016–T019 all in `indexed-db-storage-adapter.ts`) are sequential, but the IndexedDB-side and File-System-side tasks for the same story (e.g. T016 and T020) are different files and can run in parallel.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1).
3. **STOP and VALIDATE**: `npm run test:contract-adapters` with only T013's scenarios appended proves Sessions/Exercises/BodyMeasurements/cascades durable on both real adapters — the single gap spec 001's own `research.md` §1 named as this project's next priority.

### Incremental Delivery

1. Setup + Foundational → both adapter classes exist and compile.
2. + User Story 1 → Sessions/Exercises/BodyMeasurements durable (MVP).
3. + User Story 2 → the logging draft durable.
4. + User Story 3 → the real app (not just the adapters in isolation) uses real storage; band labels durable.
5. + User Story 4 → schema-version migrate/open/refuse behavior proven on real storage.
6. + Polish → full suite green, quickstart validated, spec status updated.
