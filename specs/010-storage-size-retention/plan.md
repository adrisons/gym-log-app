# Implementation Plan: Storage Size Display and Old-Data Retention Cleanup

**Branch**: `010-storage-size-retention` | **Date**: 2026-10-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-storage-size-retention/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Settings → Data gains two small, independent additions, both expressed
purely in terms of the existing `StoragePort` (ADR-0002) and the existing
Session domain entity — no new persisted shape, no schema version bump
(confirmed by `schema-guardian`'s review of the spec). First, a
whole-number KB/MB size readout next to the existing storage-status line:
computed entirely in the `application` layer from the port's existing read
methods (`listSessions`, `listExercises`, `getSettings`, `getDraft`) —
no new port surface needed, since every record this figure covers is
already readable through the port as-is. Second, a "Delete old data" modal
offering three preloaded cutoff options (1 year / 6 months / 3 months back)
or an explicit date, which deletes every Session dated before that cutoff
in one atomic port call. This one *does* need a new port method
(`deleteSessionsBefore`) — composing today's `listSessions` + a loop of
`deleteSession` calls cannot give FR-010's all-or-nothing guarantee, the
gap `schema-guardian` flagged — implemented across all three adapters
(in-memory, IndexedDB, File System Access), following the exact atomicity
pattern each adapter already uses for `resetToFreshInstall`/`importBulk`
(spec 006). This is v1 Settings-phase work (`docs/requirements.md` §9), not
MVP.

## Technical Context

**Language/Version**: TypeScript 5.x (React 19) — unchanged, per `docs/stack.md`.

**Primary Dependencies**: None new. Reuses Zustand (settings/logging-session
stores), Dexie (IndexedDB adapter), and the hand-written File System Access
adapter already named in `docs/stack.md`. Date arithmetic (FR-006a's
quick-option clamping, FR-009a's start-of-day cutoff) uses the platform
`Date`, the same choice `docs/stack.md`'s "Deferred" table already expects
to suffice for this kind of date-time logic — no date library is added.

**Storage**: The existing two-adapter `StoragePort` (ADR-0002) — this
feature adds exactly one method to that port's contract
(`deleteSessionsBefore`, see `contracts/storage-port-additions.md`) and
implements it in all three adapters (`InMemoryStorageAdapter`,
`IndexedDbStorageAdapter`, `FileSystemStorageAdapter`); the size readout
needs no port change at all, since it is computed in `application/` purely
from existing read methods. No new storage mechanism either way.

**Testing**: Vitest + `@testing-library/react` for unit/component tests
(the new modal, the size readout, each adapter's new methods via the
existing storage-port contract test suite pattern — `test/e2e/*-adapter.contract.spec.ts`
already runs the same scenario list against every adapter); Playwright only
if a shell-level smoke path is affected (not expected — this stays inside
the existing Settings screen).

**Target Platform**: Same as the rest of the app — a PWA, installed or
browser-tab, across the File System Access (desktop Chromium) and
IndexedDB (every other target, including iOS Safari) adapters (ADR-0002).

**Project Type**: Single-project PWA (no frontend/backend split) — unchanged.

**Performance Goals**: The size computation and the cutoff-matching count
(FR-007) both read the full session/exercise/settings/draft set already in
memory or one adapter read away; no new goal beyond the existing
constitution Principle II (logging path) which this feature does not touch
at all (it lives entirely in Settings).

**Constraints**: Offline-capable (no network call added — none of this
feature's data ever leaves the device, Principle I). The size figure and
the delete flow must work identically regardless of which adapter is
active, per Principle IV (ports, not adapter-specific presentation code).

**Scale/Scope**: One Settings sub-section (two new presentation components:
a size readout and a delete-old-data modal), two new `StoragePort` methods
across three adapters, no new screen, no new route.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Data Ownership and Recoverability** — PASS. The size readout is
  derived/recomputable (spec Non-Goals; `schema-guardian` confirmed no
  schema impact). The scoped delete is a user-initiated, irreversible
  removal of canonical records the user explicitly chose to discard —
  the same category 006's "delete everything" already established as
  acceptable without an undo window (spec's own Non-Goals explain why, same
  reasoning as 006). Export/import (FR-11/12) is unaffected: a deleted
  session is simply absent from the next export, same as never recorded.
- **II. Logging Is the Critical Path** — PASS (not applicable). This
  feature lives entirely in Settings; nothing here touches
  `logging-session` store, the logging screen, or adds any latency,
  network call, or blocking step to recording a set.
- **III. Behavior-Driven Development Before Code** — PASS. This plan
  follows a reviewed spec (`spec.md`, Status: Reviewed) with Given/When/Then
  acceptance scenarios for both user stories; `/speckit-tasks` comes next,
  before any implementation code.
- **IV. External Dependencies Behind Ports** — PASS. The one new capability
  that needs a port change (`deleteSessionsBefore`, scoped delete) is
  expressed in domain vocabulary ("delete sessions dated before X"), not in
  adapter-specific terms, and ships with an `InMemoryStorageAdapter`
  implementation usable in tests, matching every other port method. The
  size readout needs no port change — it is a pure application-layer
  computation over the port's existing read methods, so there is nothing
  new to keep behind a port in the first place.
- **V. Dependency-Inward Layering** — PASS. The two new presentation
  components (size readout, delete-old-data modal) consume the port via
  the existing `application/` layer conventions this Settings screen
  already follows (`data-section.tsx`, `delete-everything-flow.tsx`); no
  persistence type crosses into `presentation/`.
- **VI. Deterministic, Traceable Insights** — PASS (not applicable). No
  analytical/insight card is added; the size figure and the session count
  are both exact, deterministic reads of stored data, not a derived
  "insight."

No violations. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/010-storage-size-retention/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── storage-port-additions.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── application/
│   ├── ports/
│   │   └── storage-port.ts          # + deleteSessionsBefore
│   └── settings/
│       └── storage-size.ts          # NEW — computeStorageSizeLabel(port): Promise<string>,
│                                        pure application-layer function (no port change)
├── infrastructure/
│   ├── in-memory-storage-adapter.ts # + deleteSessionsBefore
│   ├── indexed-db-storage-adapter.ts# + deleteSessionsBefore (Dexie range delete in a transaction)
│   └── file-system-storage-adapter.ts # + deleteSessionsBefore (journal pattern, 3rd PendingBulkWrite kind)
└── presentation/
    └── settings/
        ├── data-section.tsx          # wires the new readout + modal trigger in
        ├── storage-size-section.tsx  # NEW — the KB/MB readout (FR-001-004)
        └── delete-old-data-flow.tsx  # NEW — the cutoff modal (FR-005-012)

test/
├── unit/
│   ├── application/settings/         # storage-size.ts rounding/unit-selection behavior
│   ├── application/logging/          # or wherever deleteSessionsBefore's store action
│   │                                    lands, exercised via InMemoryStorageAdapter
│   └── presentation/settings/        # storage-size-section, delete-old-data-flow
└── e2e/
    ├── indexed-db-adapter.contract.spec.ts   # + deleteSessionsBefore scenarios
    └── file-system-adapter.contract.spec.ts  # + deleteSessionsBefore scenarios
```

**Structure Decision**: Single-project PWA, unchanged. New files land inside
the existing layer directories (`application/ports`, `infrastructure`,
`presentation/settings`) following exactly the pattern `specs/006-settings-data`
and `specs/009-pwa-installability-and-updates` already established for
Settings-screen features and port additions — no new layer, no new
top-level directory.

## Complexity Tracking

*No violations — table intentionally omitted (template instruction: fill
only if the Constitution Check above found one).*
