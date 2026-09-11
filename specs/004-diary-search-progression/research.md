# Phase 0 Research: Diary, Search and Progression

## 1. Exercise search (FR-7): reuse `src/shared/fuzzy-match.ts`, no new library

**Decision**: FR-7's diary search reuses `src/shared/fuzzy-match.ts`'s
existing `normalize()`/`matchExercise()` (built for spec 001's FR-016,
in-form catalogue search), wrapped by a thin
`src/application/search/exercise-search.ts` that calls
`StoragePort.listExercises()` and feeds the result through the same
matcher. No dedicated fuzzy-search library (Fuse.js, `uFuzzy`) is added.

**Rationale**: `docs/stack.md`'s Deferred table and spec 001's
`research.md` §3 both name this exact spec ("Phase 4 (diary/search)") as
the place to decide FR-7's matching library. Re-reading the existing
matcher against spec.md's FR-007/008/009/010/011/012 now that they're
concretely specified:

- **FR-007/011** (match name+alias, derived/rebuildable from
  `listExercises`) — already the shape of `matchExercise<T extends {name,
  aliases}>`; the wrapper only needs to map `Exercise.canonicalName` →
  `name` and re-run on every call (no persisted index, satisfying FR-011
  and `docs/requirements.md` §6 directly — there is nothing to keep in
  sync because nothing is cached).
- **FR-008** (case/accent-insensitive) — `normalize()` already does
  `NFD` + diacritic-strip + lowercase.
- **FR-009** (typo/partial tolerance) — `matchWholeString` already covers
  exact/prefix/substring; `matchFuzzy` already covers single- and
  (for 5+ character queries) double-character-edit tolerance, checked
  against the whole string and each individual word. This is a *superset*
  of FR-009's "one single-character edit" minimum, so no functional gap
  exists at the matching-tier level.
  **Spec correction**: FR-009 as first drafted also promised edit-distance
  tolerance against "substrings/prefixes" of a name — i.e. a typo *inside*
  a partial match (not just a typo against the whole name or whole word).
  The existing matcher does not do this (it only computes Levenshtein
  against the whole string or whole words, never arbitrary substrings),
  and implementing it would mean scoring every substring of every
  candidate against the query — a real performance risk at 500 exercises
  with no corresponding user-facing scenario in spec.md's Acceptance
  Scenarios (which only exercise whole-name/alias typos and plain partial
  matches, never a typo'd partial match). Corrected FR-009 in spec.md to
  the precise, already-implemented boundary: substring/prefix match OR a
  single-character edit against the whole name/alias/word. This is a
  planning-phase clarification of an ambiguity in the spec's own wording,
  not a behavior change to anything already built.
- **FR-010** (< 100ms for 500 exercises) — see §2 below.
- **FR-012** (empty result, not an error) — `matchExercise` already
  returns `[]` (never throws) when nothing matches.

**Alternatives considered**: Fuse.js/`uFuzzy` — rejected per constitution
Development Workflow's Definition of Done ("no dependency is added that
overlaps a concern already covered by an existing one") and Escalation
("a second library for a concern already covered by an existing one" is
stop-and-raise); the existing matcher already meets every FR-7 requirement
at the required scale, so adding one would be an unjustified new
dependency, not a technical necessity.

## 2. Search performance at 500 exercises (FR-010)

**Decision**: No indexing/memoization beyond re-running `matchExercise`
per keystroke against the full (≤ 500-item) `listExercises()` result;
verified as sufficient by direct measurement, not by asymptotic argument
alone.

**Rationale**: `matchExercise`'s cost per candidate is bounded by
`matchFuzzy`'s Levenshtein calls, each `O(|query| × |candidate word|)`.
For realistic exercise names (≤ ~30 characters, ≤ ~4 words) and a query of
similarly bounded length, this is on the order of a few hundred to low
thousands of integer operations per candidate; across 500 candidates the
whole-catalogue scan is expected in the low single-digit milliseconds in a
modern JS engine — comfortably inside the 100ms budget with headroom for
UI overhead (debounce, re-render). This will be confirmed with a concrete
benchmark test in `test/unit/application/search/exercise-search.test.ts`
(500 synthetic exercises, assert wall-clock time under budget) rather than
left as an estimate, per constitution Principle VI's "traceable, not
vibes" standard applied to a performance claim as much as a user-facing
number.

**Alternatives considered**: pre-built trigram or prefix index — rejected
as premature optimization; nothing here approaches a scale where the
naive per-keystroke scan risks the budget, and an index adds exactly the
kind of "second source of truth to keep in sync" §6 and FR-011 warn
against for no measured benefit.

## 3. Routing: introduce `react-router-dom` at the composition root

**Decision**: Wrap the composition root's render in a
`react-router-dom` (already installed, `docs/stack.md`) `BrowserRouter`
with routes for `/` (existing `LoggingScreen`, unchanged), `/diary` (new),
`/diary/:sessionId` (session detail), `/exercises/:exerciseId/progression`
(new), and `/search` (new, or a modal/panel — left to Phase 1 screen
contracts). `useLoggingSession`'s `configure()` call and the storage
adapter selection in `main.tsx` are unaffected — they run once at `mount()`
before any route renders, exactly as today.

**Rationale**: This is the only structural change to the composition root
this spec needs, and it is additive: `LoggingScreen` keeps its current
props/behavior, reachable at the same conceptual entry point. No existing
test that exercises `LoggingScreen` in isolation needs to know about
routing, since routing is introduced only at the `main.tsx` composition
boundary (Principle V — the single file allowed to cross every layer).

**Alternatives considered**: a hand-rolled screen-switch (a `useState`
holding the current screen name) — rejected; `react-router-dom` is already
an approved, installed dependency named specifically for this purpose
(`docs/stack.md`: "Navigation | React Router 7"), and using it now avoids
building a second, throwaway navigation mechanism that would need
replacing the moment deep-linking (e.g. FR-003's jump-to-date, or sharing
a progression screen's URL) matters.

## 4. "All time" / "every Session" against `listSessions`'s mandatory `DateRange`

**Decision**: A small `src/application/date-range.ts` helper exports
`allStoredDataRange(): DateRange`, returning a fixed wide bound (`from`: a
constant far enough in the past to precede any plausible session —
2000-01-01 — `to`: the current date at call time). `listSessions` callers
needing "every Session" (FR-001) or the chart's "all time" range option
(FR-019) pass this helper's result; the 3/6/12-month range options compute
`from` as `to` minus the corresponding calendar interval.

**Rationale**: `StoragePort.listSessions(range: DateRange)` has no
unbounded/"list all" overload (confirmed against
`src/application/ports/storage-port.ts`, and by `schema-guardian`'s spec
review, which flagged this as a usage detail for this plan to resolve, not
a schema gap). A fixed, generously-early constant is simpler and more
obviously correct than deriving "the earliest possible session date" from
data that hasn't been read yet, and costs nothing extra at this data
scale (a personal training log, not a multi-tenant system).

**Alternatives considered**: adding an unbounded `listSessions()`
overload to `StoragePort` — rejected; spec.md's Non-Goals and this spec's
own framing are explicit that no port method changes, and the fixed-range
approach needs no port change at all.

## 5. Progression computation architecture

**Decision**: Four small, pure `application/progression/` modules, each
independently unit-testable against plain `Session[]`/`Set[]` fixtures,
with no dependency on `StoragePort` or any React code:

- `e1rm.ts` — `isE1rmEligible(set, exercise): boolean` (Weight, or
  Bodyweight with a numeric added load, reps 1-12 per `Volume.kind ===
  'reps'`) and `estimatedOneRepMax(set): number` (Epley), per spec.md
  FR-017/FR-021.
- `tonnage.ts` — `sessionTonnage(sets): {value: number; unit:
  'kg'|'lb'|'reps'}` per FR-018 (numeric-load sum, or total-reps fallback
  labelled accordingly).
- `best-working-set.ts` — `bestWorkingSet(sets): Set | undefined`
  implementing FR-015's fixed three-tier ranking (e1RM → numeric load →
  rep count), independent of any chart-metric selection.
- `progression-series.ts` — the orchestrator: given `Session[]` (already
  filtered to sessions containing the target exercise) and a selected
  metric/range, produces the list rows (FR-014) and chart points
  (FR-016/019), and marks personal records (FR-020) by comparing each
  session's metric value against the maximum across the *entire*
  unfiltered history (not just the currently-selected range), per FR-020's
  corrected all-time-maximum definition.

**Rationale**: Keeping e1RM/tonnage/best-working-set as separate,
individually testable pure functions makes each one directly traceable to
its own `docs/requirements.md` §5 rule (Principle VI) and lets
`progression-series.ts`'s own tests focus purely on orchestration (range
filtering, PR marking, row/point shaping) without re-deriving the
arithmetic. This mirrors how spec 001 split load/volume/effort concerns
into separate small domain functions rather than one large one.

