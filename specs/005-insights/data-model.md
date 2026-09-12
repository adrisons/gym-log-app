# Phase 1 Data Model: Insights

No new domain entity, value object, or `StoragePort` method (confirmed by
`schema-guardian` during spec review). This spec reads the existing
Session/Exercise/Set records (specs 001/002) and reuses spec 004's
`src/application/progression/` functions (`isE1rmEligible`,
`estimatedOneRepMax`, `sessionTonnage`, `bestWorkingSet`,
`buildProgressionSeries`) unchanged. Everything below is **derived,
in-memory-only** data (never persisted, never a second source of truth
per `docs/requirements.md` §6 and spec.md FR-001), produced by pure
functions for `/speckit-tasks` to turn into file-level tasks.

## Derived: Exercise trend (shared by per-exercise progress and plateau)

```ts
interface DailyE1rm {
  date: string; // local calendar date, "YYYY-MM-DD"
  value: number; // max estimatedOneRepMax among that day's eligible sets
}

interface ExerciseTrendResult {
  percentChange: number; // §5.4, rounded to nearest integer
  distinctQualifyingDays: number; // count of DailyE1rm points in the window
  sessionCount: number; // count of Sessions contributing >=1 eligible set in the window
  daySpanWithinWindow: number; // days between the earliest and latest qualifying day
  periodStart: string; // earliest qualifying day, ISO date
  periodEnd: string; // latest qualifying day, ISO date
}

function dailyE1rmValues(
  sessions: Session[], // pre-filtered to the exercise's own sessions within the window
  exerciseId: ExerciseId,
): DailyE1rm[]; // one entry per distinct qualifying calendar day, ascending by date

function computeExerciseTrend(
  daily: DailyE1rm[],
): ExerciseTrendResult | undefined;
// undefined when daily.length < 6 (FR-002/FR-008's distinct-day
// requirement — insufficient to form two non-overlapping groups of 3)
```

**Rules** (FR-002, FR-008, `docs/requirements.md` §5.4):

- `percentChange = round((medianOf(last 3) - medianOf(first 3)) / medianOf(first 3) * 100)`,
  where "first 3"/"last 3" are the earliest/latest 3 entries of `daily`
  by date (never overlapping, since `daily.length >= 6` is required to
  produce a result at all).
- `computeExerciseTrend` itself is window-agnostic — it doesn't know
  whether it's being asked for the 90-day or 8-week case; the caller
  (`per-exercise-progress.ts` or `plateau.ts`) pre-filters `sessions` to
  its own window before calling `dailyE1rmValues`.

## Derived: Per-exercise progress card (FR-002/003)

```ts
interface PerExerciseProgressCard {
  exerciseId: ExerciseId;
  exerciseName: string;
  trend: ExerciseTrendResult;
}

function buildPerExerciseProgressCards(
  sessions: Session[], // all sessions within the trailing 90-day window
  exercises: Exercise[],
): PerExerciseProgressCard[];
// one entry per Exercise whose trend.distinctQualifyingDays >= 6 AND
// trend.daySpanWithinWindow >= 21 (§5.7's Exercise trend row)
```

## Derived: Detected plateau card (FR-008/009)

```ts
interface PlateauCard {
  exerciseId: ExerciseId;
  exerciseName: string;
  trend: ExerciseTrendResult; // computed over the trailing 8-week window
}

function buildPlateauCards(
  sessions: Session[], // all sessions within the trailing 8-week window
  exercises: Exercise[],
): PlateauCard[];
// one entry per Exercise whose trend.distinctQualifyingDays >= 6 AND
// Math.abs(trend.percentChange) < 2 (§5.7's Plateau row — no day-span minimum)
```

## Derived: Aggregate progress card (FR-004/005)

```ts
type GroupKind = 'movementPattern' | 'muscleGroup';

interface AggregateProgressCard {
  groupKind: GroupKind;
  groupName: string; // as originally cased/accented on the contributing Exercise(s)
  weightedPercentChange: number;
  periodStart: string;
  periodEnd: string;
  contributingExercises: PerExerciseProgressCard[]; // >= 2
}

function buildAggregateProgressCards(
  perExerciseCards: PerExerciseProgressCard[], // FR-003's own qualifying set
  exercises: Exercise[], // to resolve each card's exerciseId back to its movementPattern/muscleGroups
): AggregateProgressCard[];
```

