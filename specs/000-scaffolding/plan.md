# Implementation Plan: Project Scaffolding (Phase 0)

**Branch**: `000-scaffolding` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/000-scaffolding/spec.md`

## Summary

Phase 0 stands up the repository so product code can begin: a proposed
concrete toolchain recorded in `docs/stack.md`, the layer map and its
mechanical enforcement in `docs/architecture.md`, the test approach and
shared doubles in `docs/testing.md`, a CI gate (typecheck + test + lint,
red on any failure or zero-test run, required on the default branch), the
`application`-layer storage port interface plus its in-memory fake, an
integration harness, a complete light/dark design-token module, and an
empty PWA shell with a smoke test. No domain logic, no real storage
adapter, no screens.

The technical approach: a **Vite + React + TypeScript** PWA, **Zustand** for
state, **Dexie** wrapping IndexedDB and a hand-written File System Access
adapter behind one port, **Vitest + Testing Library + Playwright** for
tests, **ESLint (flat config) + `eslint-plugin-boundaries`** for the layer
rule, **Prettier** for formatting, **`vite-plugin-pwa` (Workbox)** for the
service worker, and **CSS custom properties** as the design-token
substrate. Every choice is in [research.md](./research.md) with its
rationale and the alternatives rejected — **this is the list the project
owner approves or adjusts before any task runs** (spec Assumptions;
constitution, Escalation).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), targeting ES2022; Node 20 LTS
for tooling/CI.

**Primary Dependencies** (proposed — see research.md for rationale and
alternatives; subject to owner approval):

| Concern | Proposed | Note |
|---|---|---|
| PWA framework | React 18 + TypeScript | |
| Build tool / bundler | Vite 5 | |
| State management | Zustand | small, unopinionated store; no Redux boilerplate |
| Service worker / offline precache | `vite-plugin-pwa` (Workbox) | precaches the app shell (ADR-0002) |
| Storage helper — File System Access API | none, hand-written adapter | thin API; no maintained wrapper worth a dependency |
| Storage helper — IndexedDB | Dexie | ergonomic IndexedDB; adapter still behind the port |
| Charts | Recharts | deferred use (Phase 4/5); named now per "one dependency per concern" |
| Navigation | React Router | |
| Test runner | Vitest | Vite-native; one runner for unit + integration + smoke |
| Component/DOM testing | `@testing-library/react` + `@testing-library/user-event` | |
| End-to-end / smoke (browser) | Playwright | the launch smoke test and later E2E |
| Lint | ESLint 9 flat config + `eslint-plugin-boundaries` + `@typescript-eslint` | boundaries plugin is the layer rule |
| Formatting | Prettier | |
| Date/time | deferred to the Phase 1 spec | platform `Date`/`Intl` expected; ADR if a lib proves needed |
| Fuzzy search | deferred to the Phase 4 spec | e.g. Fuse.js or `uFuzzy`, decided when search is specified |

**Storage**: none in Phase 0. The `application` storage port interface is
written (FR-013); the only implementation is the in-memory fake (FR-014).
Real adapters (`FileSystemStorageAdapter`, `IndexedDbStorageAdapter`) are
Phase 2.

**Testing**: Vitest for unit and integration (jsdom environment for
component tests, node for pure logic); Playwright for the browser smoke
test. All three of typecheck / `vitest run` / `eslint` are the CI gate and
the documented local commands (FR-003).

**Target Platform**: installable PWA — Chromium desktop & Android (File
System Access path), iOS Safari 16.4+ (IndexedDB path). Modern evergreen
browsers only; no IE, no legacy Safari.

**Project Type**: single-codebase web application (PWA). One `src/` tree,
layered per constitution Principle V.

**Performance Goals**: Phase 0 has no runtime perf target of its own beyond
`docs/requirements.md` §7.1 "launch to interactive < 1.5 s on a mid-range
device" applying to the shell — trivially met by an empty shell, but the
build config (code-splitting, no needless polyfills) is set up not to
regress it later.

**Constraints**: fully offline after first load (ADR-0002; `docs/requirements.md`
§7.2); no outbound network call from the app (constitution, Escalation;
§7.3); design tokens the only source of visual values (Principle V); the
layer rule must fail the build on a violation including via a barrel path
(FR-005/FR-006/FR-007).

**Scale/Scope**: Phase 0 deliverables only — 3 docs, 1 CI workflow, 1
ESLint boundaries config, the port interface + fake, the integration
harness, the token module, the shell + smoke test. Roughly a dozen files;
no feature surface.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Phase 0 relevance | Status |
|---|---|---|
| I. Data Ownership & Recoverability | No data yet; no telemetry, no backend, no analytics in the shell. The token module and shell make no network call. | PASS |
| II. Logging Is the Critical Path | No logging path yet; the plan adds no latency or network dependency to anything, and the shell is static. | PASS (n/a) |
| III. BDD Before Code | This plan follows `/speckit-specify` (done) → this `/speckit-plan` → `/speckit-tasks`. Spec 000's scenarios are written in repo-property terms, not tool terms. No canonical schema is introduced. | PASS |
| IV. External Dependencies Behind Ports | The storage port interface is written in `application` in domain terms (FR-013); its only Phase 0 implementation is the in-memory fake (FR-014). No other external dependency is reached from domain/application. Composition happens in exactly one root. | PASS |
| V. Dependency-Inward Layering | `docs/architecture.md` records the layer map incl. `presentation/design/`; `eslint-plugin-boundaries` enforces it and is verified with deliberate illegal imports, direct and via barrel (FR-008). Design tokens are the only visual-value source, light + dark from the first shell commit (FR-018). | PASS |
| VI. Deterministic, Traceable Insights | No insights in Phase 0. Charts library is named but unused. | PASS (n/a) |
| Escalation — concrete technology choices | This is the sanctioned phase for them. Every choice is listed in research.md for owner approval before tasks run (spec Assumptions). No outbound call, no online-only feature, no second library for a covered concern, no schema change. | PASS, pending owner sign-off on the stack |

No violations. Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/000-scaffolding/
├── plan.md              # This file
├── research.md          # Stack proposal + rationale (owner approves this)
├── data-model.md        # The storage port interface shape + token set
├── quickstart.md        # How to verify Phase 0 is done
├── contracts/
│   └── storage-port.md  # The application-layer storage port contract
└── checklists/
    └── requirements.md  # Spec quality checklist (already present)
```

