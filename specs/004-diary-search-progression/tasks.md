---

description: "Task list for Diary, Search and Progression (Phase 4, MVP-closing)"

---

# Tasks: Diary, Search and Progression

**Input**: Design documents from `specs/004-diary-search-progression/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/screen-contracts.md](./contracts/screen-contracts.md), [quickstart.md](./quickstart.md)

**Tests**: The constitution's Development Workflow section requires "every new behaviour has at least one test" — test tasks are included and are NOT optional for this feature. Per plan.md's Technical Context, the bulk of this feature is pure `application/`-layer derivation logic, proven with Vitest unit tests against plain fixture data (no real storage, no browser API); the three new screens get component tests against `InMemoryStorageAdapter` (`@testing-library/react`); the existing Playwright smoke suite is extended, not duplicated, for routing/navigation coverage.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story. All three of spec.md's user stories are Priority P1 (this phase's own MVP scope, `docs/agent-brief.md` Phase 4) — ordered here as they appear in spec.md (diary → search → progression), which also matches their natural dependency order (progression is reached from search results or a session's detail view per FR-013).

**Implementation notes** (executed in one continuous pass, as specs 001/003 were):

- **`src/application/storage-access.ts`** (not in the original task list): a small Zustand store holding the single `StoragePort` instance, mirroring `logging-store.ts`'s own `storage`/`configure` pattern — needed so the three new read-only screens can reach the composition-root-configured adapter without each screen prop-drilling it or `presentation/` importing `infrastructure/` directly. Wired in `main.tsx` alongside `useLoggingSession`'s existing `configure()` call.
- **`src/application/diary/session-editing.ts`** (not in the original task list): converts a loaded `Session` to/from spec 001's own `LoggingDraft`-shaped editing representation (synthetic per-level `id`s), purely as an in-memory editing seam — never touches `saveDraft`/`getDraft`. FR-005's editable surface was scoped to exactly what spec 001's own logging screen already supports (a confirmed set is added or deleted, never edited in place — `logging-screen.tsx` itself has no such affordance either) plus block/exercise-entry add/rename/delete; undo is deliberately not carried over to this screen, since FR-005 requires edits be editable and persisted, not undoable — the 5-second undo window is spec 001 FR-001's own logging-critical-path guarantee, not restated for after-the-fact editing.
- **Type re-exports added to `application/logging/use-cases.ts`** (`Session`, `SessionId`, alongside the pre-existing `Exercise`/`ExerciseId`/`Load`): required so the new `presentation/` screens can reference these domain types without importing `domain/` directly, per `docs/architecture.md`'s layer table (caught by `eslint-plugin-boundaries` during implementation, fixed the same way the existing `Exercise`/`ExerciseId` re-exports already were).
- **FR-021's explanation is shown independent of the currently-selected metric**: `progression-screen.tsx` auto-falls-back away from `'e1rm'` to the first available metric when e1RM is unavailable for an exercise (so a chart is always shown, per FR-021's "offer the metrics that do apply"), which meant the one-sentence explanation could never surface if it were gated on `metric === 'e1rm'` alone. Fixed by exporting `E1RM_UNAVAILABLE_REASON` from `progression-series.ts` and showing it in `progression-chart.tsx` whenever `'e1rm'` is absent from `availableMetrics`, regardless of the selected metric — caught by T023/T030's own component test (`progression-screen.test.tsx`) failing against the first implementation.
- **T005's e2e verification**: Playwright's bundled browser version in this sandbox didn't match the pinned `channel: 'chromium'` config (a local-container limitation — CI installs matching browsers via `npx playwright install --with-deps`, per `.github/workflows/ci.yml`); verified locally with a temporary `executablePath` override, reverted before committing so `playwright.config.ts` stays unchanged.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = diary, US2 = search, US3 = progression)

## Path Conventions

Single project (`src/`, `test/` at repository root), per [plan.md](./plan.md)'s Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: directory scaffolding. `react-router-dom` and `recharts` are already `dependencies` entries (`docs/stack.md` Phase 0 sign-off) — nothing to install.

- [X] T001 Create the new directories this feature's files land in: `src/application/diary/`, `src/application/search/`, `src/application/progression/`, `src/presentation/diary/`, `src/presentation/search/`, `src/presentation/progression/`, `test/unit/application/diary/`, `test/unit/application/search/`, `test/unit/application/progression/`, `test/unit/presentation/diary/`, `test/unit/presentation/search/`, `test/unit/presentation/progression/` (no files yet — Phase 2 creates the first real content)

**Checkpoint**: directories exist — Phase 2 can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the `DateRange` helper every story's `listSessions` call needs, and the composition-root router wiring every screen mounts under.

**⚠️ CRITICAL**: No user-story implementation task can begin until this phase is complete.

- [X] T002 [P] Create `src/application/date-range.ts`: `export function allStoredDataRange(): DateRange` returning `{ from: '2000-01-01T00:00:00.000Z', to: new Date().toISOString() }` (research.md §4 — a fixed, generously-early constant; no port change); `export function lastMonthsRange(months: 3 | 6 | 12): DateRange` returning `{ from, to }` spanning `months` calendar months back from now, for the progression chart's 3m/6m/12m range options (FR-019)
- [X] T003 [P] Unit test `test/unit/application/date-range.test.ts`: assert `allStoredDataRange().from` precedes any plausible session date and `.to` is today; assert `lastMonthsRange(3)`'s span is approximately 3 calendar months (within a day, to tolerate month-length variation)
- [X] T004 Edit `src/presentation/main.tsx`: wrap the existing `<LoggingScreen />` render in a `react-router-dom` `<BrowserRouter>` with routes `"/"` → `LoggingScreen` (unchanged), `"/diary"`, `"/diary/:sessionId"`, `"/search"`, `"/exercises/:exerciseId/progression"` — the last four rendering `null`/a placeholder until their own story's task below fills them in; `useLoggingSession.getState().configure(...)` and `mount()`'s adapter-selection logic stay exactly as-is, called once before the router renders (research.md §3, plan.md Constitution Check Principle II)
- [X] T005 Extend `test/e2e/shell-smoke.spec.ts`: assert `/` still renders the logging screen and its existing offline/service-worker smoke assertions still pass after T004's router wrap (plan.md Constitution Check Principle II — no regression to the logging critical path)

**Checkpoint**: the router exists, `DateRange` helper exists — user-story implementation work can now begin.

---

## Phase 3: User Story 1 - Skim what I've trained lately (Priority: P1) 🎯 MVP

**Goal**: A diary/history screen listing every session, grouped by month, one-line-summarized, with jump-to-date and an editable session detail view (FR-001 through FR-006).

**Independent Test**: contracts/screen-contracts.md's "Diary screen" and "Session detail screen" scenarios pass against `InMemoryStorageAdapter` fixtures.

### Tests for User Story 1

- [X] T006 [P] [US1] Unit test `test/unit/application/diary/diary-summary.test.ts`: a session with 2 blocks / 3 distinct exercises / 7 total sets (including 1 warm-up) summarizes to `setCount: 7` (data-model.md: "including non-working sets") and `mainExerciseNames` listing all 3 distinct names in first-referenced order; a session whose referenced exercises all lack `movementPattern` summarizes to `kindOfWork: undefined`
- [X] T007 [P] [US1] Unit test `test/unit/application/diary/diary-grouping.test.ts`: sessions across 3 different months group into 3 `DiaryMonthGroup`s, most-recent month first, sessions reverse-chronological within each group; `findNearestSessionDate` returns the exact match when one exists, else the nearest-after, else the nearest-before, else `undefined` for an empty list (FR-003's resolved tie-break)
- [X] T008 [P] [US1] Component test `test/unit/presentation/diary/diary-screen.test.tsx`: renders grouped sessions from `InMemoryStorageAdapter` fixtures (screen-contracts.md scenarios 1–2); renders the FR-006 empty state when no sessions exist (scenario 5)
- [X] T009 [P] [US1] Component test `test/unit/presentation/diary/session-detail-screen.test.tsx`: renders a session's blocks/exercises/sets from `getSession`; editing a set and confirming calls `saveSession` with the updated session (screen-contracts.md scenario 1)

### Implementation for User Story 1

- [X] T010 [P] [US1] Create `src/application/diary/diary-summary.ts`: `buildDiarySessionSummary(session: Session, exercisesById: Map<ExerciseId, Exercise>): DiarySessionSummary` per data-model.md's "Derived: Diary summary" (distinct main exercise names in first-referenced order; total set count across every block/entry; kind-of-work from referenced exercises' `movementPattern`, `undefined` when none present)
- [X] T011 [P] [US1] Create `src/application/diary/diary-grouping.ts`: `groupSessionsByMonth(summaries: DiarySessionSummary[]): DiaryMonthGroup[]` (reverse-chronological months, reverse-chronological sessions within each) and `findNearestSessionDate(summaries: DiarySessionSummary[], target: string): SessionId | undefined` (nearest on/after `target`, else nearest before, else `undefined`) per data-model.md
- [X] T012 [US1] Create `src/presentation/diary/diary-screen.tsx`: reads `listExercises()` (build the `exercisesById` map once) then `listSessions(allStoredDataRange())`, maps through T010/T011, renders `DiaryMonthGroup`s with each session's one-line summary, a jump-to-date control wired to `findNearestSessionDate`, an FR-006 empty state when there are zero sessions, and navigates to `/diary/:sessionId` on row tap (contracts scenarios 1, 2, 3, 4, 6)
- [X] T013 [US1] Create `src/presentation/diary/session-detail-screen.tsx`: reads `getSession(sessionId)` from the route param, renders the session's blocks/exercise entries/sets reusing the existing `src/presentation/logging/` components (block-card, exercise-entry-card, set-row, etc.) in an editable mode, and persists edits through the existing `StoragePort.saveSession` (FR-005 — no new call site)
- [X] T014 [US1] Wire `/diary` and `/diary/:sessionId` routes in `src/presentation/main.tsx` to T012/T013 (replacing Phase 2's placeholders)

**Checkpoint**: User Story 1 is fully functional and testable independently — a person can browse, open, and edit past sessions.

---

## Phase 4: User Story 2 - Find an exercise by name (Priority: P1) 🎯 MVP

**Goal**: Exercise search by name/alias, case/accent-insensitive, typo- and partial-match tolerant, under 100ms for 500 exercises (FR-007 through FR-012).

**Independent Test**: contracts/screen-contracts.md's "Exercise search screen" scenarios pass against `InMemoryStorageAdapter` fixtures, including the 500-exercise performance benchmark.

### Tests for User Story 2

- [X] T015 [P] [US2] Unit test `test/unit/application/search/exercise-search.test.ts`: an exercise "Sentadilla" matches queries "sentadilla" (case-insensitive), "sentadila" (one-edit typo), and "senta" (prefix); an exercise "Peso muerto" aliased "deadlift" matches "deadlift"; a query matching nothing returns `[]`, never throws (FR-007/008/009/012); a 500-synthetic-exercise fixture catalogue's search completes in under 100ms wall-clock time, asserted directly (FR-010, research.md §2 — a real measurement, not an estimate)
- [X] T016 [P] [US2] Component test `test/unit/presentation/search/exercise-search-screen.test.tsx`: typing a query filters displayed results via `exercise-search.ts`; an empty-result query shows the FR-012 explicit empty state; results reflect a catalogue change (rename via existing flow) made between two searches without any manual refresh (screen-contracts.md scenario 5)

### Implementation for User Story 2

- [X] T017 [US2] Create `src/application/search/exercise-search.ts`: `searchExercises(query: string, catalogue: Exercise[]): Exercise[]`, a thin wrapper mapping `Exercise.canonicalName`/`aliases` into `shared/fuzzy-match.ts`'s existing `matchExercise` shape and returning its result unmodified (data-model.md "Derived: Search result"; research.md §1 — no new library, no persisted index)
- [X] T018 [US2] Create `src/presentation/search/exercise-search-screen.tsx`: a search input calling `listExercises()` once per catalogue-changing navigation and T017's `searchExercises` on every query change, rendering ranked results (each navigable to `/exercises/:exerciseId/progression`) or the FR-012 empty state
- [X] T019 [US2] Wire the `/search` route in `src/presentation/main.tsx` to T018 (replacing Phase 2's placeholder); add a search entry point from `src/presentation/diary/diary-screen.tsx` (T012) — a link/button to `/search`, since spec.md frames search as reachable both standalone and from diary browsing

**Checkpoint**: User Stories 1 AND 2 both work independently — a person can browse the diary and separately find any exercise by name.

---

## Phase 5: User Story 3 - Review one exercise's progression (Priority: P1) 🎯 MVP

**Goal**: A per-exercise progression screen with a reverse-chronological list (best working set per session) and a chart (selectable metric/range, personal records marked, honest degradation for non-numeric loads) — FR-013 through FR-023.

**Independent Test**: contracts/screen-contracts.md's "Progression screen" scenarios pass against `InMemoryStorageAdapter` fixtures spanning eligible and ineligible loads.

### Tests for User Story 3

- [X] T020 [P] [US3] Unit test `test/unit/application/progression/e1rm.test.ts`: `isE1rmEligible` is `true` only for a `Weight` set or a `Bodyweight` set with a numeric `addedOrAssistedKg`, with `volume.kind === 'reps'` and `1 <= count <= 12`, and `setKind !== 'warmUp'`; `false` for `Band`/`FreeText` loads, zero-added-load `Bodyweight`, reps outside 1–12, non-`reps` volume, or a warm-up set; `estimatedOneRepMax` matches a hand-computed Epley value (`load × (1 + reps / 30)`) exactly for a known fixture (FR-017, data-model.md)
- [X] T021 [P] [US3] Unit test `test/unit/application/progression/tonnage.test.ts`: `sessionTonnage` sums `load × reps` across numeric-load working sets and reports `unit: 'kg'`/`'lb'` matching the sets' unit; a working-set list with no numeric load reports `unit: 'reps'` with the summed rep count (FR-018)
- [X] T022 [P] [US3] Unit test `test/unit/application/progression/best-working-set.test.ts`: given a session's working sets for one exercise, `bestWorkingSet` picks the highest-e1RM eligible set when any qualify, else the highest numeric load, else the highest rep count — independent of any externally-selected metric (FR-015's fixed three-tier ranking); returns `undefined` for an empty/all-warm-up set list
- [X] T023 [P] [US3] Unit test `test/unit/application/progression/progression-series.test.ts`: a 5-session fixture history produces one `ProgressionListRow` per session reverse-chronological with the correct `bestSet`/`setCount` (FR-014); selecting each of the four metrics produces correctly-computed `chartPoints`, filtered by the selected `ProgressionRange` while `listRows` stays full-history (FR-016/019); the session with the all-time-highest value for the selected metric has `isPersonalRecord: true` on both its list row and chart point, computed against full history regardless of the active range (FR-020's corrected all-time-maximum rule); an exercise fixture with zero e1RM-eligible sets anywhere yields `metricAvailable: false` and a populated `metricUnavailableReason` for `'e1rm'` only, with the other three metrics still available (FR-021); a mixed eligible/ineligible fixture's e1RM series has `value: undefined` (not `0`) for ineligible sessions (FR-022)

### Implementation for User Story 3

- [X] T024 [P] [US3] Create `src/application/progression/e1rm.ts`: `isE1rmEligible(set: Set): boolean` and `estimatedOneRepMax(set: Set): number` per data-model.md's "Derived: Progression eligibility and per-set metrics" and `docs/requirements.md` §5.2
- [X] T025 [P] [US3] Create `src/application/progression/tonnage.ts`: `sessionTonnage(workingSets: Set[]): SessionTonnage` per data-model.md and `docs/requirements.md` §5.3
- [X] T026 [US3] Create `src/application/progression/best-working-set.ts`: `bestWorkingSet(sets: Set[]): Set | undefined` per data-model.md's fixed three-tier ranking (depends on T024 for the e1RM-eligibility tier)
- [X] T027 [US3] Create `src/application/progression/progression-series.ts`: `buildProgressionSeries(exerciseSessions: Session[], exerciseId: ExerciseId, metric: ProgressionMetric, range: ProgressionRange, fixedLoadValue?: number): ProgressionSeries` per data-model.md (depends on T024, T025, T026)
- [X] T028 [US3] Create `src/presentation/progression/progression-list.tsx`: renders `ProgressionListRow[]` reverse-chronological with date, best set's load/volume/effort, set count, and a personal-record visual mark (FR-014/020)
- [X] T029 [US3] Create `src/presentation/progression/progression-chart.tsx`: a Recharts line chart plotting `ProgressionChartPoint[]` for the selected metric, a metric selector (omitting e1RM and showing `metricUnavailableReason` when `metricAvailable` is `false`, FR-021), a range selector (3m/6m/12m/all, FR-019), and personal-record markers (FR-020)
- [X] T030 [US3] Create `src/presentation/progression/progression-screen.tsx`: reads the `exerciseId` route param, `listSessions(allStoredDataRange())` filtered to sessions containing that exercise, drives T027 with the currently-selected metric/range state, and renders T028 + T029 together
- [X] T031 [US3] Wire the `/exercises/:exerciseId/progression` route in `src/presentation/main.tsx` to T030 (replacing Phase 2's placeholder); link to it from `src/presentation/search/exercise-search-screen.tsx` (T018) and from an exercise reference in `src/presentation/diary/session-detail-screen.tsx` (T013), per FR-013's "reachable from search results and from an exercise referenced in a session detail view"

**Checkpoint**: All three user stories are independently functional — the diary, search, and progression screens each work standalone and are cross-linked as spec.md describes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: full-suite verification and documentation, once all three stories are in place.

- [X] T032 [P] Run `npm run typecheck`, `npm run lint`, `npm run check:no-color-literals` and fix anything the new files trip (Definition of Done)
- [X] T033 [P] Run `npm run test:unit` (all new unit/component tests plus the full existing suite) and confirm 0 regressions
- [X] T034 Run `npm run test:e2e` (including T005's extended `shell-smoke.spec.ts`) and confirm 0 regressions
- [X] T035 Walk through quickstart.md's "Manual validation (browser)" steps 1–6 in a real browser (`npm run dev`) and confirm every observed behavior matches
- [ ] T036 Update `README.md`'s "Status" section to record Phase 4 (diary, search, progression) complete, per this project's convention of keeping that section current at each phase boundary
- [ ] T037 Update `specs/004-diary-search-progression/spec.md`'s Status line to `Implemented — merged to main via PR #<N>` once the PR merges (per the `sdd-workflow` skill's Status-field convention) — the final commit of this feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the router in particular: every screen needs a route to mount at).
- **User Stories (Phase 3–5)**: All depend on Foundational completion. US1 (diary) has no dependency on US2/US3. US2 (search) has no dependency on US1/US3, but T019 adds a diary→search link once both exist. US3 (progression) has no dependency on US1/US2's *logic*, but T031's cross-links assume US2's search screen (T018) and US1's session detail screen (T013) already exist — so while US3's own `application/progression/*` tasks (T020–T027) can run any time after Foundational, T031 should land last.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests before implementation (write T006–T009 / T015–T016 / T020–T023 first, confirm they fail against `Not implemented` stubs or missing files, then implement).
- `application/` derivation before `presentation/` screens that consume it.
- Route wiring (the last task in each story) after that story's screen component exists.

