# Implementation Plan: Persistence

**Branch**: `003-persistence` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-persistence/spec.md`

## Summary

Replace the composition root's non-durable `InMemoryStorageAdapter` with two
real `StoragePort` implementations — `IndexedDbStorageAdapter` (Dexie) and
`FileSystemStorageAdapter` (hand-written, File System Access API) — selected
once per device by feature detection, both proven against one shared
contract test suite executed in real browsers (Chromium for both adapters,
WebKit for the IndexedDB path only, matching production feature detection).
No change to any `domain/`, `application/`, or `presentation/` file except
one narrow addition: a `kind` discriminant on `StorageError` (FR-012a),
already scoped as the sole exception in spec.md's Non-Goals.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`) — unchanged from the existing project.

**Primary Dependencies**: Dexie 4 (already a `dependencies` entry in
`package.json`, pre-approved in `docs/stack.md`'s Storage table — Phase 0
named it, this spec is the first to write the adapter code) for
`IndexedDbStorageAdapter`; the native File System Access API (no library —
`docs/stack.md`: "hand-written adapter, the API surface needed is small and
stable") for `FileSystemStorageAdapter`.

**Storage**: IndexedDB (via Dexie) and the local filesystem (via File System
Access), both behind the existing `StoragePort`
(`src/application/ports/storage-port.ts`) — no port change beyond FR-012a's
`StorageError` discriminant.

**Testing**: Vitest for pure logic with no real storage involved (the
schema-version decision function, `StorageError` construction, Dexie/JSON
mapping helpers in isolation). The shared adapter **contract** test suite
(the durability/reload scenarios spec.md's User Stories 1–4 require) runs as
Playwright tests in real browsers instead of Vitest+jsdom, because jsdom has
no IndexedDB or File System Access implementation and a polyfill would add a
new test-only dependency for a concern `docs/stack.md` doesn't already list.
Playwright is already in the stack and gives a more faithful test of "closes
and reopens the app" (an actual page reload) than a jsdom double would.
Chromium runs the suite against both real adapters (it supports File System
Access); WebKit runs it against `IndexedDbStorageAdapter` only, mirroring
the feature-detection fallback the iOS Safari path takes in production —
see research.md §3.

**Target Platform**: Same as the whole project — a PWA, Chromium desktop/
Android (File System Access path) and iOS Safari/other browsers without
File System Access (IndexedDB path). No new platform.

**Project Type**: Single web app (existing `src/` layered structure) — no
structural change.

**Performance Goals**: No new goal beyond `docs/requirements.md` §7.1
(logging interactions never blocked by persistence — already required by
constitution Principle II, which this spec must not regress since every
`StoragePort` call site is unchanged).

**Constraints**: Every write MUST remain optimistic from the caller's point
of view (Principle II — unchanged, adapters only replace what happens after
the UI already updated). Every write MUST be atomic at the granularity of
one `StoragePort` call (spec.md FR-011).

**Scale/Scope**: Two new `infrastructure/` adapter classes, one shared
contract test suite, one small `StorageError` extension, one composition-root
edit. No new screens, no new domain code.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Data Ownership & Recoverability | This spec exists to make I true on a real device — this IS the work the principle requires. Schema version travels with the data (FR-007/007a); older auto-migrates and records it, newer is refused with nothing written (FR-008/010) — matches the principle's own wording exactly. | PASS |
| II. Logging Is the Critical Path | No `StoragePort` call site changes (FR-014) — every write stays optimistic (UI updates first, persistence confirms after) by construction, since that behavior lives in `application/logging/logging-store.ts`, untouched by this spec. Adapters must not introduce blocking/synchronous work on the calling path — verified in Phase 1 design (research.md §4, atomicity via the platform's own swap-on-close/transaction primitives, not hand-rolled locking that could stall). | PASS |
| III. BDD Before Code | spec.md's User Stories are already Given/When/Then in domain vocabulary (Session, Draft, schema version) — this plan's contract test suite is the executable form of them, extending spec 002's existing Given/When/Then contract tests to real adapters rather than inventing new vocabulary. | PASS |
| IV. Ports for External Deps | Both adapters implement the existing `StoragePort` with no adapter-specific leakage into `application`/`domain`/`presentation` — the composition root is the only wiring point (FR-004, FR-014), matching Principle IV exactly. `InMemoryStorageAdapter` remains as the in-memory fake (spec.md Assumptions). | PASS |
| V. Dependency-Inward Layering | New files land only in `src/infrastructure/`; the one `application/` touch (FR-012a's `StorageError.kind`) is a data-shape addition to an existing type, not a new inward dependency, and does not change what `presentation/` may import. | PASS |
| VI. Deterministic, Traceable Insights | Not applicable — this spec adds no insight/analytical surface. | N/A |
| Escalation (technology choices) | Both concrete technology choices this spec needs — Dexie for IndexedDB, a hand-written adapter for File System Access — were already made and owner-approved in `specs/000-scaffolding/plan.md` (`docs/stack.md`'s Storage table, Phase 0 sign-off) and named explicitly by the user's own feature description for this spec. No *new* production dependency is introduced. The one implementation-detail choice made fresh here (running the contract suite via Playwright rather than adding a jsdom IndexedDB polyfill) is a test-tooling decision within the already-approved stack (Vitest + Playwright), not a new vendor choice, so it does not require a fresh owner sign-off — documented with rationale in research.md §3 per the Development Workflow section's normal plan-phase practice. | PASS |

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-persistence/
├── plan.md              # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── storage-adapters.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not this command)
```

### Source Code (repository root)

```text
src/
├── application/
│   └── errors.ts                         # FR-012a: add `kind` discriminant to StorageError (only application/ touch)
├── infrastructure/
│   ├── in-memory-storage-adapter.ts       # unchanged — remains the test-only fake
│   ├── schema-version.ts                  # NEW — CURRENT_SCHEMA_VERSION=1 + pure decideSchemaAction() (FR-007a/008/009/010), shared by both adapters
│   ├── indexed-db-storage-adapter.ts       # NEW — Dexie-backed StoragePort
│   ├── indexed-db/                         # NEW — Dexie schema/table definitions, mapping helpers
│   │   └── schema.ts
│   ├── file-system-storage-adapter.ts      # NEW — File System Access-backed StoragePort
│   └── file-system/                        # NEW — per-record-kind file naming/serialization helpers
│       └── layout.ts
└── presentation/
    └── main.tsx                            # EDIT — feature-detect and instantiate the real adapter (FR-004/004a) instead of InMemoryStorageAdapter

test/
├── unit/
│   └── infrastructure/
│       ├── schema-version.test.ts          # NEW — pure decision-function tests (Vitest)
│       └── storage-error.test.ts           # NEW — StorageError.kind construction tests (Vitest)
├── contract/
│   └── storage-adapter-contract.ts         # NEW — the shared Given/When/Then scenario suite, adapter-agnostic
└── e2e/
    ├── fixtures/
    │   └── storage-harness.html            # NEW — minimal page exposing an adapter instance to page.evaluate()
    ├── indexed-db-adapter.contract.spec.ts # NEW — runs the shared suite against IndexedDbStorageAdapter (chromium + webkit projects)
    └── file-system-adapter.contract.spec.ts # NEW — runs the shared suite against FileSystemStorageAdapter (chromium project only — File System Access is unavailable on webkit, matching feature detection)
```

**Structure Decision**: Single project, existing layered `src/` structure
(`docs/architecture.md`). This spec only adds `infrastructure/` files (plus
the one `application/errors.ts` extension already justified above) and edits
the composition root — no new top-level directory, no change to
`application/` or `presentation/` screen code, no change to
`eslint.boundaries.js`/`docs/architecture.md` (no new layer, no new edge).

## Complexity Tracking

*No violations — table intentionally omitted.*
