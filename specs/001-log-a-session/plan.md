# Implementation Plan: Log a Session

**Branch**: `001-log-a-session` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-log-a-session/spec.md`

## Summary

FR-001..FR-026: the logging critical path — open the form (new session or
restored draft), organize a session into blocks, record a set's load and
volume against a forgiving exercise catalogue, rate effort, with no Save
button, 5-second undo on every destructive action, and no data loss across
an app close. Builds the `application` and `presentation` layers on top of
spec 002's already-implemented `domain`/`application/ports` — no change to
`src/domain/` itself. Extends `StoragePort` with `LoggingDraft`'s real
nested shape (assigned to this spec by spec 002's own contract) and a small
band-labels surface (FR-011); everything else composes existing domain
smart constructors and the existing port.

**Scope boundary, stated up front**: this plan does **not** implement a
real storage adapter (`IndexedDbStorageAdapter`/`FileSystemStorageAdapter`,
`docs/agent-brief.md` Phase 2). It builds and fully tests the feature
against `InMemoryStorage`, and recommends a follow-up persistence spec
before shipping — see `research.md` §1 for the full reasoning and its
consequence for FR-005/FR-024/SC-003/SC-007. This is a deliberate,
documented scope decision, not an oversight; flag it back if the intent was
for this plan to include real persistence.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), unchanged from Phase 0/1.

**Primary Dependencies**: none new. Zustand (already a dependency,
`docs/stack.md`) is used for the first time, for the logging session store
(research.md §5). No fuzzy-search library, no date library, no ID-generation
library — research.md §§2–3, §10 each resolve their concern without adding
a dependency.

**Storage**: `StoragePort` (finalized by spec 002), extended per
`contracts/storage-port-extension.md` (real `LoggingDraft` shape, band
labels). Only implementation in this plan's scope is `InMemoryStorage` —
see Summary's scope boundary and research.md §1.

**Testing**: Vitest (unit: draft/use-case/view-model logic with plain
values; integration: use cases through `createHarness()` against
`InMemoryStorage`; component: Testing Library, query by role/label) +
Playwright (one new e2e smoke path: open → log a set → reload → still
there, against the fake-backed dev build — `contracts/logging-screen-components.md`
"Verification"). No new test category; extends the existing pyramid.

**Target Platform**: unchanged (installable PWA; this plan adds no
platform-specific code — no File System Access / IndexedDB calls appear
anywhere in this plan's file list).

**Project Type**: unchanged (single-codebase web application).

**Performance Goals**: SC-001 (≤ 3 taps to repeat a set), SC-002 (< 30 s to
a first set on a brand-new exercise), SC-004 (intended exercise in the
first 3 search results, catalogues up to 500) — all UX/interaction-count
targets, verified manually per `quickstart.md`, not a load-testing concern.
No new numeric perf target beyond `docs/requirements.md` §7.1's existing
"logging interaction responds immediately" (Principle II — optimistic
writes throughout, no exceptions in this plan).

**Constraints**: no loading spinner anywhere on the logging path
(`docs/design.md` §4.4); every destructive action undoable 5 s (FR-004);
~1 s debounce on identical confirms (FR-025); Free text capped at 40 chars
(FR-012); Bodyweight component clamped to −300..+300 (FR-014); Volume > 0,
Load ≥ 0 (FR-026); no literal visual value outside design tokens
(Principle V); every interactive element ships all six states
(`docs/testing.md`, `contracts/logging-screen-components.md`).

**Scale/Scope**: one new application submodule (`application/logging/` —
draft, use cases, view models, the Zustand store, quick-increment
constants), one `shared/` utility (`fuzzy-match.ts`) plus the existing
`shared/id.ts` addition (research.md §2), a `StoragePort` extension plus
its `InMemoryStorage` update, and the logging screen's presentation tree
(~15 components per `contracts/logging-screen-components.md`). No changes
to `src/domain/`.

## Constitution Check

*GATE: must pass before Phase 0 research (done — see research.md).
Re-checked after Phase 1 design below.*

| Principle | Relevance to this plan | Status |
|---|---|---|
| I. Data Ownership & Recoverability | The `StoragePort` contract this plan extends still names the schema-version seam (unchanged) and keeps the draft/band-labels surfaces outside the canonical-schema-version rule for the stated reasons (research.md §7). Real on-device recoverability (FR-005/SC-003) is proven at the port-contract level only, not yet on a real adapter — **explicitly flagged**, not silently assumed (Summary, research.md §1). | PASS (scoped — see flag) |
| II. Logging Is the Critical Path | Every use case in data-model.md is a pure/pure-async function the store calls *after* applying the optimistic in-memory change (research.md §5); no use case blocks on anything; no loading state anywhere on the logging path except the explicitly-justified exceptions design already allows (none needed here — `contracts/logging-screen-components.md`'s `LoggingScreen` row). 5-second undo on every destructive action (FR-004/FR-023, data-model.md "Undo"); merge is the one deliberate exception, confirmed explicit and irreversible (FR-017). | PASS |
| III. BDD Before Code | This plan follows spec.md (Reviewed) → this plan → `/speckit-tasks`. Every FR-001..FR-026 maps to a use case or component row in data-model.md/`contracts/logging-screen-components.md`, each traceable to a test per `quickstart.md`. Canonical schema untouched — `domain/` types are not modified by this plan; the one new persisted surface (band labels) is justified against the schema-version rule in research.md §7, not silently exempted. | PASS |
| IV. External Dependencies Behind Ports | Every new use case takes its `StoragePort` as a parameter (research.md §6) rather than importing `InMemoryStorage` directly outside `test/`; the extended port still has one fake covering every method (`contracts/storage-port-extension.md` "Verification"). No capability check for "which adapter is active" anywhere — there is only ever the fake in this plan's scope. | PASS |
| V. Dependency-Inward Layering | `application/logging/` imports only `domain` + `application/ports`; `presentation/` components import only `application/logging`'s public surface (use cases + view models) and `presentation/design` tokens, never `application/ports` or `domain` directly (`docs/architecture.md`'s table, unchanged edges — this plan adds files, not new edge types). `shared/fuzzy-match.ts` and `shared/id.ts` import nothing internal. | PASS |
| VI. Deterministic, Traceable Insights | Not applicable — no insight/computed-number surface in this spec (`docs/requirements.md` §5 is explicit Non-Goals here, same as spec 002). | PASS (n/a) |
| Escalation — concrete technology choices | Zustand and Dexie are already-approved (`docs/stack.md`); this plan introduces no new library (research.md §§2–3, §10 each resolve without one). The one genuinely new technical call made unilaterally here — the draft→Session promotion rule (research.md §4) — is a *product-behavior* decision, not a technology choice, and is flagged back to the spec owner explicitly rather than treated as settled. | PASS, with one flagged item (research.md §4) |

No unjustified violations. Complexity Tracking table is empty — the one
noteworthy deviation from a "clean" plan (deferring real persistence) is
argued in research.md §1 and restated in Summary, not hidden in a
complexity-tracking footnote.

## Project Structure

### Documentation (this feature)

```text
specs/001-log-a-session/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   ├── storage-port-extension.md        # LoggingDraft real shape + band labels
│   └── logging-screen-components.md     # Component/FR/state obligations
└── checklists/
    └── requirements.md                  # Spec quality checklist (already present)
