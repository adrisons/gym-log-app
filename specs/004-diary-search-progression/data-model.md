# Phase 1 Data Model: Diary, Search and Progression

No new domain entity or value object (confirmed by `schema-guardian`
during spec review — see spec.md's commit history). This spec reads the
existing entities finalized by specs 001/002
(`docs/requirements.md` §3, `src/domain/`): `Session`, `Block`,
`ExerciseEntry`, `Set`, `Exercise`, and the `Load`/`Volume`/`Effort` value
objects — unchanged.

This document defines the shapes of the **derived, in-memory-only** data
this spec introduces (never persisted, never a second source of truth per
`docs/requirements.md` §6 and spec.md FR-023), and the pure functions that
produce them, for `/speckit-tasks` to turn into concrete file-level tasks.

## Derived: Diary summary

Produced by `application/diary/diary-summary.ts` from one `Session` plus a
`Map<ExerciseId, Exercise>` (built once per screen render from
`listExercises()`).

```ts
interface DiarySessionSummary {
  sessionId: SessionId;
  dateTime: string; // Session.dateTime, unchanged
  mainExerciseNames: string[]; // distinct Exercise.canonicalName, in
                                 // first-referenced order
  setCount: number; // total Sets across every Block/ExerciseEntry
  kindOfWork: string | undefined; // derived from referenced Exercises'
                                    // movementPattern; undefined when none
                                    // of the session's exercises have one
                                    // set (neutral label at render time)
}
```

**Validation / derivation rules** (FR-002, spec.md Assumptions):

- `mainExerciseNames` MUST list every distinct `Exercise` referenced by the
  session's `ExerciseEntry`s (by `exerciseId`, resolved through the
  supplied map) — never a truncated set at the data layer (truncation for
  display, e.g. "+2 more", is a `presentation/` concern only).
- `setCount` MUST equal the sum of `sets.length` across every `Block` and
  `ExerciseEntry` in the session, including non-working (warm-up) sets —
  FR-002 says "set count," not "working set count."
- `kindOfWork` is never a stored/settable field; it is always recomputed
  from the current state of the referenced `Exercise`s at render time, so
  a later change to an exercise's `movementPattern` (or a merge/rename)
  changes past sessions' displayed kind-of-work on next read, per the
  Edge Cases in spec.md.

## Derived: Diary grouping

Produced by `application/diary/diary-grouping.ts`.

```ts
interface DiaryMonthGroup {
  monthKey: string; // e.g. "2026-09", derived from each session's local
                      // calendar date (Intl.DateTimeFormat, per research.md §6)
  sessions: DiarySessionSummary[]; // reverse-chronological within the group
}

function groupSessionsByMonth(
  summaries: DiarySessionSummary[],
): DiaryMonthGroup[]; // groups reverse-chronological (most recent month first)

function findNearestSessionDate(
  summaries: DiarySessionSummary[],
  target: string, // ISO date
): SessionId | undefined; // FR-003's tie-break: nearest on/after `target`,
                            // else nearest before; undefined when `summaries` is empty
```

## Derived: Search result

Produced by `application/search/exercise-search.ts`, wrapping
`shared/fuzzy-match.ts`'s existing `matchExercise`.

```ts
function searchExercises(
  query: string,
  catalogue: Exercise[], // from listExercises()
): Exercise[]; // ranked best-first, per FR-007/008/009; [] on no match (FR-012)
```

No new type — this is a thin, stateless wrapper; `Exercise` itself is
unchanged. Never caches its input: every call re-reads whatever
`catalogue` it is given, so there is nothing that can go stale (FR-011).

## Derived: Progression eligibility and per-set metrics

Produced by `application/progression/e1rm.ts` and `tonnage.ts`.

```ts
function isE1rmEligible(set: Set): boolean;
// true iff: (load.kind === 'weight')
//        or (load.kind === 'bodyweight' and addedOrAssistedKg is a number)
//   and volume?.kind === 'reps' and 1 <= volume.count <= 12
//   and setKind !== 'warmUp' (FR-015's working-set scope)

function estimatedOneRepMax(set: Set): number;
// precondition: isE1rmEligible(set) === true
// Epley: numericLoadValue(set.load) * (1 + volume.count / 30)

interface SessionTonnage {
  value: number;
  unit: 'kg' | 'lb' | 'reps'; // 'reps' when any contributing set has a
                                // non-numeric load (FR-018's fallback)
}

function sessionTonnage(workingSets: Set[]): SessionTonnage;
```

