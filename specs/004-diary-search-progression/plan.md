# Implementation Plan: Diary, Search and Progression

**Branch**: `004-diary-search-progression` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-diary-search-progression/spec.md`

## Summary

Add three read-only screens over the existing durable `StoragePort`
(`listSessions`, `listExercises`, unchanged since spec 003): a diary/history
screen (FR-6), exercise search (FR-7) reachable from it and standalone, and
a per-exercise progression screen (FR-8) with a list and a Recharts chart.
Introduces React Router 7 at the composition root (already an approved,
installed dependency — `docs/stack.md`) to host multiple screens instead of
`LoggingScreen` alone. Extends the existing hand-rolled
`src/shared/fuzzy-match.ts` (built for spec 001's in-form catalogue search,
FR-016) to serve FR-7's diary search too, rather than adding a second
fuzzy-matching library — closing the deferred decision spec 001's
research.md §3 explicitly left open for this spec. All new logic is
application-layer derivation (a search index over `listExercises`, e1RM/
tonnage computations per `docs/requirements.md` §5.2/§5.3 over
`listSessions`) plus presentation-layer screens; no new domain entity, no
new `StoragePort` method, no schema version bump (confirmed by
`schema-guardian` during spec review).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`) — unchanged from the existing project.

**Primary Dependencies**: `react-router-dom` 7 (already a `dependencies`
entry in `package.json`, pre-approved in `docs/stack.md`'s Application
table — Phase 0 named it for navigation, unused until now) for routing
between the logging, diary, and progression screens; `recharts` 3 (already
a `dependencies` entry, pre-approved for "Phase 4/5, unused until
progression/insights") for the progression chart. No new dependency: FR-7's
search reuses and, where needed, extends `src/shared/fuzzy-match.ts`
(`normalize`, `matchExercise`) already built for spec 001's FR-016 rather
than adding a dedicated fuzzy-search library — closing the decision spec
001's research.md §3 deferred to "the Phase 4 (diary/search) spec" (see
research.md §1 below for why the existing hand-rolled matcher already
satisfies FR-7/FR-008/FR-009/FR-010, and constitution Development
Workflow's "no dependency is added that overlaps a concern already covered
by an existing one").

**Storage**: No new storage. Reads only, via the existing `StoragePort`
(`src/application/ports/storage-port.ts`) — `listSessions(range)` and
`listExercises()`, both already durable (spec 003). `listSessions` requires
a `DateRange`; "every Session"/"all time" (spec.md FR-001/FR-019) is
satisfied by passing a range from a fixed epoch-floor constant through the
current date (spec.md Assumptions) — a small `application/`-layer helper,
not a port change.

**Testing**: Vitest for the derivation logic (search matching against
`listExercises` output, e1RM/tonnage/best-working-set/personal-record
computations against fixture `Session[]` arrays) and component tests
(`@testing-library/react`) for the three new screens against the existing
`InMemoryStorageAdapter` fake. No new Playwright contract suite — this spec
adds no adapter and touches no real storage; a small number of existing
Playwright smoke-test scenarios (`test/e2e/`) are extended to cover
navigating to the new screens, consistent with `docs/testing.md`'s pyramid
(most coverage at the unit level for computation-heavy logic).

**Target Platform**: Same as the whole project — a PWA, no new platform or
browser-capability dependency (no File System Access/IndexedDB surface
touched).

**Project Type**: Single web app (existing `src/` layered structure) — no
structural change beyond the new screens/derivation modules below.

**Performance Goals**: FR-010's explicit budget — search results in under
100ms for a catalogue of up to 500 exercises (verified in research.md §1
against the existing matcher's `O(exercises × candidateLength²)`
Levenshtein cost, which is comfortably within budget at that scale). No
other new performance goal beyond `docs/requirements.md` §7.1's general
non-functional targets.

**Constraints**: This spec's screens are off the logging critical path
(constitution Principle II) — none of FR-6/7/8 may add latency, a network
dependency, or a blocking step to `LoggingScreen`'s existing set-confirm
flow; introducing `react-router-dom` at the composition root MUST NOT
change how `LoggingScreen` itself renders or behaves. Every number FR-8's
chart/list shows MUST be traceable to an explicit rule in
`docs/requirements.md` §5 (constitution Principle VI) — no heuristic or
approximate computation invented ad hoc.

**Scale/Scope**: Three new presentation screens (diary/history, session
detail — reusing existing logging-screen editing components where
possible, progression), a handful of new `application/`-layer pure
derivation modules (search, progression computation), one composition-root
edit (add a router). No new `infrastructure/` code, no new `domain/` code.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Data Ownership & Recoverability | This spec introduces no new persisted data — the search index and progression series are explicitly derived/rebuildable (spec.md Key Entities, FR-023), matching the principle's "search indexes, progression aggregates... are derived from canonical records; they MUST be deletable and rebuildable" verbatim. No schema version change (schema-guardian review, spec.md commit). | PASS |
| II. Logging Is the Critical Path | No `StoragePort` call site used by `LoggingScreen`/`logging-store.ts` changes; the new router wraps the existing screen without altering its render path or adding an async dependency before first paint (research.md §2). Verified structurally in Phase 1 design; verified at runtime in Phase 3 implementation by re-running the existing tap-count/offline smoke tests unchanged. | PASS |
| III. BDD Before Code | spec.md's three User Stories are Given/When/Then in domain vocabulary (Session, Exercise, Set, working set, e1RM, tonnage) — this plan's data-model.md/contracts/quickstart.md are the executable form of them, extending spec 001/002's existing domain vocabulary, not inventing new terms. Discipline-neutrality (§1.4): chart metrics apply to `Weight`/`Bodyweight`-numeric-load working sets only (already the case for e1RM in §5.2), explicitly scoped out for any future discipline (spec.md Non-Goals) rather than hard-coded as if Strength were the only possible discipline. | PASS |
| IV. External Dependencies Behind Ports | No new port, no new adapter. Every read in this spec goes through the existing `StoragePort` interface; derivation modules take plain `Session[]`/`Exercise[]` data, not a port reference, keeping them pure and testable without any fake. | PASS |
| V. Dependency-Inward Layering | New files land in `application/` (search, progression derivation — pure functions over data already read via the port) and `presentation/` (three screens + router wiring at the composition root, the one file allowed to cross every layer). No `presentation/` file imports a derivation's internals directly from `infrastructure/`; screens consume `application/`-layer view models only, matching the existing `LoggingScreen`/`logging-store.ts` pattern. | PASS |
| VI. Deterministic, Traceable Insights | Every number FR-8 shows (e1RM, tonnage, top load, reps-at-load, personal records) is the exact rule already fixed in `docs/requirements.md` §5.2/§5.3 and spec.md FR-015/017/018/020 — no generative or heuristic computation. Honest degradation (FR-021) shows a fixed one-sentence explanation, not generated prose. | PASS |
| Escalation (technology choices) | `react-router-dom` and `recharts` are both already-approved, already-installed dependencies (`docs/stack.md`'s Application table, Phase 0 owner sign-off) named for exactly this phase ("unused until Phase 4/5") — no *new* production dependency is introduced by wiring them in now. Extending `fuzzy-match.ts` instead of adding a dedicated search library is the opposite of a new-dependency decision — it closes spec 001 research.md §3's explicitly deferred choice in the direction the Development Workflow's Definition of Done already favors ("no dependency is added that overlaps a concern already covered by an existing one"), so it needs no fresh owner sign-off; documented with rationale in research.md §1. | PASS |

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-diary-search-progression/
├── plan.md              # This file
├── research.md          # Phase 0 output
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
│   ├── date-range.ts                    # NEW — small helpers: allTimeRange(), monthRangeKey() etc. shared by diary/progression
│   ├── diary/
│   │   ├── diary-summary.ts             # NEW — pure: Session[] -> one-line summary (main exercises, set count, kind-of-work) per FR-002
│   │   └── diary-grouping.ts            # NEW — pure: group+sort sessions by month, jump-to-date lookup (FR-001/FR-003)
│   ├── search/
│   │   └── exercise-search.ts           # NEW — thin FR-7 wrapper over shared/fuzzy-match.ts against listExercises() output
│   └── progression/
│       ├── e1rm.ts                      # NEW — pure: Epley e1RM over a Set, eligibility check (FR-017/FR-021)
│       ├── tonnage.ts                   # NEW — pure: session tonnage / total-reps fallback (FR-018)
│       ├── best-working-set.ts          # NEW — pure: FR-015's fixed ranking
│       └── progression-series.ts        # NEW — pure: Session[] + exerciseId -> per-session list rows + chart points + PR flags (FR-014/016/019/020)
├── presentation/
│   ├── main.tsx                         # EDIT — add react-router-dom routes: "/", "/diary", "/diary/:sessionId", "/exercises/:exerciseId/progression"
│   ├── diary/
│   │   ├── diary-screen.tsx             # NEW — FR-001/002/003/006
│   │   └── session-detail-screen.tsx    # NEW — FR-004/005, reuses existing logging/ components for editing
│   ├── search/
│   │   └── exercise-search-screen.tsx   # NEW — FR-007..012
│   └── progression/
│       ├── progression-screen.tsx       # NEW — FR-013/014/019, hosts list + chart
│       ├── progression-list.tsx         # NEW — FR-014/015/020 list rows
│       └── progression-chart.tsx        # NEW — FR-016/017/018/019/020/021 Recharts chart
└── shared/
    └── fuzzy-match.ts                   # EDIT (if research.md §1 finds a gap against FR-009's boundary) — otherwise unchanged, reused as-is

test/
├── unit/
│   ├── application/
│   │   ├── diary/
│   │   │   ├── diary-summary.test.ts
│   │   │   └── diary-grouping.test.ts
│   │   ├── search/
│   │   │   └── exercise-search.test.ts
│   │   └── progression/
│   │       ├── e1rm.test.ts
│   │       ├── tonnage.test.ts
│   │       ├── best-working-set.test.ts
│   │       └── progression-series.test.ts
│   └── presentation/
│       ├── diary/
│       │   ├── diary-screen.test.tsx
│       │   └── session-detail-screen.test.tsx
│       ├── search/
│       │   └── exercise-search-screen.test.tsx
│       └── progression/
│           └── progression-screen.test.tsx
└── e2e/
    └── shell-smoke.spec.ts              # EDIT — extend to navigate diary -> session detail -> progression, still offline-first
```

**Structure Decision**: Single project, existing layered `src/` structure
(`docs/architecture.md`). This spec adds `application/{diary,search,
progression}/` (pure derivation, one new small `date-range.ts` helper) and
`presentation/{diary,search,progression}/` (screens), plus a composition-
root edit to introduce routing. No new top-level directory, no
`infrastructure/` change, no `domain/` change, no new layer or edge in
`eslint.boundaries.js`.

## Complexity Tracking

*No violations — table intentionally omitted.*
