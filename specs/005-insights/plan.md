# Implementation Plan: Insights

**Branch**: `005-insights` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-insights/spec.md`

## Summary

Add an Insights screen showing zero or more of six deterministic card
types (per-exercise progress, aggregate progress by movement
pattern/muscle group, recent records, detected plateau, consistency,
push/pull balance), computed at view time from `listSessions`/
`listExercises` — no new adapter, no new port method, no persisted cache.
Reuses spec 004's `src/application/progression/` e1RM/tonnage/
best-working-set/personal-record functions directly. Adds one new
`application/insights/` module tree (pure, session-fixture-testable
aggregation and data-sufficiency logic) and one new `presentation/
insights/` screen, wired into the existing `react-router-dom` router
(spec 004) at `/insights`.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`) — unchanged from the existing project.

**Primary Dependencies**: None new. Reuses `src/application/progression/`
(spec 004) for e1RM eligibility, the Epley formula, tonnage, and the
personal-record definition; `shared/fuzzy-match.ts`'s `normalize()` (spec
001/004) for case/accent-insensitive comparisons (FR-004/FR-012's
movement-pattern/muscle-group and push/pull matching); native `Date` for
all window/week-bucketing math (no date library — consistent with spec
001 research.md's precedent, and this app's scale of data).

**Storage**: No new storage. Reads only, via the existing `StoragePort` —
`listSessions(range)` and `listExercises()`, both already durable (spec
003). Every window this spec needs (90-day, 30-day, 8-week, 12-week) is
satisfied by passing an appropriately-computed `DateRange` to
`listSessions`, following spec 004's `date-range.ts` pattern.

