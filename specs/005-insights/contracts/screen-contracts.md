# Contract: Insights screen

This spec adds no API/port contract (no new `StoragePort` method, per
spec.md and `schema-guardian`'s review). Its "contract" is the observable
behavior of the Insights screen against the derivation functions in
`data-model.md`, each restating a spec.md Acceptance Scenario.

## Insights screen (`presentation/insights/insights-screen.tsx`)

Consumes: `listSessions(allStoredDataRange())`, `listExercises()`,
`build-insights.ts`'s `buildInsights`.

### Per-exercise progress (User Story 1)

1. **Given** an exercise with e1RM-eligible sets across >=6 distinct days
   spanning >=21 days in the last 90 days, **When** the screen renders,
   **Then** a per-exercise progress card shows its name, percentage
   change, period, and session count, linking to its progression screen.
   *(FR-002/003, Scenario 1-2)*
2. **Given** an exercise logged only 3 times or across <21 days, **When**
   the screen renders, **Then** no card appears for it, and the
   per-exercise-progress section's `missingDataExplanation` is shown.
   *(FR-003/FR-015, Scenario 3)*
3. **Given** an exercise with only `Band`/`FreeText` sets, **When** the
   screen renders, **Then** no per-exercise progress card is computed for
   it. *(Scenario 4)*

### Recent records (User Story 2)

1. **Given** a session within 30 days ties or beats an exercise's
   all-time-best value for some metric, **When** the screen renders,
   **Then** a recent-records entry names the exercise, metric, value, and
   date, linking to the record session. *(FR-006/007, Scenario 1-2)*
2. **Given** an all-time-best value set >30 days ago with nothing tying
   or beating it since, **When** the screen renders, **Then** no entry
   appears for that exercise. *(Scenario 3)*
3. **Given** no record in the last 30 days at all, **When** the screen
   renders, **Then** the recent-records section explains nothing new was
   set recently. *(Scenario 4)*

### Detected plateau (User Story 3)

1. **Given** an e1RM-eligible exercise with >=6 distinct qualifying days
   in the trailing 8 weeks and an absolute percentage change under 2%,
   **When** the screen renders, **Then** a plateau card appears.
   *(FR-008/009, Scenario 1)*
2. **Given** the same window with an absolute change >=2%, **When** the
   screen renders, **Then** no plateau card appears for it. *(Scenario 2)*
3. **Given** fewer than 6 distinct qualifying days in the 8-week window,
   **When** the screen renders, **Then** no plateau card is computed —
   no explanation is owed for this specific exercise (distinct from User
   Story 1's own section-level explanation requirement). *(Scenario 3)*

### Aggregate progress by pattern/muscle group (User Story 4)

1. **Given** >=2 exercises sharing a `movementPattern` or a
   `muscleGroups` entry (case/accent-insensitively) that each
   individually clear the per-exercise-progress threshold, **When** the
   screen renders, **Then** an aggregate card shows the group name, the
   session-count-weighted percentage change, the period, and the
   contributing exercises. *(FR-004/005, Scenario 1-2)*
2. **Given** only one exercise in a group clears the threshold, **When**
   the screen renders, **Then** no aggregate card appears for that group.
   *(Scenario 3)*
3. **Given** zero groups qualify because too few exercises carry a
   `movementPattern`/`muscleGroups` value at all, **When** the screen
   renders, **Then** the aggregate-progress section's explanation says so
   specifically (not merely "not enough sessions"). *(FR-015)*

### Consistency (User Story 5)

1. **Given** >=4 weeks of total training history, **When** the screen
   renders, **Then** a consistency card reports trained-weeks out of
   covered-weeks (up to a trailing 12-week window) and the period.
   *(FR-010/011, Scenario 1)*
2. **Given** <4 weeks of history, **When** the screen renders, **Then**
   no consistency card appears, and the section explains more history is
   needed. *(Scenario 2)*

### Push/pull balance (User Story 6)

1. **Given** >=20 working sets in the trailing 90 days whose exercises'
   `movementPattern` whole-word-matches a recognized push or pull
   keyword, **When** the screen renders, **Then** a balance card shows
   the push/pull percentage split, the period, and the classified-set
   count. *(FR-012/013, Scenario 1)*
2. **Given** <20 classified sets (too few logged, or too few matching
   either keyword list), **When** the screen renders, **Then** no
   balance card appears, and the section explains more classifiable data
   is needed. *(Scenario 2)*
3. **Given** a set whose exercise has no `movementPattern` or one
   matching neither list, **When** balance is computed, **Then** that set
   is excluded from both the numerator and the 20-set denominator.
   *(Scenario 3)*

## Composition root and navigation

1. **Given** the app mounts, **When** the `/insights` route is
   registered, **Then** `/` still renders `LoggingScreen` exactly as
   before this spec (existing smoke tests unchanged).
2. **Given** the diary screen, **When** rendered, **Then** it includes a
   link to `/insights`, alongside its existing `/search` link (spec 004).