### Source Code (repository root)

```text
src/
├── domain/            # (empty in Phase 0 — Phase 1 fills it)
│   └── .gitkeep
├── application/
│   ├── ports/
│   │   └── storage-port.ts        # FR-013: the storage port interface
│   └── index.ts                   # barrel — used to test barrel-path enforcement
├── infrastructure/   # (no real adapter in Phase 0 — Phase 2)
│   └── .gitkeep
├── presentation/
│   ├── design/
│   │   ├── tokens.css             # FR-018: CSS custom properties, light + dark
│   │   ├── tokens.ts              # typed accessors / token names
│   │   └── index.ts
│   ├── app-shell.tsx             # FR-020: placeholder view, tokens only
│   └── main.tsx                  # composition root (single wiring point)
└── shared/           # (empty in Phase 0)
    └── .gitkeep

test/
├── support/
│   ├── in-memory-storage.ts      # FR-014: in-memory fake of the storage port
│   ├── integration-harness.ts    # FR-016: standard wiring with fakes
│   └── index.ts                  # FR-015: the one documented doubles location
├── unit/
│   └── storage-port-fake.test.ts # exercises the fake against the interface
├── integration/
│   └── harness.test.ts           # a test through the harness
├── boundaries/
│   └── illegal-import.md         # FR-008: how the deliberate-violation check is run
└── e2e/
    └── shell-smoke.spec.ts       # FR-021: Playwright — the shell launches

docs/
├── stack.md          # FR-010/011/012
├── architecture.md   # FR-009 (layer map + forbidden-edge table)
└── testing.md        # FR-017 + FR-024 (interactive-state convention)

.github/workflows/
└── ci.yml            # FR-001..FR-004: typecheck + test + lint gate

eslint.config.js      # flat config incl. eslint-plugin-boundaries (FR-005..007)
vite.config.ts        # Vite + vite-plugin-pwa
tsconfig.json         # strict
```

**Structure Decision**: Single-project web app, one `src/` tree with the
five layers from constitution Principle V / `docs/agent-brief.md` §2
(`domain`, `application`, `infrastructure`, `presentation` with a `design/`
sub-layer, `shared`). Tests live in a parallel `test/` tree rather than
co-located, so the boundary rule can treat `src/` as the enforced graph and
`test/` as allowed to import fakes freely. `test/support/` is the single
documented home for shared doubles (FR-015).

## Complexity Tracking

No constitution violations — table intentionally empty.
