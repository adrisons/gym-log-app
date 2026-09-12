# Phase 0 Research: Insights

## 1. Incremental recomputation (§7.1) vs. a persisted cache

**Decision**: No persisted cache, and no memoization at all in this first
implementation — every card is computed fresh from `listSessions`/
`listExercises` on every view of the Insights screen, exactly as spec.md's
FR-001 states. `docs/requirements.md` §7.1's "recomputed incrementally"
goal is treated as a *performance* target to verify, not a mechanism to
build ahead of evidence that it's needed.

**Rationale**: At this app's stated scale (`docs/requirements.md` §1.2: a
single-user, personal training log — hundreds, not millions, of sessions)
a full recompute over `listSessions`/`listExercises`'s already-durable
output is expected to be fast: six card types, each a linear or
near-linear pass over the session list, is a small constant-factor
multiple of what the existing progression screen (spec 004) already does
per view without a performance complaint. Building a memoization layer
before measuring whether the naive approach actually violates §7.1's
"never blocks the interaction path" would be optimizing against a guess.
This mirrors spec 004 research.md §2's own precedent (measuring the
search benchmark directly rather than assuming a naive scan is too slow).
If `/speckit-tasks`' own benchmark (see quickstart.md) shows a real
problem at realistic data volumes, an in-memory (never persisted, never a
second source of truth) memoization keyed by "which sessions changed
since the last computation" is the fallback — still satisfying Principle
I, since nothing durable would be added.

**Alternatives considered**: a persisted insight cache table — rejected
outright; `docs/requirements.md` §6 already names insights as derived,
rebuildable data alongside the search index and progression aggregates,
and spec.md's Non-Goals explicitly exclude this. An eagerly-computed
in-memory cache built regardless of measured need — rejected for now as
premature; revisit only if the benchmark in quickstart.md shows a real
problem.

## 2. Movement-pattern/muscle-group grouping and push/pull keyword matching: reuse `shared/fuzzy-match.ts`'s `normalize()`

**Decision**: FR-004's group-key comparison and FR-012's push/pull
keyword matching both reuse the existing `normalize()` export from
`shared/fuzzy-match.ts` (NFD + diacritic-strip + lowercase, already used
by spec 001/004) rather than writing a second normalization routine.
FR-012's whole-word match splits the normalized `movementPattern` string
on whitespace and checks for an exact match against each keyword-list
entry (also normalized) — the same word-splitting technique
`shared/fuzzy-match.ts`'s own `matchFuzzy` already uses internally for
per-word typo tolerance, applied here for exact equality instead.

**Rationale**: Consistent case/accent-insensitive comparison across the
whole codebase, no second normalization implementation to keep in sync,
and the whole-word approach spec.md's FR-012 now requires (a plan-phase
decision that was already forced by the spec-reviewer-resolved
substring-vs-whole-word ambiguity) is a small, independently testable
function (`push-pull-classification.ts`) with no need for `fuzzy-match.ts`
itself to change.

**Alternatives considered**: a regex-based substring match — rejected;
spec.md's FR-012 explicitly requires whole-word matching to avoid false
positives like "compression" matching "press". A dedicated tokenizer
library — rejected as unjustified; a `String.split(/\s+/)` on an
already-normalized string is sufficient for movement-pattern-length text.

## 3. `docs/requirements.md` §5.4's "daily" e1RM value

**Decision**: `exercise-trend.ts` groups all of an exercise's e1RM-eligible
working sets (spec 004's `isE1rmEligible`) by the session's calendar date
(local date, consistent with how the app already displays session dates —
spec 001 research.md), takes the maximum `estimatedOneRepMax` among each
day's eligible sets, and treats each resulting (day, value) pair as one
"daily e1RM value" for §5.4's median computation. Days with no eligible
set contribute no data point (not a zero).

**Rationale**: `docs/requirements.md` §3.1 explicitly allows more than one
session per day, so "daily" cannot simply mean "per session" in general;
taking the day's maximum mirrors spec 004's own "a session's e1RM is the
maximum across its qualifying working sets" rule, applied one level up
(per calendar day instead of per session) since that is the unit §5.4
names. This function is intentionally new (not a call into spec 004's
`progression-series.ts`, which operates per-session) — spec 004's own
review confirmed this distinction (schema-guardian, spec 005 review).

**Alternatives considered**: treating "daily" as "per session" and
simply erroring or picking an arbitrary session when two occur the same
day — rejected; silently ignoring §3.1's explicit multi-session-per-day
allowance would produce a nondeterministic or incomplete trend depending
on iteration order.

## 4. Week bucketing for Consistency (FR-010)

**Decision**: `consistency.ts` buckets a Session's local calendar date
into an ISO 8601 week (Monday-start), computed via `Date` arithmetic (no
date library) — the same "no date library" precedent spec 001 research.md
already set. This is an explicit, documented default (spec.md
Assumptions) pending `docs/requirements.md` FR-11's future first-day-of-
week setting.

**Rationale**: ISO week is a well-defined, unambiguous convention
requiring no external input, and ISO week-number computation via plain
`Date` methods (no `Intl` week API exists cross-browser yet) is a small,
independently unit-testable function. Consistent with the project's
existing "no date library" stance.

**Alternatives considered**: adding a date-arithmetic library — rejected;
the ISO week calculation needed here is small and this project has
avoided a date library through three prior specs already touching date
math (spec 001, spec 004's month-grouping). Reading FR-11's setting now —
rejected; that setting does not exist yet (`docs/agent-brief.md` Phase 7),
and Non-Goals already scope this spec away from building it early.

## 5. Screen composition: one shared card shell, six data-producing modules

**Decision**: `insights-screen.tsx` calls `build-insights.ts` (the one
`application/insights/` orchestrator) once per view, receiving a single
structured result covering all six card types (including, per card type,
either a list of qualifying cards or a "not enough data" explanation
string per FR-015), and renders each card through one shared
`insight-card.tsx` component (claim text, number, period, session count,
a link) rather than six visually bespoke card components.

**Rationale**: FR-014 fixes every card's shape (claim + number + period +
session count, from a template) identically across all six types — a
single shared presentational component enforces that shape structurally,
the same way spec 004's `ProgressionList`/`ProgressionChart` split
data-shape concerns from rendering. `missing-data-notice.tsx` is the one
other shared component, for FR-015's explanations.

**Alternatives considered**: one bespoke component per card type —
rejected; would duplicate FR-014's fixed shape six times with no
behavioral difference between card types beyond their text and link
target, which the orchestrator already resolves into plain data before
rendering.
