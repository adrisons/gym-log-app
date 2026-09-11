---

description: "Task list for Log a Session (FR-001..FR-026)"

---

# Tasks: Log a Session

**Input**: Design documents from `specs/001-log-a-session/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: the constitution's Definition of Done ("every new behaviour has at least one test") makes tests non-optional for this feature, same as spec 002 — test tasks are included throughout, written before their implementation task per constitution Principle III (BDD Before Code).

**Scope reminder** (plan.md Summary, research.md §1): this feature is built and fully tested against `InMemoryStorageAdapter` (`src/infrastructure/in-memory-storage-adapter.ts` — moved here from `test/support/` since the composition root cannot import `test/`; still explicitly non-durable). No *durable* adapter (IndexedDB/File System Access) is created by any task below — that is a recommended follow-up spec, not part of this list.

**Organization**: tasks are grouped by user story (spec.md), in priority order: US1 (P1), US3 (P1 — tied with US1), US2 (P2), US4 (P2). This order follows spec.md's own text ("Tied with User Story 1 as foundational... separated here only because it is testable as its own slice once a set can be added at all") rather than the numeric US1→US2→US3→US4 listing order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US3 / US2 / US4, per spec.md

## Path Conventions

Single project (`src/`, `test/` at repository root), per plan.md's Project Structure. New directories: `src/application/logging/`, `src/presentation/logging/`, `test/unit/application/logging/`, `test/unit/presentation/logging/`, `test/unit/shared/`.

---

## Phase 1: Setup

**Purpose**: no new dependency to install (research.md — every decision resolves without one); this phase only creates the new directories this feature's files land in.

- [x] T001 Create `src/application/logging/`, `src/presentation/logging/`, `test/unit/application/logging/`, `test/unit/presentation/logging/`, `test/unit/shared/` directories (empty; populated by the tasks below)

**Checkpoint**: directory structure exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared utilities, the `LoggingDraft` shape, the extended `StoragePort`/fake, and the two use cases (`openLoggingForm`/`discardDraft`) every user story needs before it can be demoed at all.

**⚠️ CRITICAL**: no user-story task may begin until this phase is complete.

### Tests for Foundational work

- [x] T002 [P] Unit test `test/unit/shared/id.test.ts` (`newId()`) plus `test/unit/application/logging/ids.test.ts` (`newSessionId()`/`newExerciseId()`, split out because `shared/` cannot import `domain/ids.ts`'s branded types — see T009's note): each returns a unique string on every call; the latter two are assignable where a `SessionId`/`ExerciseId` is expected (research.md §2)
- [x] T003 [P] Unit test `test/unit/shared/fuzzy-match.test.ts`: exact match ranks first; a prefix match ranks above a substring-only match; a query with one typo (e.g. "squat" vs "squta") still matches within the bounded Levenshtein distance; a query with an accent difference (e.g. "sentadilla" vs "sentadílla") matches; an unrelated string does not match (research.md §3, FR-016)
- [x] T004 [P] Unit test `test/unit/application/logging/draft.test.ts`: `createDraft(now)` returns a `LoggingDraft` with `blocks: []`, `dateTime`/`lastEditedAt` set to `now`, and a fresh `id` on every call; `draftToSession(draft, sessionId)` strips every draft-local `id` field (top-level and on every `DraftBlock`/`DraftExerciseEntry`/`DraftSet`) and produces a value that deep-equals an independently-constructed `Session` with the same content (data-model.md "LoggingDraft")
- [x] T005 [US1] Unit test, add to `test/unit/storage-port-fake.test.ts`: `mergeExercises` and `deleteExerciseCascade` repoint/prune a matching `DraftExerciseEntry.exerciseId` across every block of a *nested* draft (not the flat placeholder) — merge keeps the entry's sets and repoints only `exerciseId`; cascade-delete removes the entry and its sets but leaves the block itself (now possibly empty) in place (`contracts/storage-port-extension.md` §1 "Consequence for in-memory-storage.ts"). Not parallel with T006/T033 — same file.
- [x] T006 [P] Unit test, add to `test/unit/storage-port-fake.test.ts`: `saveBandLabels`/`listBandLabels` round-trip an ordered string array unchanged; `reset()` clears it back to `[]` (`contracts/storage-port-extension.md` §2)
- [x] T007 [US1] Unit test `test/unit/application/logging/use-cases.test.ts` (`openLoggingForm`/`discardDraft` only — every other use case in this file is added by later phases): no stored draft → returns a freshly created draft and does not call `saveSession` (FR-001, Acceptance Scenario 1); a stored draft with `lastEditedAt` = today → returns it unchanged, does not create a new one (FR-001, Acceptance Scenario 2); a stored draft with `lastEditedAt` = an earlier local calendar day → `saveSession` is called with the promoted `Session`, `discardDraft` is called, and the returned draft is a brand-new one (research.md §4, Acceptance Scenario 4); `discardDraft` clears the stored draft and a subsequent `openLoggingForm` returns a new one, not the discarded one (FR-024, Acceptance Scenario 3)
- [x] T008 [US1] Unit test `test/unit/application/logging/logging-store.test.ts` (`initialize` only): calling `initialize(storage)` populates the store's `draft` from `openLoggingForm`; the store starts with an empty `undoStack` (data-model.md "Undo")

### Implementation for Foundational work

- [x] T009 [P] Create `src/shared/id.ts` (`newId(): string`, unbranded — `shared` cannot import `domain/ids.ts`'s branded types, `docs/architecture.md`'s table) and `src/application/logging/ids.ts` (`newSessionId(): SessionId` / `newExerciseId(): ExerciseId`, wrapping `newId()` with the branded cast). Requires a new `application` → `shared` boundary edge, added to `eslint.boundaries.js` and `docs/architecture.md` together (research.md §2; makes T002 pass)
- [x] T010 [P] Create `src/shared/fuzzy-match.ts`: normalize (lowercase + NFD diacritic strip) query and candidates; rank exact > prefix > substring > bounded-Levenshtein (≤ 2, or ≤ 1 under 5 chars); export `matchExercise(query: string, candidates: { name: string; aliases: string[] }[])` (research.md §3; makes T003 pass)
- [x] T011 Create `src/application/logging/draft.ts`: `LoggingDraft`/`DraftBlock`/`DraftExerciseEntry`/`DraftSet` interfaces exactly as data-model.md specifies; `createDraft(now: string): LoggingDraft`; `draftToSession(draft: LoggingDraft, id: SessionId): Session` (data-model.md "LoggingDraft"; makes T004 pass)
- [x] T012 Update `src/application/ports/storage-port.ts`: replace the placeholder `LoggingDraft` with a re-export of `application/logging/draft.ts`'s type; add `listBandLabels(): Promise<string[]>` / `saveBandLabels(labels: string[]): Promise<void>` to `StoragePort` (`contracts/storage-port-extension.md` §§1–2; depends on T011)
- [x] T013 Revise `test/support/in-memory-storage.ts`: replace `#referencesExercise`/`#repointDraftExerciseId`/`#pruneDraftExerciseId`'s flat-placeholder logic with real tree walks over `LoggingDraft.blocks[].exercises[]` (`contracts/storage-port-extension.md` §1); add `#bandLabels: string[] = []` plus `listBandLabels`/`saveBandLabels`, clear it in `reset()` (`contracts/storage-port-extension.md` §2) (depends on T012; makes T005/T006 pass)
- [x] T014 [P] Create `src/application/logging/quick-increments.ts`: named constants per research.md §9 — `WEIGHT_INCREMENT_KG = 2.5`, `WEIGHT_FINE_INCREMENT_KG = 0.5`, `BODYWEIGHT_COMPONENT_INCREMENT_KG = 2.5`, `REPS_INCREMENT = 1`, `DURATION_INCREMENT_SECONDS = 5`, `DISTANCE_INCREMENT_METRES = 50`
- [x] T015 [P] Create `src/application/logging/view-models.ts` (formatters only — `toBlockViewModel`/`toExerciseEntryViewModel` are added in US2/US1 respectively, below): `EFFORT_LABELS: Record<Effort, string>` (`{1: 'Very light', 2: 'Light', 3: 'Moderate', 4: 'Hard', 5: 'Maximal'}` — provisional copy, an application-layer decision per spec.md Assumptions "word labels... are an application/presentation concern, not specified here"; revise the words freely in review, the *shape* — always-paired number+word, ADR-0003 — is what's binding); `formatLoad(load: Load): string`; `formatVolume(volume: Volume): string`; `formatEffort(effort: Effort | undefined): string | undefined`; `toSetSummaryViewModel(set: DraftSet): SetSummaryViewModel` (data-model.md "View models")
- [x] T016 Create `src/application/logging/use-cases.ts` with `openLoggingForm(storage: StoragePort): Promise<LoggingDraft>` and `discardDraft(storage: StoragePort): Promise<void>` only (data-model.md "Use cases"; depends on T011, T012, T013; makes T007 pass; every later phase adds more exports to this same file)
- [x] T017 Create `src/application/logging/logging-store.ts`: Zustand store `useLoggingSession` with state `{ draft: LoggingDraft | undefined; undoStack: UndoEntry[] }` and an `initialize(storage: StoragePort)` action calling `openLoggingForm` (research.md §5; depends on T016; makes T008 pass; every later phase adds more actions to this same store)

**Checkpoint**: opening/restoring/promoting/discarding the draft works end to end against the fake. Nothing user-facing exists yet — every user story below builds its own use cases, store actions, and components on top of this.

---

## Phase 3: User Story 1 - Start a session and log a set (Priority: P1) 🎯 MVP (with US3)

**Goal**: open the form, find-or-create an exercise, record a minimal set (a Weight load + a rep count) in a few taps, no Save button, survives a reload against the fake.

**Independent Test**: with only Foundational + this phase built, open the app, add an exercise (search or create), add a set with a load and a rep count, see it recorded instantly; reload and find it still there (spec.md User Story 1).

### Tests for User Story 1

- [x] T018 [P] [US1] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `searchExercises(query, catalogue)` ranks an exact/alias match first and a seeded-catalogue-style typo query still returns the intended exercise in the top 3 (FR-002, FR-016, SC-004); with an empty query, returns exercises ordered by (most-used, then most-recently-used) computed from the sessions passed in, seeded exercises included (FR-002, Acceptance Scenario US1-5)
- [x] T019 [P] [US1] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `createExercise(storage, input)` saves a new `Exercise` with a fresh id via `application/logging/ids.ts`'s `newExerciseId()` and returns it (FR-002, FR-015)
- [x] T020 [US1] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `addExerciseEntry(draft, exerciseId)` on a draft with zero blocks creates one default `straightSets` block and appends the entry to it; on a draft with an existing block, appends to the last block rather than creating another (keeps US1's "single running list" independent of US2's block UI, per spec.md User Story 2 context). Not parallel with T018/T019 — same file.
- [x] T021 [US1] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `prefillNextSet` returns `undefined` for an entry with no sets, and `{ volume, load }` (no `effort`) from the entry's last set otherwise (FR-008, Acceptance Scenario US1-6). Not parallel with T018-T020 — same file.
- [x] T022 [US1] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `addSet` with a `Weight` load and a `reps` volume appends a new `DraftSet`; a second call with an identical `{ volume, load, effort, setKind }` within 1000 ms of the first is a no-op (returns the same draft, no new set) — a call after 1000 ms with the same values appends normally (FR-025, Acceptance Scenario US1-9); a call with neither volume nor a non-`none` load throws `InvalidSetError` via domain `createSet`, and the draft is unchanged (FR-019). Not parallel with T018-T021 — same file.
- [x] T023 [US1] Integration test `test/integration/logging-flow.test.ts` (new file) through `createHarness()`: open the form, create an exercise via `createExercise`, add it via `addExerciseEntry`, add a set via `addSet`, call `storage.getDraft()` directly and assert the set is present — proves the store's optimistic-then-persist pattern round-trips through the real `InMemoryStorage`, not just pure functions (FR-003, FR-005 at the port-contract level)
- [x] T024 [P] [US1] Component test `test/unit/presentation/logging/session-date-time-field.test.tsx`: renders the draft's `dateTime`; editing it calls the store's date-time action (FR-001); all six interactive states present per `contracts/logging-screen-components.md`
- [x] T025 [P] [US1] Component test `test/unit/presentation/logging/exercise-search-field.test.tsx`: typing calls `searchExercises` (debounced); "create new exercise" is always the last result, visible with no query too (FR-002); selecting a result or creating one calls `addExerciseEntry`
- [x] T026 [US1] Component test `test/unit/presentation/logging/set-row-minimal.test.tsx` (covers `WeightLoadInput`, `VolumeInput` reps mode, `SetConfirmControl` together, as US1 needs them — see Note below): confirm is disabled-with-reason until a load or volume is entered (FR-019); confirming appends the set optimistically with no loading state (Principle II, `docs/design.md` §4.4) and no visible Save control anywhere (FR-003); entering a value keeps it within FR-026's ≥ 0 bound
- [x] T027 [P] [US1] Component test `test/unit/presentation/logging/logging-screen.test.tsx`: on mount, calls `initialize`; renders the restored/created draft with no loading spinner (`docs/design.md` §4.4)
- [x] T028 [US1] E2E smoke `test/e2e/logging-smoke.spec.ts` (new file): open the app, add an exercise, add a set, assert it appears instantly with no Save control (quickstart.md scenarios 1–2). **Not** a reload-survives-it check — `InMemoryStorageAdapter` is explicitly non-durable (research.md §1), so a real `page.reload()` loses state today, correctly; that check is the follow-up persistence spec's job (quickstart.md scenario 3's revised wording)