### Parallel Opportunities

- All Phase 1 and Phase 2 `[P]` tasks (T002, T003) can run in parallel; T004/T005 depend on nothing in Phase 2 landing first but should follow T002 for `DateRange` to exist when screens reference it later.
- All test tasks within a story marked `[P]` can run in parallel with each other (different files).
- US1 and US2's `application/`-layer tasks (T010–T011, T017) have no shared files and can run in parallel; their `presentation/`-layer tasks (T012–T013, T018) likewise.
- Within US3, T024/T025 are independent and parallel; T026 depends on T024; T027 depends on T024–T026.

---

## Parallel Example: User Story 3

```bash
# Launch US3's independent unit tests together:
Task: "Unit test test/unit/application/progression/e1rm.test.ts"
Task: "Unit test test/unit/application/progression/tonnage.test.ts"
Task: "Unit test test/unit/application/progression/best-working-set.test.ts"
Task: "Unit test test/unit/application/progression/progression-series.test.ts"

# Launch US3's independent pure-logic modules together:
Task: "Create src/application/progression/e1rm.ts"
Task: "Create src/application/progression/tonnage.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (diary/history).
4. **STOP and VALIDATE**: exercise contracts/screen-contracts.md's diary scenarios by hand.
5. This alone already delivers real user value (S8 in `docs/requirements.md` §2 — "skim what I've trained lately") even before search/progression exist.

### Incremental Delivery

1. Setup + Foundational → router and `DateRange` helper ready.
2. Add User Story 1 (diary) → validate independently.
3. Add User Story 2 (search) → validate independently; link from diary.
4. Add User Story 3 (progression) → validate independently; link from search and session detail — this closes the MVP loop per `docs/agent-brief.md` Phase 4.
5. Phase 6 polish, then PR.