**Alternatives considered**: one monolithic `computeProgression()`
function — rejected; harder to unit-test each rule in isolation and to
verify against `docs/requirements.md` §5.2/§5.3 line by line during
review.

## 6. Diary summary and grouping

**Decision**: `application/diary/diary-summary.ts` derives, per `Session`,
its main exercises (distinct `Exercise.canonicalName`s referenced, via a
supplied `Map<ExerciseId, Exercise>` built once from `listExercises()`),
total set count, and a kind-of-work label from the referenced exercises'
`movementPattern` fields (falling back to a neutral label when absent, per
spec.md Assumptions). `application/diary/diary-grouping.ts` sorts
sessions reverse-chronologically by `dateTime` and groups them by calendar
month (using the session's local date, consistent with spec 001
research.md's existing `Intl.DateTimeFormat`-based date handling — no new
date library), and implements FR-003's jump-to-date lookup (nearest
session on/after the picked date, falling back to nearest before, per the
spec-reviewer-resolved tie-break).

**Rationale**: Matches the layering spec 001 already established
(pure `application/` derivation feeding `presentation/` screens with no
domain/infrastructure knowledge) and needs no new dependency — `Session`,
`Exercise`, and existing date-formatting utilities are sufficient.

**Alternatives considered**: none seriously — this is a straightforward
extension of already-established patterns; the only real decision (how to
resolve month/date grouping against a session's `dateTime`, which is a
full ISO date-time) is to use the session's local calendar date exactly as
spec 001 already displays it, so the diary's month headings and the
logging screen's own date display never disagree.