**Note on T026**: `WeightLoadInput`/`VolumeInput`/`SetConfirmControl` are built here in their minimal form (Weight + reps only, no quick-increment polish, no other load types) so US1 is independently demoable per its own Acceptance Scenarios; US3 (next phase) extends the same three components to `LoadTypePicker`'s full five-way dispatch, quick-increments, and Duration/Distance volume — it does not replace them.

### Implementation for User Story 1

- [x] T029 [US1] Add `searchExercises(query, catalogue, sessions)` and `createExercise(storage, input)` to `src/application/logging/use-cases.ts` (data-model.md "Use cases"; depends on T009, T010, T016; makes T018, T019 pass)
- [x] T030 [US1] Add `addExerciseEntry(draft, exerciseId)` to `src/application/logging/draft.ts` (default-block behavior per T020's test) (depends on T011; makes T020 pass)
- [x] T031 [US1] Add `prefillNextSet(draft, blockId, entryId)` to `src/application/logging/use-cases.ts` (depends on T016; makes T021 pass)
- [x] T032 [US1] Add `addSet(draft, blockId, entryId, input, now, lastConfirm)` to `src/application/logging/use-cases.ts`, calling domain `createSet` for FR-019 validation and implementing the 1000 ms debounce (FR-025) (depends on T016; makes T022 pass)
- [x] T033 [US1] Add `addExerciseEntry`/`addSet`/`prefillNextSet`/`searchExercises`/`createExercise`/date-time-edit actions to `useLoggingSession` (`logging-store.ts`), each applying the draft change optimistically then calling `storage.saveDraft` (Principle II) (depends on T017, T029-T032; makes T023 pass)
- [x] T034 [P] [US1] Create `src/presentation/logging/session-date-time-field.tsx`: `<input type="datetime-local">` on design tokens, wired to the store's date-time action (makes T024 pass)
- [x] T035 [P] [US1] Create `src/presentation/logging/exercise-search-field.tsx`: debounced query → `searchExercises`; "create new exercise" affordance (makes T025 pass)
- [x] T036 [US1] Create `src/presentation/logging/weight-load-input.tsx` (Weight only), `src/presentation/logging/volume-input.tsx` (reps mode only), `src/presentation/logging/set-confirm-control.tsx` — disabled-with-reason until FR-019 is satisfied, no Save wording anywhere (makes T026 pass)
- [x] T037 [US1] Create `src/presentation/logging/logging-screen.tsx`: calls `initialize` on mount, renders `SessionDateTimeField` + a flat exercise-entry/set list (no block chrome yet — US2 adds it) (depends on T034-T036; makes T027 pass)
- [x] T038 [US1] Wire `src/presentation/main.tsx`: mount `LoggingScreen` with an `InMemoryStorageAdapter` instance (`src/infrastructure/`, research.md §1/§6) — replaces the Phase 0 `AppShell` placeholder, since a real screen now exists (depends on T037; makes T028 pass; also updates `test/e2e/shell-smoke.spec.ts`'s expected heading)

**Checkpoint**: User Story 1 is independently functional — open, search/create an exercise, log a minimal set, survives reload against the fake.

---

## Phase 4: User Story 3 - Record load and effort per set (Priority: P1)

**Goal**: every load type (Weight, Band, Bodyweight, Free text, None), every volume kind (reps, duration, distance), and the 1–5 effort scale, each with quick-increment controls and FR-026's bounds.

**Independent Test**: with User Story 1 built, set an exercise's load type to each of the five kinds in turn, record a set for each, and read back the same load type and value (spec.md User Story 3).

### Tests for User Story 3

- [ ] T039 [P] [US3] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `recordLoadTypeDefault(storage, exerciseId, loadType)` updates and saves the exercise's `defaultLoadType` (FR-009, Acceptance Scenario US3-1)
- [ ] T040 [P] [US3] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `suggestFreeTextLoads(exerciseId, sessions)` returns the distinct free-text values previously recorded for that exercise, most-recent-first (research.md §8, FR-012)
- [ ] T041 [P] [US3] Unit test `test/unit/application/logging/use-cases.test.ts`: `listBandLabels`/`saveBandLabels` wrappers round-trip through the port unchanged, preserving order (FR-011)
- [ ] T042 [P] [US3] Component test `test/unit/presentation/logging/load-type-picker.test.tsx`: five options, selecting one calls `recordLoadTypeDefault` and switches the rendered sub-input; all six states present
- [ ] T043 [P] [US3] Component test `test/unit/presentation/logging/band-load-input.test.tsx`: lists the user's band labels in their stored order; includes a "manage labels" entry (add/reorder/remove) calling `saveBandLabels` (FR-011)
- [ ] T044 [P] [US3] Component test `test/unit/presentation/logging/bodyweight-load-input.test.tsx`: signed added/assisted numeric field; value is clamped in the UI to −300..+300 (matching the domain `createLoad` bound, FR-014); a value of exactly 0 is treated as "no component" in the rendered summary
- [ ] T045 [P] [US3] Component test `test/unit/presentation/logging/free-text-load-input.test.tsx`: hard stop / visible counter at 40 characters (FR-012); autocompletes from `suggestFreeTextLoads`
- [ ] T046 [P] [US3] Component test `test/unit/presentation/logging/effort-picker.test.tsx`: one tap per level; every level, in every state including rest, shows its word label next to the number, never a bare digit (ADR-0003, FR-013)
- [ ] T047 [US3] Component test, extend `test/unit/presentation/logging/set-row-minimal.test.tsx` (or split into `set-row.test.tsx` — file-splitting decision left to implementation) to cover quick-increment buttons: tapping the down-increment at 0 keeps the value at 0 and the button shows disabled-with-reason, never silently no-ops without a visible state (FR-010, `contracts/logging-screen-components.md` "WeightLoadInput" row)
- [ ] T048 [US3] Integration test, add to `test/integration/logging-flow.test.ts`: record one set per load type (Weight/Band/Bodyweight/Free text/None-with-Volume) for the same exercise entry and read each back unchanged through `storage.getDraft()` (spec.md User Story 3 Independent Test)

### Implementation for User Story 3

- [ ] T049 [P] [US3] Add `recordLoadTypeDefault`, `suggestFreeTextLoads`, `listBandLabels`, `saveBandLabels` to `src/application/logging/use-cases.ts` (depends on T016; makes T039-T041 pass)
- [ ] T050 [US3] Extend `logging-store.ts` with actions for the above four use cases plus effort/setKind updates on a pending set (depends on T017, T049)
- [ ] T051 [P] [US3] Create `src/presentation/logging/load-type-picker.tsx` (makes T042 pass)
- [ ] T052 [P] [US3] Create `src/presentation/logging/band-load-input.tsx`, including inline label management (makes T043 pass)
- [ ] T053 [P] [US3] Create `src/presentation/logging/bodyweight-load-input.tsx` (makes T044 pass)
- [ ] T054 [P] [US3] Create `src/presentation/logging/free-text-load-input.tsx` (makes T045 pass)
- [ ] T055 [P] [US3] Create `src/presentation/logging/effort-picker.tsx`, using `view-models.ts`'s `EFFORT_LABELS` (makes T046 pass)
- [ ] T056 [US3] Extend `weight-load-input.tsx`/`volume-input.tsx` (from T036) with quick-increment buttons from `quick-increments.ts`, clamped at 0 with a stated disabled reason (depends on T014, T036; makes T047 pass); extend `volume-input.tsx` with duration/distance modes
- [ ] T057 [US3] Wire `load-type-picker.tsx` into the set-row component from T037 so a set can use any of the five load types plus effort (depends on T051-T056; makes T048 pass)

**Checkpoint**: User Stories 1 and 3 (both P1) together are the MVP — every load type, volume kind, and effort works, against the fake.

---

## Phase 5: User Story 2 - Organize a session into blocks (Priority: P2)

**Goal**: multiple named/unnamed blocks, reordering exercises within and across blocks, delete-with-5-second-undo for blocks/entries/sets.

**Independent Test**: with User Story 1 built, create two blocks, name one, leave one unnamed, add exercises to each, move an exercise from one block to the other (spec.md User Story 2).

### Tests for User Story 2

- [ ] T058 [P] [US2] Unit test, add to `test/unit/application/logging/draft.test.ts`: `addBlock(draft, name?, type)` appends a block, unnamed when `name` is omitted (FR-006)
- [ ] T059 [US2] Unit test, add to `test/unit/application/logging/draft.test.ts`: `renameBlock`, `reorderBlockExercise` (within one block), `moveExerciseAcrossBlocks` (between two) each preserve every moved entry's already-recorded sets intact (FR-006, Acceptance Scenario US2-3). Not parallel with T058 — same file.
- [ ] T060 [US2] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `deleteBlock(draft, blockId)` removes the block (cascading its entries/sets by construction) and returns an `UndoEntry` whose `restore` re-inserts the exact same block at its original index (FR-023); a session with zero blocks after deletion is valid, no error (FR-017, Acceptance Scenario US2-5). Not parallel with T061/T062 — same file.
- [ ] T061 [US2] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `deleteExerciseEntry`/`deleteSet` each return an `UndoEntry` with the same restore-at-original-index contract as `deleteBlock` (FR-004). Not parallel with T060/T062 — same file.
- [ ] T062 [US2] Unit test `test/unit/application/logging/logging-store.test.ts` (undo stack): pushing an `UndoEntry` makes it available for 5000 ms then it expires and calling `undo(id)` after expiry is a no-op; calling `undo(id)` before expiry restores the item and removes the entry; two entries (a set's and, before the set's own timer expires, its containing block's) coexist independently — restoring the block does not resurrect the already-deleted set (spec.md overlapping-undo-window edge case, FR-023). Not parallel with T008 — same file, builds on it.
- [ ] T063 [P] [US2] Component test `test/unit/presentation/logging/block-card.test.tsx`: an unnamed block renders as "Block N" from its position, never "Untitled" or blank (FR-007); delete action shows `UndoToast`
- [ ] T064 [P] [US2] Component test `test/unit/presentation/logging/undo-toast.test.tsx`: shows a 5-second countdown whose *information* (not only its animation) survives `prefers-reduced-motion` (`docs/design.md` §4.3); tapping undo within the window restores; after the window, the toast is gone and undo is unavailable
- [ ] T065 [US2] Component test `test/unit/presentation/logging/exercise-entry-card.test.tsx`: reorder handles are keyboard-operable, not drag-only (`docs/design.md` §5)
- [ ] T066 [US2] Integration test, add to `test/integration/logging-flow.test.ts`: two blocks, move an exercise from one to the other, delete a block with sets, undo it within the window, assert `storage.getDraft()` matches the pre-deletion state exactly (spec.md User Story 2 Independent Test, FR-023)

### Implementation for User Story 2

- [ ] T067 [US2] Add `addBlock`, `renameBlock`, `reorderBlockExercise`, `moveExerciseAcrossBlocks` to `src/application/logging/draft.ts` (depends on T011; makes T058, T059 pass)
- [ ] T068 [US2] Add `deleteBlock`, `deleteExerciseEntry`, `deleteSet` (each producing an `UndoEntry`, data-model.md "Undo") to `src/application/logging/use-cases.ts` (depends on T016; makes T060, T061 pass)
- [ ] T069 [US2] Extend `logging-store.ts`: `undoStack: UndoEntry[]` management — `pushUndo`, `undo(id)`, expiry via `setTimeout`/`expiresAt`; wire `deleteBlock`/`deleteExerciseEntry`/`deleteSet` actions to apply the draft change immediately (Principle II — the deletion is never held pending) and push the resulting `UndoEntry` (depends on T017, T067, T068; makes T062 pass)
- [ ] T070 [US2] Extend `src/application/logging/view-models.ts` with `toBlockViewModel(block, index, catalogue)` (FR-007's "Block N" fallback lives here, computed once, not per component) and `toExerciseEntryViewModel` (depends on T015)
- [ ] T071 [P] [US2] Create `src/presentation/logging/undo-toast.tsx` (reduced-motion-safe per contracts doc; makes T064 pass)
- [ ] T072 [US2] Create `src/presentation/logging/block-list.tsx` / `block-card.tsx` using `toBlockViewModel`; wire delete actions to `UndoToast` (depends on T070, T071; makes T063 pass)
- [ ] T073 [US2] Extend `src/presentation/logging/exercise-entry-card.tsx` (new file, factored out of T037's inline rendering) with keyboard-operable reorder handles and its own delete+undo (makes T065 pass)
- [ ] T074 [US2] Update `logging-screen.tsx` (from T037) to render `BlockList` instead of the US1 flat list, now that blocks are user-visible (depends on T072, T073; makes T066 pass)

**Checkpoint**: User Stories 1, 3, and 2 together — full block management with undo, on top of the full load/effort/volume surface.

---

## Phase 6: User Story 4 - Manage the exercise catalogue while logging (Priority: P2)

**Goal**: fuzzy/alias search (already in US1 — this phase adds rename/merge/delete), rename-collision → merge offer, merge with explicit irreversible confirmation, cascade delete with confirm-or-merge-instead.

**Independent Test**: with User Story 1 built, create an exercise, give it an alias, search using only the alias and get it as a top result (already covered by T018); rename/merge/delete are this phase's own independent tests (spec.md User Story 4).

### Tests for User Story 4

- [ ] T075 [US4] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `renameExerciseWithCollisionCheck` renames cleanly when the new name is unused (FR-020); returns `{ status: 'collision', collidesWith }` without renaming when the new name/alias matches a different exercise, case/accent-insensitively (FR-022, Acceptance Scenario US4-3)
- [ ] T076 [US4] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `mergeExercises` wrapper delegates to `StoragePort.mergeExercises` and surfaces its rejection for identical/nonexistent ids unchanged (FR-017, FR-019). Not parallel with T075 — same file.
- [ ] T077 [US4] Unit test, add to `test/unit/application/logging/use-cases.test.ts`: `deleteExerciseCascade` wrapper throws `ExerciseDeleteConfirmationRequiredError` (from domain `deleteExercise`) when the exercise has history and `confirmed` is false, without calling the port; calls `StoragePort.deleteExerciseCascade` when confirmed or when there's no history (FR-018). Not parallel with T075/T076 — same file.
- [ ] T078 [P] [US4] Component test `test/unit/presentation/logging/exercise-catalogue-panel.test.tsx`: rename that collides opens a merge-offer dialog stating the two names; declining cancels the rename and keeps the original name (FR-022, Acceptance Scenario US4-3a); merge confirmation copy states plainly that it is not undoable, with no 5-second undo affordance anywhere in that flow (FR-017, SC-005); delete-with-history confirmation offers merge as an alternative in the same dialog (FR-018)
- [ ] T079 [US4] Integration test, add to `test/integration/logging-flow.test.ts`: rename-collision → decline → original name kept; rename-collision → accept-elsewhere's-merge → survivor keeps its own defaults, loser's name becomes an alias, every one of the loser's sets (across sessions *and* the current draft, per T005) now references the survivor (FR-017, Acceptance Scenario US4-4)

### Implementation for User Story 4

- [ ] T080 [US4] Add `renameExerciseWithCollisionCheck`, `mergeExercises`, `deleteExerciseCascade` wrappers to `src/application/logging/use-cases.ts` (data-model.md "Use cases"; depends on T016; makes T075-T077 pass)
- [ ] T081 [US4] Extend `logging-store.ts` with actions for the three use cases above, re-running `openLoggingForm`-equivalent draft repoint/prune in local state after a merge/cascade affecting the current draft's entries (mirrors the port-level repoint T005 already covers server-side; the store must reflect it in memory too) (depends on T017, T080)
- [ ] T082 [US4] Create `src/presentation/logging/exercise-catalogue-panel.tsx`: rename/merge/delete dialogs reachable from `ExerciseSearchField` (T035), per `contracts/logging-screen-components.md`'s "ExerciseCataloguePanel" row (depends on T035, T081; makes T078, T079 pass)

**Checkpoint**: all four user stories complete. Every FR-001..FR-026 acceptance scenario in spec.md is covered by at least one test.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: verification sweeps spec.md's Success Criteria require beyond any single story's own tests, plus the accessibility/state obligations that apply across every component built above.

- [ ] T083 [P] Accessibility/interaction-state audit: for every component row in `contracts/logging-screen-components.md`, confirm all six states (rest, hover, pressed, focus-visible, disabled-with-reason, loading-where-applicable) are implemented using design tokens only — no literal colour/spacing/duration (`docs/development-principles.md` §5); confirm nothing essential is hover-only and every control is keyboard-reachable (`docs/requirements.md` §7.4)
- [ ] T084 [P] Verify both light and dark themes and a narrow (one-handed phone) viewport for the full logging screen (`docs/design.md` §6, §8 review checklist)
- [ ] T085 [P] Grep sweep confirming no file under `src/presentation/logging/` imports `application/ports` or a `domain/` type directly, and no file under `src/application/logging/` imports anything from `infrastructure/` or `presentation/` (reinforcing `eslint-plugin-boundaries`, `docs/architecture.md`'s table — this plan adds files but no new edge type)
- [ ] T086 Run [quickstart.md](./quickstart.md) end-to-end (all 12 manual scenarios) and confirm every automated check (`npm run typecheck && npm run test && npm run lint && npx playwright test`) is green
- [ ] T087 Time SC-001 (≤ 3 taps to repeat the previous set) and SC-002 (< 30 s to a first set on a brand-new exercise) manually against the built screen; record the result in quickstart.md or this task's completion note
- [ ] T088 Update spec.md's `**Status**` line from `Planned` to `Implemented — merged to main via PR #<N>`, done in the merge commit itself (per spec 002's T041 precedent — the spec must not claim `Implemented` while the PR is still open)
- [ ] T089 Add a short note to plan.md's Summary (or a new `NEXT.md` in this feature's directory — implementer's choice) pointing at the recommended follow-up persistence spec (research.md §1) now that this feature is otherwise complete, so the gap isn't lost once this branch merges

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup — BLOCKS every user story.
- **User Story 1 (Phase 3)**: depends on Foundational.
- **User Story 3 (Phase 4)**: depends on User Story 1 (extends the same `WeightLoadInput`/`VolumeInput`/`SetConfirmControl`/set-row rather than duplicating them — T056/T057 edit T036/T037's files).
- **User Story 2 (Phase 5)**: depends on User Story 1 (needs a draft with exercise entries to organize) — independently testable from User Story 3 (blocks don't need every load type to exist first), so US2 and US3 could be staffed in parallel once US1 is done, per spec.md's own priority note that US2/US4 are P2 while US1/US3 are P1.
- **User Story 4 (Phase 6)**: depends on User Story 1 (needs the catalogue/search surface T029/T035 already built).
- **Polish (Phase 7)**: depends on all four user stories.

### Within Each User Story

- Tests are written first and confirmed failing before their implementation task, per constitution Principle III — same convention as spec 002's tasks.md.
- Within Foundational and each story: draft/use-case logic before store actions before components before screen wiring.

### Parallel Opportunities

- T002, T003, T004 (Foundational tests, different files) — parallel.
- T006 (band labels) is parallel with T005 only if approached as logically independent additions to the same file; in practice both edit `storage-port-fake.test.ts` — treat as sequential in execution even though listed `[P]`/non-`[P]` above reflects intent, not a hard file-lock guarantee; confirm no merge conflict before landing both in one commit.
- T009, T010 (Foundational implementation, different files) — parallel.
- T014, T015 (constants, formatters) — parallel with each other and with T009/T010.
- T018, T019 (US1 tests, same file but independent describe blocks) — treat as sequential within one file in practice, same caveat as T005/T006.
- T024, T025, T027 (US1 component tests, different files) — parallel.
- T034, T035 (US1 components, different files) — parallel.
- T039, T040, T041 (US3 tests) and T042-T046 (US3 component tests, all different files) — parallel within each group.
- T049 (US3 implementation) parallel with T051-T055 (different files) once T049 exists for them to call.
- T063, T064 (US2 component tests, different files) — parallel.
- T071 parallel with T067-T070 (different files).
- T083, T084, T085 (Polish) — independent checks, parallel.

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Unit test test/unit/shared/id.test.ts"
Task: "Unit test test/unit/shared/fuzzy-match.test.ts"
Task: "Unit test test/unit/application/logging/draft.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 — both P1)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational — open/restore/promote/discard the draft against the fake.
3. Complete Phase 3: User Story 1 — minimal Weight+reps logging, exercise search/create.
4. Complete Phase 4: User Story 3 — every load type, volume kind, effort, quick-increments.
5. **STOP and VALIDATE**: run `quickstart.md` scenarios 1–4, 7–8, 12.

### Incremental Delivery

1. Setup + Foundational → draft lifecycle proven against the fake.
2. + US1 → a set can be logged at all (flat list, one implicit block, Weight+reps only) → demoable.
3. + US3 → every load type/effort/quick-increment → **MVP boundary**, matches spec.md's own P1 pairing.
4. + US2 → blocks become user-visible/manageable, undo exists → demoable increment.
5. + US4 → catalogue rename/merge/delete-with-cascade → demoable increment.
6. + Polish → done, modulo the explicitly-flagged persistence gap (research.md §1).

### Parallel Team Strategy

Once Foundational is done: one path continues US1 → US3 (they touch the same files, sequential by construction); a second path can start US2 as soon as US1's `addExerciseEntry`/store actions exist, without waiting for US3; US4 similarly only needs US1's catalogue/search surface, not US3's load-type work.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task — see the Parallel Opportunities caveats above for the handful of same-file exceptions kept in this list for traceability to their FR rather than dropped.
- [Story] label maps task to specific user story for traceability.
- US1 and US3 are effectively one combined P1 MVP, exactly as spec.md frames them ("tied... separated here only because it is testable as its own slice") — same relationship spec 002's tasks.md documented between its own US1/US2.
- Commit after each phase checkpoint (`commit-and-pr-conventions` skill: one concern per commit), not after every task.
- Avoid: a `LoadTypePicker` sub-input built without its FR-026 bound; a destructive action wired without an `UndoEntry`; any component missing one of its six states; any new `application/logging/` function that imports `InMemoryStorage` directly instead of taking `StoragePort` as a parameter (research.md §6).