**Rules** (FR-017/FR-018, `docs/requirements.md` §5.2/§5.3):

- `estimatedOneRepMax` is only ever called on eligible sets; ineligible
  sets contribute nothing to a session's e1RM (FR-017's "maximum across
  its qualifying working sets").
- `sessionTonnage` sums `load × reps` only over sets with a numeric load
  (`weight`, or `bodyweight` with a numeric added component); if the
  working-set list is a mix of numeric and non-numeric loads, the numeric
  ones still sum normally into a `kg`/`lb` tonnage — the `'reps'` fallback
  unit applies only when computing tonnage for an exercise/session whose
  working sets have no numeric load at all (consistent with FR-021's
  exercise-level, not set-level, degradation trigger).

## Derived: Best working set

Produced by `application/progression/best-working-set.ts`.

```ts
function bestWorkingSet(
  sets: Set[], // already filtered to one session's Sets for one exercise
): Set | undefined; // undefined iff `sets` contains no working set
                      // (setKind 'working' or 'toFailure')
```

Implements FR-015's fixed three-tier ranking: highest-e1RM eligible set,
else highest numeric load, else highest rep count — independent of the
progression chart's currently-selected metric.

## Derived: Progression series (list rows + chart points + PRs)

Produced by `application/progression/progression-series.ts` — the one
stateful-shaped orchestrator (still a pure function of its inputs, no
hidden state) that the progression screen consumes directly.

```ts
type ProgressionMetric = 'e1rm' | 'topLoad' | 'tonnage' | 'repsAtLoad';
type ProgressionRange = '3m' | '6m' | '12m' | 'all';

interface ProgressionListRow {
  sessionId: SessionId;
  dateTime: string;
  bestSet: Set | undefined; // from bestWorkingSet(); undefined only if a
                              // session somehow has zero working sets for
                              // this exercise (excluded from the list per
                              // FR-014's "at least one Set" — kept in the
                              // type for the orchestrator's internal use)
  setCount: number; // Sets logged for this exercise in this session
  isPersonalRecord: boolean; // per the currently-selected metric, FR-020
}

interface ProgressionChartPoint {
  sessionId: SessionId;
  dateTime: string;
  value: number | undefined; // undefined when this session has no value
                               // for the selected metric (e.g. e1RM with
                               // no eligible set that session) — omitted
                               // from the plotted line, not shown as 0
  isPersonalRecord: boolean;
}

interface ProgressionSeries {
  metric: ProgressionMetric;
  metricAvailable: boolean; // false only for 'e1rm' when FR-021 applies
  metricUnavailableReason: string | undefined; // FR-021's one-sentence
                                                  // explanation, set iff
                                                  // metric === 'e1rm' and
                                                  // metricAvailable === false
  availableMetrics: ProgressionMetric[]; // metrics actually offered for
                                           // this exercise (FR-021/FR-022)
  listRows: ProgressionListRow[]; // reverse chronological, unfiltered by
                                    // range (FR-014 doesn't mention a range)
  chartPoints: ProgressionChartPoint[]; // filtered to the selected range
}

function buildProgressionSeries(
  exerciseSessions: Session[], // pre-filtered: sessions with >=1 Set for the target exercise
  exerciseId: ExerciseId,
  metric: ProgressionMetric,
  range: ProgressionRange,
  fixedLoadValue?: number, // required, and used, only when metric === 'repsAtLoad'
): ProgressionSeries;
```

**Rules** (FR-014/016/017/018/019/020/021/022):

- `listRows` always covers full history (list has no range selector per
  spec.md's acceptance scenarios); `chartPoints` is filtered by `range`.
- `isPersonalRecord` on both a list row and a chart point is computed
  against the **entire** unfiltered history's maximum for the
  currently-selected metric (FR-020, corrected to an all-time maximum,
  not a running one) — a session outside the chart's selected range can
  still be the all-time PR and would show as one if the range were
  widened to include it, but a PR mark is only actually rendered on
  points/rows currently visible.
- `metricAvailable` is `false` only for `'e1rm'` when no session in
  `exerciseSessions` contains an `isE1rmEligible` set (FR-021); the other
  three metrics are always available since tonnage/top-load/reps-at-load
  all have non-numeric-load fallbacks or apply directly.
- `repsAtLoad`'s `fixedLoadValue` selection (which logged load value to
  track reps against) is a `presentation/`-layer choice (defaulting to the
  most recent or most frequent logged load, per spec.md Assumptions); this
  function only requires the value be supplied.