**Rules** (FR-004/005, `docs/requirements.md` §5.5):

- Grouping key comparison is case/accent-insensitive (`normalize()`,
  research.md §2); the displayed `groupName` uses the first-encountered
  original casing for that normalized key.
- An Exercise with N `muscleGroups` entries contributes its
  `PerExerciseProgressCard` independently to N muscle-group aggregates,
  in addition to its one `movementPattern` aggregate.
- `weightedPercentChange = sum(card.trend.percentChange * card.trend.sessionCount) / sum(card.trend.sessionCount)`
  across the group's contributing cards.
- A group produces a card only when it has >= 2 contributing exercises.

## Derived: Recent records card (FR-006/007)

```ts
interface RecentRecordEntry {
  exerciseId: ExerciseId;
  exerciseName: string;
  metric: ProgressionMetric; // reused from progression-series.ts
  value: number;
  dateAchieved: string; // most recent qualifying session's date, per FR-007's tie rule
  sessionId: SessionId;
}

function buildRecentRecords(
  exerciseSessionsByExercise: Map<ExerciseId, Session[]>, // each exercise's own sessions, all-time (not window-limited — all-time-best needs full history)
  exercises: Exercise[],
): RecentRecordEntry[];
```

**Rules** (FR-006/007, reusing spec 004's `buildProgressionSeries`):

- For each Exercise and each metric in that exercise's
  `buildProgressionSeries(..., metric, 'all').availableMetrics`, call
  `buildProgressionSeries` and take `listRows` where `isPersonalRecord`
  is `true`.
- Among those, keep only rows whose `dateTime` falls within the trailing
  30 days.
- If more than one qualifying row exists for the same (exercise, metric)
  pair, keep only the most recent (FR-007's consolidation rule).

## Derived: Consistency figure (FR-010/011)

```ts
interface ConsistencyResult {
  trainedWeeks: number;
  totalWeeks: number; // min(12, weeks since the earliest session's ISO week)
  periodStart: string;
  periodEnd: string;
}

function computeConsistency(
  sessions: Session[], // all sessions, unfiltered by any window (need full history's earliest date to decide totalWeeks)
): ConsistencyResult | undefined;
// undefined when the person's full history spans < 4 weeks (§5.7)
```

## Derived: Push/pull classification and balance (FR-012/013)

```ts
type PushPullClassification = 'push' | 'pull' | 'unclassified';

function classifyMovementPattern(
  movementPattern: string | undefined,
): PushPullClassification; // research.md §2: normalize() + whole-word match

interface PushPullBalanceResult {
  pushCount: number;
  pullCount: number;
  periodStart: string;
  periodEnd: string;
}

function computePushPullBalance(
  sessions: Session[], // all sessions within the trailing 90-day window
  exercises: Exercise[],
): PushPullBalanceResult | undefined;
// undefined when pushCount + pullCount < 20 (§5.7); unclassified sets
// contribute to neither count and are not part of the 20-set threshold
```

## Derived: The orchestrated Insights result (FR-001/015)

```ts
interface CardTypeResult<TCard> {
  cards: TCard[];
  missingDataExplanation: string | undefined; // FR-015, populated iff cards.length === 0
}

interface InsightsResult {
  perExerciseProgress: CardTypeResult<PerExerciseProgressCard>;
  aggregateProgress: CardTypeResult<AggregateProgressCard>;
  recentRecords: CardTypeResult<RecentRecordEntry>;
  plateau: CardTypeResult<PlateauCard>;
  consistency: CardTypeResult<ConsistencyResult>;
  pushPullBalance: CardTypeResult<PushPullBalanceResult>;
}

function buildInsights(
  sessions: Session[], // allStoredDataRange() — the orchestrator itself slices per-card windows
  exercises: Exercise[],
): InsightsResult;
```

**Rules** (FR-015): `missingDataExplanation` for `aggregateProgress`
specifically distinguishes, per FR-015's fold-in of `docs/requirements.md`
FR-5, whether zero groups qualified because too few exercises carry a
`movementPattern`/`muscleGroups` value at all, versus enough being tagged
but not individually clearing `per-exercise-progress`'s own threshold —
the wording differs between these two cases.
