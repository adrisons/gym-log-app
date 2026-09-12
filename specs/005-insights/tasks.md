---

description: "Task list for Insights (Phase 5)"

---

# Tasks: Insights

**Input**: Design documents from `specs/005-insights/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/screen-contracts.md](./contracts/screen-contracts.md), [quickstart.md](./quickstart.md)

**Tests**: The constitution's Development Workflow section requires "every new behaviour has at least one test" — test tasks are included and are NOT optional for this feature. This spec is almost entirely pure `application/insights/` computation, proven with Vitest unit tests against plain fixture data; one component test covers the Insights screen against `InMemoryStorageAdapter`.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story. Priorities per spec.md: US1 (per-exercise progress) and US2 (recent records) are P1; US3 (detected plateau) and US4 (aggregate progress) are P2; US5 (consistency) and US6 (push/pull balance) are P3. US3 depends on Foundational's `exercise-trend.ts` (shared with US1); US4 depends on US1's own per-exercise-progress output shape (`PerExerciseProgressCard[]`), so US4 is sequenced after US1 despite both being independently valuable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = per-exercise progress, US2 = recent records, US3 = plateau, US4 = aggregate progress, US5 = consistency, US6 = push/pull balance)

## Path Conventions

Single project (`src/`, `test/` at repository root), per [plan.md](./plan.md)'s Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: directory scaffolding. No new dependency to install.

- [ ] T001 Create the new directories this feature's files land in: `src/application/insights/`, `src/presentation/insights/`, `test/unit/application/insights/`, `test/unit/presentation/insights/` (no files yet — Phase 2 creates the first real content)

**Checkpoint**: directories exist — Phase 2 can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared trend-computation module (US1 and US3 both depend on it), the orchestrator skeleton, the shared presentational components, and the composition-root route — every user story's screen section renders through these.

**⚠️ CRITICAL**: No user-story implementation task can begin until this phase is complete.

- [ ] T002 [P] Create `src/application/insights/exercise-trend.ts`: `dailyE1rmValues(sessions: Session[], exerciseId: ExerciseId): DailyE1rm[]` (groups e1RM-eligible working sets — reuse `isE1rmEligible`/`estimatedOneRepMax` from `src/application/progression/e1rm.ts` — by the session's local calendar date, one entry per distinct qualifying day holding the day's maximum e1RM, ascending by date) and `computeExerciseTrend(daily: DailyE1rm[]): ExerciseTrendResult | undefined` (data-model.md "Derived: Exercise trend" — `undefined` when `daily.length < 6`; otherwise `percentChange = round((medianOf(last 3 by date) - medianOf(first 3 by date)) / medianOf(first 3 by date) * 100)` per `docs/requirements.md` §5.4, plus `distinctQualifyingDays`, `sessionCount` — the count of distinct Sessions contributing at least one eligible set among `daily`'s source data — `daySpanWithinWindow`, `periodStart`, `periodEnd`)
- [ ] T003 [P] Unit test `test/unit/application/insights/exercise-trend.test.ts`: `dailyE1rmValues` takes the max e1RM across two sessions on the same calendar day (§3.1 allows more than one session per day) as a single day entry; `computeExerciseTrend` returns `undefined` for fewer than 6 daily entries; returns the correct §5.4 percentage for a known 6-point fixture (verify by hand-computed medians); `daySpanWithinWindow`/`periodStart`/`periodEnd` match the fixture's earliest/latest qualifying days
- [ ] T004 [P] Create `src/application/insights/build-insights.ts`: `export interface CardTypeResult<TCard> { cards: TCard[]; missingDataExplanation: string | undefined }` and `export interface InsightsResult { perExerciseProgress: CardTypeResult<PerExerciseProgressCard>; aggregateProgress: CardTypeResult<AggregateProgressCard>; recentRecords: CardTypeResult<RecentRecordEntry>; plateau: CardTypeResult<PlateauCard>; consistency: CardTypeResult<ConsistencyResult>; pushPullBalance: CardTypeResult<PushPullBalanceResult> }` and `export function buildInsights(sessions: Session[], exercises: Exercise[]): InsightsResult` — every field starts as `{ cards: [], missingDataExplanation: 'Not yet implemented' }` as a temporary placeholder, replaced by each user-story task below (T009, T013, T018, T023, T027, T032) with its own real computation and card-type-specific missing-data wording (FR-015)
- [ ] T005 [P] Create `src/presentation/insights/insight-card.tsx`: a shared presentational component taking `{ claim: string; period: string; sessionCount: number; linkTo?: string }` per FR-014's fixed shape (claim + number-bearing text + period + supporting session count, from a template filled by the caller — this component renders the shape, it does not compute wording) and rendering an optional link
- [ ] T006 [P] Create `src/presentation/insights/missing-data-notice.tsx`: a shared component taking `{ explanation: string }`, rendering FR-015's per-card-type explanation text
- [ ] T007 Create `src/presentation/insights/insights-screen.tsx`: reads `listExercises()` then `listSessions(allStoredDataRange())` via `requireStorage()` (spec 004's `@/application/storage-access`), calls `buildInsights`, and renders six sections (one per `InsightsResult` field) each showing its `cards` through `insight-card.tsx` or its `missingDataExplanation` through `missing-data-notice.tsx` when `cards` is empty
- [ ] T008 Edit `src/presentation/main.tsx`: add an `/insights` route rendering `InsightsScreen` (contracts scenario "composition root and navigation" #1); edit `src/presentation/diary/diary-screen.tsx` to add a `Link` to `/insights` alongside its existing `/search` link (contracts scenario #2)

**Checkpoint**: the shared trend module, orchestrator skeleton, shared components, screen, and route all exist — user-story implementation work can now begin.

---

## Phase 3: User Story 1 - See whether one exercise is improving (Priority: P1) 🎯 MVP

**Goal**: A per-exercise progress card for every Exercise clearing FR-002/003's threshold (FR-002 through FR-003).

**Independent Test**: contracts/screen-contracts.md's "Per-exercise progress" scenarios pass against `InMemoryStorageAdapter` fixtures.

### Tests for User Story 1

- [ ] T009 [P] [US1] Unit test `test/unit/application/insights/per-exercise-progress.test.ts`: an exercise with e1RM-eligible sets across 6 distinct days spanning >=21 days in the last 90 days produces a card with the correct `ExerciseTrendResult`; an exercise with only 3 sessions, or a >=6-day span under 21 days, produces no card; a Band/FreeText-only exercise produces no card (FR-002/003, screen-contracts.md scenarios 1-4)

### Implementation for User Story 1

- [ ] T010 [US1] Create `src/application/insights/per-exercise-progress.ts`: `export interface PerExerciseProgressCard { exerciseId: ExerciseId; exerciseName: string; trend: ExerciseTrendResult }` and `export function buildPerExerciseProgressCards(sessions: Session[], exercises: Exercise[]): PerExerciseProgressCard[]` — filters `sessions` to the trailing 90 days, calls `dailyE1rmValues`/`computeExerciseTrend` (T002) per Exercise, keeps only results with `distinctQualifyingDays >= 6 AND daySpanWithinWindow >= 21` (§5.7's Exercise trend row)
- [ ] T011 [US1] Wire `buildPerExerciseProgressCards` into `build-insights.ts`'s `perExerciseProgress` field (replacing T004's placeholder), with `missingDataExplanation` set (e.g. "log an exercise a few more times, spanning at least 3 weeks, to see its trend") only when `cards.length === 0`
- [ ] T012 [US1] Add the per-exercise-progress section to `insights-screen.tsx`: each card's claim text names the exercise and percentage change, its period is `trend.periodStart`–`trend.periodEnd`, its session count is `trend.sessionCount`, and it links to `/exercises/:exerciseId/progression` (spec 004)

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - See recent personal records (Priority: P1) 🎯 MVP

**Goal**: A recent-records entry for every (Exercise, metric) pair whose all-time-best value was achieved in the trailing 30 days (FR-006/007).

**Independent Test**: contracts/screen-contracts.md's "Recent records" scenarios pass against `InMemoryStorageAdapter` fixtures.

### Tests for User Story 2

- [ ] T013 [P] [US2] Unit test `test/unit/application/insights/recent-records.test.ts`: a session within 30 days tying/beating an exercise's all-time-best e1RM produces one entry with the correct metric/value/date; a record set >30 days ago with nothing since produces no entry; two in-window sessions tying the same (exercise, metric) pair's record consolidate into one entry showing the most recent date (FR-007's tie rule); an exercise with a Band-only load history never produces an 'e1rm' entry, only the metrics `buildProgressionSeries`'s `availableMetrics` actually offers it (screen-contracts.md scenarios 1-3)

### Implementation for User Story 2

- [ ] T014 [US2] Create `src/application/insights/recent-records.ts`: `export interface RecentRecordEntry { exerciseId: ExerciseId; exerciseName: string; metric: ProgressionMetric; value: number; dateAchieved: string; sessionId: SessionId }` and `export function buildRecentRecords(exercisesWithAllSessions: { exercise: Exercise; sessions: Session[] }[]): RecentRecordEntry[]` — for each exercise, for each metric in `buildProgressionSeries(sessions, exercise.id, metric, 'all').availableMetrics`, take `listRows` where `isPersonalRecord` and `dateTime` is within the trailing 30 days, keeping only the most recent row per (exercise, metric) pair when more than one qualifies
- [ ] T015 [US2] Wire `buildRecentRecords` into `build-insights.ts`'s `recentRecords` field, grouping `sessions`/`exercises` by exercise first (all-time history needed per exercise, not window-limited — data-model.md's "Derived: Recent records card" note), with `missingDataExplanation` set (e.g. "nothing new has been set in the last 30 days") only when empty
- [ ] T016 [US2] Add the recent-records section to `insights-screen.tsx`: each entry's claim names the exercise, metric, and value, its period is the 30-day window, and it links to `/exercises/:exerciseId/progression`

**Checkpoint**: User Stories 1 AND 2 both work independently — the MVP scope for this phase.

---

## Phase 5: User Story 3 - Detect a plateau (Priority: P2)

**Goal**: A plateau card for every e1RM-eligible Exercise whose trailing-8-week trend is flat (FR-008/009).

**Independent Test**: contracts/screen-contracts.md's "Detected plateau" scenarios pass against `InMemoryStorageAdapter` fixtures.

### Tests for User Story 3

- [ ] T017 [P] [US3] Unit test `test/unit/application/insights/plateau.test.ts`: an exercise with 6 distinct qualifying days in the trailing 8 weeks and an absolute percentage change under 2% produces a card; the same shape with a change of 2% or more produces no card; fewer than 6 distinct qualifying days in the 8-week window produces no card (FR-008/009, screen-contracts.md scenarios 1-3)

### Implementation for User Story 3

- [ ] T018 [US3] Create `src/application/insights/plateau.ts`: `export interface PlateauCard { exerciseId: ExerciseId; exerciseName: string; trend: ExerciseTrendResult }` and `export function buildPlateauCards(sessions: Session[], exercises: Exercise[]): PlateauCard[]` — filters `sessions` to the trailing 8 weeks, calls `dailyE1rmValues`/`computeExerciseTrend` (T002) per Exercise, keeps only results with `distinctQualifyingDays >= 6 AND Math.abs(trend.percentChange) < 2` (§5.7's Plateau row — no day-span minimum, per spec.md's corrected FR-008)
- [ ] T019 [US3] Wire `buildPlateauCards` into `build-insights.ts`'s `plateau` field, with `missingDataExplanation` set only when empty AND at least one exercise has any e1RM-eligible history at all (per screen-contracts.md scenario 3's "no explanation is owed for this specific exercise" — the section-level explanation covers the card type having nothing to show overall, not every individually-non-qualifying exercise)
- [ ] T020 [US3] Add the plateau section to `insights-screen.tsx`: each card's claim names the exercise and the near-zero change, its period is the trailing 8 weeks, its session count is `trend.sessionCount`, and it links to `/exercises/:exerciseId/progression`

**Checkpoint**: User Stories 1, 2, AND 3 all work independently.

---

## Phase 6: User Story 4 - See progress across a movement pattern or muscle group (Priority: P2)

**Goal**: An aggregate progress card for every movement-pattern or muscle-group value with >=2 contributing exercises (FR-004/005).

**Independent Test**: contracts/screen-contracts.md's "Aggregate progress" scenarios pass against `InMemoryStorageAdapter` fixtures.

**Depends on**: User Story 1's `PerExerciseProgressCard[]` output shape (`per-exercise-progress.ts`, T010).

### Tests for User Story 4

- [ ] T021 [P] [US4] Unit test `test/unit/application/insights/aggregate-progress.test.ts`: two exercises sharing a `movementPattern` (also tested case/accent-insensitively, e.g. "Legs" vs "legs") that each individually qualify (fixture `PerExerciseProgressCard[]`) produce one aggregate card with the correct session-count-weighted mean; only one qualifying exercise in a group produces no card; an exercise with two `muscleGroups` entries contributes independently to both groups' aggregates in addition to its own movement-pattern aggregate (FR-004/005, screen-contracts.md scenarios 1-2)

### Implementation for User Story 4

- [ ] T022 [US4] Create `src/application/insights/aggregate-progress.ts`: `export type GroupKind = 'movementPattern' | 'muscleGroup'` and `export interface AggregateProgressCard { groupKind: GroupKind; groupName: string; weightedPercentChange: number; periodStart: string; periodEnd: string; contributingExercises: PerExerciseProgressCard[] }` and `export function buildAggregateProgressCards(perExerciseCards: PerExerciseProgressCard[], exercises: Exercise[]): AggregateProgressCard[]` — groups `perExerciseCards` by each contributing Exercise's `movementPattern` and each entry of its `muscleGroups`, comparing group keys via `normalize()` from `@/shared/fuzzy-match` (case/accent-insensitive, per research.md §2), keeping the first-encountered original casing as `groupName`; for each group with >= 2 contributing cards, `weightedPercentChange = sum(card.trend.percentChange * card.trend.sessionCount) / sum(card.trend.sessionCount)` (data-model.md)
- [ ] T023 [US4] Wire `buildAggregateProgressCards` into `build-insights.ts`'s `aggregateProgress` field (fed by T010's `buildPerExerciseProgressCards` output plus the full `exercises` list), with `missingDataExplanation` distinguishing, per spec.md's FR-015 (folding in `docs/requirements.md` FR-5): when zero exercises in the catalogue have any `movementPattern`/`muscleGroups` value at all, say so specifically; otherwise, when groups exist but none clear the >=2-contributor threshold, use the generic "not enough qualifying exercises in any shared group yet" wording
- [ ] T024 [US4] Add the aggregate-progress section to `insights-screen.tsx`: each card's claim names the group and weighted percentage change, its period covers the 90-day window, and it lists/links each contributing exercise to its own progression screen

**Checkpoint**: User Stories 1-4 all work independently.

---

## Phase 7: User Story 5 - See how consistently I've trained (Priority: P3)

**Goal**: A consistency card reporting trained-weeks-out-of-covered-weeks once >=4 weeks of history exist (FR-010/011).

**Independent Test**: contracts/screen-contracts.md's "Consistency" scenarios pass against `InMemoryStorageAdapter` fixtures.

### Tests for User Story 5

- [ ] T025 [P] [US5] Unit test `test/unit/application/insights/consistency.test.ts`: sessions spread across 6 of a trailing 12 ISO weeks (with the other 6 weeks empty) produce `{ trainedWeeks: 6, totalWeeks: 12 }`; a person with only 5 weeks of total history produces `totalWeeks: 5` (clipped to actual history, not padded to 12); fewer than 4 weeks of total history produces `undefined` (FR-010/011, screen-contracts.md scenarios 1-2)

### Implementation for User Story 5

- [ ] T026 [US5] Create `src/application/insights/consistency.ts`: `export interface ConsistencyResult { trainedWeeks: number; totalWeeks: number; periodStart: string; periodEnd: string }` and `export function computeConsistency(sessions: Session[]): ConsistencyResult | undefined` — buckets each Session's local calendar date into an ISO 8601 (Monday-start) week (research.md §4, plain `Date` arithmetic, no library), counts distinct weeks with >=1 session within `min(12, weeksSinceEarliestSession)` trailing weeks, returns `undefined` when the person's full history spans fewer than 4 weeks (§5.7)
- [ ] T027 [US5] Wire `computeConsistency` into `build-insights.ts`'s `consistency` field (called with the full, unfiltered `sessions` list — data-model.md notes this needs full history, not a pre-windowed slice), with `missingDataExplanation` set (e.g. "log sessions across at least 4 weeks to see your consistency") only when `undefined`
- [ ] T028 [US5] Add the consistency section to `insights-screen.tsx`: the card's claim states trained/covered weeks, its period is `periodStart`–`periodEnd`, no link target (this card has no single underlying exercise/session to drill into — links to the diary screen instead, per FR-9's general "links through to the raw data" intent)

**Checkpoint**: User Stories 1-5 all work independently.

---

## Phase 8: User Story 6 - See push/pull balance (Priority: P3)

**Goal**: A push/pull balance card once >=20 classified working sets exist in the trailing 90 days (FR-012/013).

**Independent Test**: contracts/screen-contracts.md's "Push/pull balance" scenarios pass against `InMemoryStorageAdapter` fixtures.

### Tests for User Story 6

- [ ] T029 [P] [US6] Unit test `test/unit/application/insights/push-pull-classification.test.ts`: `classifyMovementPattern('Press')` and `classifyMovementPattern('close-grip bench press')` both return `'push'`; `classifyMovementPattern('Row')`/`'horizontal pull'` return `'pull'`; `classifyMovementPattern('compression')` returns `'unclassified'` (proving whole-word match, not substring — FR-012's spec-reviewer-resolved correction); `classifyMovementPattern('SENTADILLA')` and `classifyMovementPattern(undefined)` both return `'unclassified'`; matching is case/accent-insensitive (e.g. `'empuje'`-style accented input, if included in the fixture list, normalizes the same as its unaccented form)
- [ ] T030 [P] [US6] Unit test `test/unit/application/insights/push-pull-balance.test.ts`: 20+ working sets split across push/pull-classified exercises in the trailing 90 days produce the correct `{ pushCount, pullCount }`; fewer than 20 classified sets (whether from too few total sets or too many unclassified ones) returns `undefined`; a set whose exercise has no `movementPattern` is excluded from both counts and from the 20-set threshold (FR-012/013, screen-contracts.md scenarios 1-3)

### Implementation for User Story 6

- [ ] T031 [US6] Create `src/application/insights/push-pull-classification.ts`: `export type PushPullClassification = 'push' | 'pull' | 'unclassified'` and `export function classifyMovementPattern(movementPattern: string | undefined): PushPullClassification` — normalizes via `normalize()` from `@/shared/fuzzy-match`, splits on whitespace, returns `'push'`/`'pull'` if any resulting word exactly equals an entry in a fixed, exported `PUSH_KEYWORDS`/`PULL_KEYWORDS` array (research.md §2 — illustrative lists per spec.md Assumptions: push = ["push", "press", "horizontal push", "vertical push"], pull = ["pull", "row", "horizontal pull", "vertical pull"], each keyword itself normalized), else `'unclassified'`
- [ ] T032 [US6] Create `src/application/insights/push-pull-balance.ts`: `export interface PushPullBalanceResult { pushCount: number; pullCount: number; periodStart: string; periodEnd: string }` and `export function computePushPullBalance(sessions: Session[], exercises: Exercise[]): PushPullBalanceResult | undefined` — filters `sessions` to the trailing 90 days, classifies every working Set (via its Exercise entry's referenced Exercise's `movementPattern` through T031's `classifyMovementPattern`), tallies push/pull counts, returns `undefined` when `pushCount + pullCount < 20` (§5.7); wire into `build-insights.ts`'s `pushPullBalance` field with `missingDataExplanation` set (e.g. "log 20 more classifiable working sets to see your push/pull balance") only when `undefined`
- [ ] T033 [US6] Add the push/pull-balance section to `insights-screen.tsx`: the card's claim states the percentage split and classified-set count, its period is the trailing 90 days, no link target (same rationale as US5's consistency card)

**Checkpoint**: All six user stories are independently functional — every spec.md card type renders on one Insights screen.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: full-suite verification and documentation, once all six stories are in place.

- [ ] T034 [P] Run `npm run typecheck`, `npm run lint`, `npm run check:no-color-literals` and fix anything the new files trip (Definition of Done)
- [ ] T035 [P] Run `npm run test:unit` (all new unit/component tests plus the full existing suite) and confirm 0 regressions
- [ ] T036 Add the performance assertion quickstart.md's "Automated validation" describes to `test/unit/application/insights/build-insights.test.ts` (research.md §1 — confirm the naive full-recompute approach is fast enough at a realistic data volume, e.g. a few hundred synthetic sessions, before considering any memoization) — this is also `build-insights.ts`'s own primary unit test, exercising the fully-wired orchestrator (all six real card-type functions, not T004's placeholders) end-to-end against one shared fixture catalogue
- [ ] T037 Run `npm run test:e2e` (including the extended `shell-smoke.spec.ts` route check from T008) and confirm 0 regressions
- [ ] T038 Walk through quickstart.md's "Manual validation (browser)" steps 1-4 in a real browser (`npm run dev`) and confirm every observed behavior matches
- [ ] T039 Update `README.md`'s "Status" section to record Phase 5 (Insights) complete, per this project's convention of keeping that section current at each phase boundary
- [ ] T040 Update `specs/005-insights/spec.md`'s Status line to `Implemented — merged to main via PR #<N>` once the PR merges (per the `sdd-workflow` skill's Status-field convention) — the final commit of this feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (`exercise-trend.ts` in particular is a hard dependency of both US1 and US3; the screen/route in particular is needed for any card to be viewable).
- **User Stories (Phase 3-8)**: All depend on Foundational completion. US1 (T009-T012) and US2 (T013-T016) have no dependency on each other or on US3/US4/US5/US6. US3 (T017-T020) depends only on Foundational's `exercise-trend.ts` (T002), not on US1's own files, but is sequenced after US1/US2 by priority. US4 (T021-T024) depends on US1's `per-exercise-progress.ts` (T010) actually existing, since `aggregate-progress.ts` consumes its `PerExerciseProgressCard[]` output type and fixture shape. US5 (T025-T028) and US6 (T029-T033) have no dependency on any other story.
- **Polish (Phase 9)**: Depends on all six user stories being complete.