```

### Source Code (repository root)

```text
src/
├── domain/                              # UNCHANGED by this plan
├── application/
│   ├── ports/
│   │   └── storage-port.ts              # extended: real LoggingDraft, +listBandLabels/saveBandLabels
│   └── logging/
│       ├── draft.ts                     # LoggingDraft/DraftBlock/DraftExerciseEntry/DraftSet + constructors
│       ├── use-cases.ts                 # openLoggingForm, addBlock, addSet, mergeExercises, ... (data-model.md table)
│       ├── view-models.ts               # toBlockViewModel etc.
│       ├── quick-increments.ts          # named constants (research.md §9)
│       └── logging-store.ts             # useLoggingSession (Zustand) — draft state, undo stack, debounce guard
├── infrastructure/                      # UNCHANGED (no real adapter — see Summary)
├── presentation/
│   ├── logging/
│   │   ├── logging-screen.tsx
│   │   ├── session-date-time-field.tsx
│   │   ├── block-list.tsx / block-card.tsx
│   │   ├── exercise-entry-card.tsx
│   │   ├── exercise-search-field.tsx
│   │   ├── load-type-picker.tsx
│   │   ├── weight-load-input.tsx / band-load-input.tsx / bodyweight-load-input.tsx / free-text-load-input.tsx
│   │   ├── volume-input.tsx
│   │   ├── effort-picker.tsx
│   │   ├── set-confirm-control.tsx
│   │   ├── undo-toast.tsx
│   │   └── exercise-catalogue-panel.tsx
│   └── (design/, app-shell.tsx, main.tsx — main.tsx gains createLoggingUseCases wiring, research.md §6)
└── shared/
    ├── id.ts                            # newSessionId/newExerciseId (research.md §2)
    └── fuzzy-match.ts                   # research.md §3

test/
├── unit/
│   ├── application/logging/
│   │   ├── draft.test.ts
│   │   ├── use-cases.test.ts            # one describe block per use-case row, FR-tagged
│   │   ├── view-models.test.ts
│   │   └── logging-store.test.ts        # undo stack + debounce, in isolation from React
│   └── shared/
│       ├── id.test.ts
│       └── fuzzy-match.test.ts
├── integration/
│   └── logging-flow.test.ts             # through createHarness(): open form → add block → add set → reload-equivalent (getDraft) round-trip
├── unit/ (component tests, Testing Library, colocated per contracts/logging-screen-components.md — exact per-component file split left to /speckit-tasks)
└── e2e/
    └── logging-smoke.spec.ts            # quickstart.md scenario 2–3, browser-level
```

**Structure Decision**: extends the existing five-layer tree — no new
top-level directory. `application/logging/` and `presentation/logging/` are
the first feature-named subdirectories either layer has had (Phase 0/1 were
flat or infrastructure-less); grouping by feature here, rather than adding
another dozen files to `application/`'s and `presentation/`'s top level,
keeps this plan's ~15 presentation components and ~6 application modules
navigable as one unit, consistent with spec 002's precedent of grouping its
own new content (`test/unit/domain/`) rather than flattening it.
`test/support/` gains no new shared double in this plan unless
`/speckit-tasks` finds a render-with-providers helper is needed by more
than one component test (`contracts/logging-screen-components.md`
"Verification") — if so, it is added there, not duplicated.

## Complexity Tracking

No constitution violations requiring justification here. The scope
decision to exclude real storage adapters (Summary; research.md §1) is a
*scope* boundary, not a principle violation — nothing this plan does
conflicts with a Core Principle; it is honest about what is not yet true
on-device, which is what Principle I asks for over pretending otherwise.
