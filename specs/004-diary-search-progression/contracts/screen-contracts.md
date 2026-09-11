# Contract: Diary, search and progression screens

This spec adds no API/port contract (no new `StoragePort` method, per
spec.md and `schema-guardian`'s review). Its "contract" is the observable
behavior of three new screens against the derivation functions in
`data-model.md`, each restating a spec.md Acceptance Scenario. Given/When/
Then below is the executable form `/speckit-tasks` turns into component
tests (`@testing-library/react`) and unit tests for the pure functions
they call.

## Diary screen (`presentation/diary/diary-screen.tsx`)

Consumes: `listSessions(allStoredDataRange())`, `listExercises()`,
`diary-summary.ts`, `diary-grouping.ts`.

1. **Given** sessions across multiple months, **When** the screen renders,
   **Then** it shows `DiaryMonthGroup`s from `groupSessionsByMonth`,
   most-recent month first, each session reverse-chronological within its
   group. *(FR-001, Acceptance Scenario 1)*
2. **Given** a session with 2 blocks / 3 exercises / 7 sets, **When**
   rendered, **Then** its summary line shows date, main exercise names,
   "7" as the set count, and a kind-of-work label (or the neutral
   fallback). *(FR-002, Scenario 2)*
3. **Given** the screen, **When** the user picks a date via the jump-to-
   date control, **Then** the view scrolls/navigates to
   `findNearestSessionDate`'s result. *(FR-003, Scenario 5)*
4. **Given** a session row, **When** tapped, **Then** the router navigates
   to `/diary/:sessionId`. *(FR-004, Scenario 3)*
5. **Given** zero stored sessions, **When** the screen renders, **Then**
   it shows the FR-006 empty state, not an empty list. *(Scenario 6)*

## Session detail screen (`presentation/diary/session-detail-screen.tsx`)

Consumes: `getSession(sessionId)`, reuses existing `presentation/logging/`
editing components (block-card, exercise-entry-card, set-row, etc.).

1. **Given** a session's detail view is open, **When** the user edits a
   set's load/effort/volume or adds/removes a set, **Then** the change is
   persisted via the existing `StoragePort.saveSession` (no new call site)
   and is visible on next visit to the diary/detail view. *(FR-005,
   Scenario 4)*

## Exercise search screen (`presentation/search/exercise-search-screen.tsx`)

Consumes: `listExercises()`, `exercise-search.ts`.

1. **Given** "Sentadilla" in the catalogue, **When** the user types
   "sentadilla" (any case), "sentadila" (typo), or "senta" (partial),
   **Then** it appears in results. *(FR-007/008/009, Scenario 1)*
2. **Given** "Peso muerto" aliased "deadlift", **When** the user types
   "deadlift", **Then** it appears. *(FR-007, Scenario 2)*
3. **Given** a 500-exercise catalogue, **When** a search runs, **Then**
   `exercise-search.test.ts`'s benchmark asserts completion under 100ms.
   *(FR-010, Scenario 3, research.md §2)*
4. **Given** a query matching nothing, **When** search runs, **Then** the
   screen shows an explicit "no results" state. *(FR-012, Scenario 4)*
5. **Given** the catalogue changes (rename/merge/create) via existing
   flows, **When** a search runs afterward, **Then** results reflect the
   change immediately (no cached index to invalidate). *(FR-011,
   Scenario 5)*

## Progression screen (`presentation/progression/progression-screen.tsx`, `-list.tsx`, `-chart.tsx`)

Consumes: `listSessions(allStoredDataRange())` filtered to sessions
referencing the target exercise, `progression-series.ts`.

1. **Given** an exercise logged across 5 sessions, **When** the screen
   opens, **Then** `progression-list.tsx` renders one
   `ProgressionListRow` per session, reverse chronological, each with
   date, best working set's load/volume, its effort if recorded, and set
   count. *(FR-014, Scenario 1)*
2. **Given** the same history, **When** "estimated 1RM" is selected,
   **Then** `progression-chart.tsx` plots each session's e1RM per
   `buildProgressionSeries(..., 'e1rm', ...)`. *(FR-016/017, Scenario 2)*
3. **Given** the same history, **When** top load / tonnage / reps-at-load
   is selected, **Then** the chart plots that metric instead.
   *(FR-016/018, Scenario 3)*
4. **Given** the chart, **When** the range selector changes (3m/6m/12m/
   all), **Then** `chartPoints` are filtered accordingly; `listRows` stay
   full-history. *(FR-019, Scenario 4)*
5. **Given** a session holds the all-time-best value for the selected
   metric, **When** the list and chart render, **Then** that row/point's
   `isPersonalRecord` is `true` and shown with a visual mark. *(FR-020,
   Scenario 5)*
6. **Given** an exercise with only `Band`/`FreeText`-load sets (or
   zero-added-load `Bodyweight` sets — no e1RM-eligible set anywhere),
   **When** the screen opens, **Then** `metricAvailable` is `false` for
   `'e1rm'`, that option is not offered, and
   `metricUnavailableReason` is shown as one sentence. *(FR-021,
   Scenario 6)*
7. **Given** history mixing eligible and ineligible sessions, **When**
   "estimated 1RM" is selected, **Then** only eligible sessions' points
   are plotted (ineligible sessions contribute `value: undefined`,
   omitted from the line, not shown as zero). *(FR-022)*
8. **Given** an exercise with 1 session of data, **When** the screen
   opens, **Then** it still renders (a single list row, a single chart
   point or an explicit "not enough data yet" state) — no artificial
   minimum blocks the screen. *(Scenario 7)*

## Composition root (`presentation/main.tsx`)

1. **Given** the app mounts, **When** `react-router-dom` routes are
   registered, **Then** `/` still renders `LoggingScreen` exactly as
   before this spec (existing smoke tests unchanged, research.md §3).