### Within Each User Story

- Tests before implementation (write each story's test file(s) first, confirm they fail against missing modules, then implement).
- The pure `application/insights/` module before its `build-insights.ts` wiring, before its `insights-screen.tsx` section.

### Parallel Opportunities

- All Phase 1/Phase 2 `[P]` tasks (T002, T003, T004, T005, T006) can run in parallel; T007 depends on T004/T005/T006 existing; T008 depends on T007.
- US1 and US2 are fully independent of each other and can be implemented in parallel by different contributors once Foundational is done.
- US5 and US6 are fully independent of every other story and of each other.
- Within US6, T029 and T030 (the classification and balance tests) can be written in parallel; T031 must exist before T032's implementation (T032 calls `classifyMovementPattern`).

---

## Parallel Example: User Stories 1, 2, 5, and 6

```bash
# Once Foundational (Phase 2) is complete, these four stories have no
# cross-dependencies and can proceed in parallel:
Task: "Implement User Story 1 (per-exercise progress): T009-T012"
Task: "Implement User Story 2 (recent records): T013-T016"
Task: "Implement User Story 5 (consistency): T025-T028"
Task: "Implement User Story 6 (push/pull balance): T029-T033"

# User Story 3 needs only Foundational's exercise-trend.ts (not US1's own
# files) and could also join this parallel group; User Story 4 must wait
# for User Story 1's per-exercise-progress.ts to exist first.
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (per-exercise progress).
4. Complete Phase 4: User Story 2 (recent records).
5. **STOP and VALIDATE**: exercise contracts/screen-contracts.md's per-exercise-progress and recent-records scenarios by hand — this alone already answers `docs/requirements.md` scenario S5's core question for the exercises a person tracks most.

### Incremental Delivery

1. Setup + Foundational → shared trend module, screen, and route ready.
2. Add User Story 1 (per-exercise progress) → validate independently.
3. Add User Story 2 (recent records) → validate independently (MVP complete after 1+2).
4. Add User Story 3 (plateau) → validate independently.
5. Add User Story 4 (aggregate progress) → validate independently (needs US1's output shape).
6. Add User Story 5 (consistency) → validate independently.
7. Add User Story 6 (push/pull balance) → validate independently — this closes Phase 5 (`docs/agent-brief.md`).
8. Phase 9 polish, then PR.