**Testing**: Vitest unit tests for every new `application/insights/`
module against plain fixture `Session[]`/`Exercise[]` arrays — this
feature is almost entirely pure computation, so this is the bulk of its
coverage (mirroring spec 004's own test-pyramid shape). One component
test for the Insights screen against `InMemoryStorageAdapter`, covering
at least one card type actually rendering and the "not enough data"
explanation path. No new Playwright suite; the existing shell-smoke
e2e test is extended with one more route-reachability check, as spec 004
did for `/diary`.

**Target Platform**: Same as the whole project — a PWA, no new platform
or browser-capability dependency.

**Project Type**: Single web app (existing `src/` layered structure) — no
structural change beyond the new `application/insights/` and
`presentation/insights/` directories and one router entry.

**Performance Goals**: `docs/requirements.md` §7.1's "search and insight
recomputation never block the interaction path" and "insights are
recomputed incrementally: only what the changed session affects." This
spec's functional contract (FR-001, spec.md Assumptions) is satisfied by
computing everything fresh from canonical data with no persisted cache;
the *incremental* half of §7.1 is a `/speckit-plan`-level technique
decision (research.md §1) — an in-memory-only memoization keyed by which
sessions/exercises changed, never persisted, so it adds no second source
of truth.

**Constraints**: Every computation MUST be traceable to an explicit
`docs/requirements.md` §5 rule (constitution Principle VI) — no
heuristic invented ad hoc. No card type may be shown below its
`docs/requirements.md` §5.7 data-sufficiency threshold (spec.md
FR-002/003/004/005/006/007/008/009/010/011/012/013). This spec's screen
is off the logging critical path (Principle II) — it may not add latency
to `LoggingScreen`.

**Scale/Scope**: One new presentation screen, ~8-10 new small pure
`application/insights/` modules (one per card-type concern plus a
shared trend-computation module and a push/pull classification
constant), one composition-root route addition, one nav link from an
existing screen. No new `infrastructure/` code, no new `domain/` code.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Data Ownership & Recoverability | This spec stores nothing new — every card is derived from canonical Session/Exercise records and rebuildable at any time (spec.md FR-001, `docs/requirements.md` §6 explicitly lists "insights" among the named examples of derived data). No schema version change. | PASS |
| II. Logging Is the Critical Path | The Insights screen is reached only via navigation (a new route + nav link), never rendered as part of `LoggingScreen`; no `StoragePort` call site `logging-store.ts` uses changes. Verified structurally in Phase 1 design; verified at runtime by the extended shell-smoke e2e test (unchanged logging-screen assertions). | PASS |
| III. BDD Before Code | spec.md's six User Stories are already Given/When/Then in domain vocabulary (Session, Exercise, working set, e1RM, movement pattern, muscle group) — data-model.md/contracts/quickstart.md are the executable form. Discipline-neutrality (§1.4): every computation here (e1RM-based trend, tonnage, push/pull) is explicitly Strength-specific per spec.md's Non-Goals, not hard-coded as if no other discipline could ever exist. | PASS |
| IV. External Dependencies Behind Ports | No new port, no new adapter. Every read goes through the existing `StoragePort`; every new `application/insights/` module is a pure function of plain data (`Session[]`, `Exercise[]`), not a port reference. | PASS |
| V. Dependency-Inward Layering | New files land in `application/insights/` (pure derivation) and `presentation/insights/` (one screen + card components), matching the pattern spec 004 already established for `application/{diary,search,progression}/` and `presentation/{diary,search,progression}/`. No `presentation/` file imports `domain/` directly (re-exports from `application/logging/use-cases.ts`, per spec 004's precedent, cover any type it needs). | PASS |
| VI. Deterministic, Traceable Insights | This is the principle's own namesake spec: every number is the exact rule fixed in `docs/requirements.md` §5.4/§5.5/§5.7 and spec.md's FRs — no generative or heuristic computation. Every card carries the claim, the number, the period, and the supporting session count (FR-014), from a fixed template (§5.6). No card is shown below its §5.7 threshold; below it, the section says what is missing (FR-015). | PASS |
| Escalation (technology choices) | No new production dependency. The one implementation-detail choice (an in-memory memoization strategy for §7.1's incremental-recomputation goal, if `/speckit-tasks` decides one is needed at this data scale) is a technique within the already-approved stack, not a new vendor choice — documented with rationale in research.md §1, per the Development Workflow section's normal plan-phase practice (same disposition as spec 003's Playwright-vs-jsdom choice). | PASS |

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-insights/
├── plan.md              # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── screen-contracts.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not this command)
```

### Source Code (repository root)

```text
src/
├── application/
│   └── insights/
│       ├── exercise-trend.ts            # NEW — §5.4: daily e1RM values, median-based percentage change; shared by per-exercise progress and plateau
│       ├── per-exercise-progress.ts     # NEW — FR-002/003: 90-day window + ≥21-day-span + ≥6-distinct-day gating over exercise-trend.ts
│       ├── plateau.ts                   # NEW — FR-008/009: 8-week window + <2% gating over exercise-trend.ts
│       ├── aggregate-progress.ts        # NEW — FR-004/005: group exercises by movementPattern/muscleGroups (case/accent-insensitive), weighted mean of per-exercise-progress.ts results
│       ├── recent-records.ts            # NEW — FR-006/007: reuses progression/progression-series.ts's buildProgressionSeries per (exercise, metric), filters to the 30-day recency window, consolidates ties
│       ├── consistency.ts               # NEW — FR-010/011: distinct trained weeks in a trailing 12-week (or shorter full-history) window
│       ├── push-pull-classification.ts  # NEW — FR-012: the fixed push/pull keyword lists + a pure classify(movementPattern) function
│       ├── push-pull-balance.ts         # NEW — FR-012/013: classifies working sets in the 90-day window via push-pull-classification.ts, computes the split
│       └── build-insights.ts            # NEW — FR-001/015 orchestrator: runs all six, attaches FR-015's missing-data explanation per card type that has nothing to show
├── presentation/
│   ├── main.tsx                          # EDIT — add the "/insights" route
│   ├── diary/
│   │   └── diary-screen.tsx              # EDIT — add a nav link to "/insights", alongside the existing "/search" link
│   └── insights/
│       ├── insights-screen.tsx           # NEW — FR-001, hosts all six card sections
│       ├── insight-card.tsx              # NEW — one shared card shell (claim, number, period, session count, link) reused by every card type
│       └── missing-data-notice.tsx       # NEW — FR-015's per-card-type explanation when nothing qualifies
└── shared/
    └── fuzzy-match.ts                    # unchanged — reused for normalize()

test/
├── unit/
│   └── application/
│       └── insights/
│           ├── exercise-trend.test.ts
│           ├── per-exercise-progress.test.ts
│           ├── plateau.test.ts
│           ├── aggregate-progress.test.ts
│           ├── recent-records.test.ts
│           ├── consistency.test.ts
│           ├── push-pull-classification.test.ts
│           ├── push-pull-balance.test.ts
│           └── build-insights.test.ts
└── unit/presentation/insights/
    └── insights-screen.test.tsx
```

**Structure Decision**: Single project, existing layered `src/` structure
(`docs/architecture.md`). This spec adds `application/insights/` (pure
derivation, mirroring spec 004's `application/progression/` shape) and
`presentation/insights/` (one screen + shared card components), plus a
composition-root route addition and one nav-link edit to the existing
diary screen. No new top-level directory, no `infrastructure/` change, no
`domain/` change, no new layer or edge in `eslint.boundaries.js`.

## Complexity Tracking

*No violations — table intentionally omitted.*
