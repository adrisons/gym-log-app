# Implementation Plan: Settings, Export and Import

**Branch**: `006-settings-data` (work happens on `claude/next-implementation-steps-h28ebx` per this session's branch mapping) | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-settings-data/spec.md`

## Summary

Closes v1 (`docs/agent-brief.md` Phase 6): a Settings screen (unit, quick
increments, theme, first day of week, band-label management) and a Data
section (export, import, delete-everything) on top of the existing
`StoragePort`/schema-version mechanism (spec 003), with no change to that
mechanism's own behavior (FR-017). Adds one new non-canonical persisted
record (`Settings`, mirroring the existing `LoggingDraft`/band-labels
precedent — no schema bump, D14), a JSON interchange export/import format
that reuses the app's own `CURRENT_SCHEMA_VERSION` axis, a one-way tabular
(CSV) export, and a new atomic bulk-write capability on `StoragePort`
(FR-011) that both import and delete-everything need and that does not
exist today.

Two decisions carried over from Clarifications (spec.md) shape the
interchange format specifically: it must stay additive-compatible for
future disciplines/parameters (FR-021) and it must be directly
interpretable by a general-purpose AI assistant with no extra tooling
(FR-022) — both are satisfied by the same design choice (plain, versioned,
self-describing JSON with readable references, FR-007/FR-008), not by a
fourth format.

**Discovered dependency, resolved in this plan, not new scope**: D9/
ADR-0005 ("ship a seed exercise catalogue", Accepted) has no
implementation anywhere in `src/` — first launch currently seeds nothing.
FR-016 (delete-everything resets the catalogue to "exactly the seed set")
cannot be implemented without it. This plan closes that pre-existing gap
as a small, narrowly-scoped prerequisite (research.md §1), not as a new
decision — D9 was already closed, only never wired up.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), unchanged.

**Primary Dependencies**: None new for JSON export/import (native
`JSON.stringify`/`JSON.parse`). CSV generation is hand-rolled (research.md
§5) — the format is trivial enough (RFC 4180 quoting only) that a library
would be a second tool for a concern `docs/stack.md` doesn't already name,
which needs an ADR; a ~30-line hand-rolled encoder does not. File save/open
uses the File System Access API (`showSaveFilePicker`/`showOpenFilePicker`)
where available, with an `<a download>`/`<input type="file">` fallback —
same feature-detection shape as `select-adapter.ts` already uses for
storage, no new dependency.

**Storage**: Extends the existing `StoragePort` (`specs/002-domain-and-ports`)
with `getSettings`/`saveSettings` (mirrors `listBandLabels`/`saveBandLabels`),
and a new `importBulk`/`resetToFreshInstall` pair for FR-011/FR-016's atomic
multi-record write. Implemented on all three adapters (`InMemoryStorageAdapter`,
`IndexedDbStorageAdapter`, `FileSystemStorageAdapter`) — see research.md §2
for the per-adapter atomicity technique (Dexie transaction vs. a
write-ahead journal file, since the File System Access API has no native
multi-file transaction primitive).

**Testing**: Vitest unit tests for every new pure `application/` module
(settings defaults, import preview, schema migration, CSV encoding, seed
catalogue). Extends `test/contract/storage-adapter-contract.ts` with the
new port methods, run against all three adapters (mirrors spec 003's
existing pattern). Component tests (`@testing-library/react`) for the
Settings screen and the import-preview flow. One Playwright smoke addition
for the `/settings` route, following spec 004/005's precedent. No
automated LLM-in-the-loop test for SC-008 — that check is manual
(research.md §6), recorded once in quickstart.md.

**Target Platform**: Same PWA, no new platform dependency. File System
Access's `showSaveFilePicker`/`showOpenFilePicker` are already
feature-detected the same way `showDirectoryPicker` is (browsers lacking
it — Firefox, older Safari — get the `<a download>`/`<input type="file">`
fallback, which every browser this app already targets supports).

**Project Type**: Single web app, existing layered `src/` structure — no
structural change beyond new files (below).

**Performance Goals**: `docs/requirements.md` §7.1 sets no number specific
to export/import/delete-everything (spec.md FR-020); this plan's own
representative-data-set measurement (100 sessions × 4 blocks × 3 exercises
× 3 sets, the same order of magnitude spec 003/005 already exercise) is
recorded once, manually, in quickstart.md — no CI perf gate is added
(consistent with spec.md FR-020's own wording: "does not itself set a
pass/fail number").

**Constraints**: No change to the schema-version migrate/open/refuse
behavior for local storage (FR-017). No change to `docs/requirements.md`
§7.4 accessibility baseline — every new interactive element ships all six
states (`docs/testing.md`). The logging critical path (Principle II) is
untouched: no `StoragePort` call on `logging-store.ts`'s paths changes
shape or timing.

**Scale/Scope**: One new screen (`presentation/settings/`) with four
sub-sections, one new `application/ports/settings.ts`, one new
`application/data-transfer/` module tree (export/import/preview/CSV), one
extracted `application/schema-migration.ts` (deduplicating logic already
present, differently, in both adapters), one new `application/catalogue/
seed-exercises.ts` (closes the D9 gap above), one new
`application/ports/file-exchange-port.ts` + its infrastructure adapter,
four extended `StoragePort` methods implemented three times
(`InMemoryStorageAdapter`, `IndexedDbStorageAdapter`,
`FileSystemStorageAdapter`), one composition-root wiring addition
(`main.tsx`: first-launch seeding, `useFileExchangeAccess.configure`, the
`/settings` route, one `HeaderNav` entry), and one existing-file edit
(`insights-screen.tsx`/`consistency.ts` threading `firstDayOfWeek`
through, FR-018).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — no changes below the gate re-check line.*

| Principle | Check | Result |
|---|---|---|
| I. Data Ownership & Recoverability | This is the feature that makes invariant 1's "everything exportable" concrete. Export/import add no new canonical entity (Settings is explicitly non-canonical, D14, same precedent as band labels/draft) and change no existing one. The bulk-write journal for the File System adapter (research.md §2) is itself a recoverable-writes mechanism, not a workaround of one. | PASS |
| II. Logging Is the Critical Path | Nothing in this feature is reachable from `LoggingScreen`/`logging-store.ts`; Settings is a separate route behind `HeaderNav`, exactly like Insights (spec 005). No `StoragePort` method signature used by logging changes. | PASS |
| III. BDD Before Code | spec.md's five User Stories are already Given/When/Then. FR-021 (Clarifications) explicitly requires the interchange format to survive a future non-Strength discipline without a redesign — verified in data-model.md by using the domain's own already-discipline-neutral shapes (Load/Volume/Effort, `Exercise.discipline`) as the export schema, not a bespoke flattened one. | PASS |
| IV. External Dependencies Behind Ports | Two ports, both with in-memory fakes: the extended `StoragePort` (existing pattern) and the new `FileExchangePort` (file save/open dialogs) — `application/data-transfer/` never touches `window.showSaveFilePicker`/`<a download>` directly. | PASS |
| V. Dependency-Inward Layering | New `application/schema-migration.ts` is pure (`Exercise[]` → `Exercise[]`), importable by both `infrastructure/` adapters (allowed edge) and by `application/data-transfer/` (intra-layer) — this is *why* it is extracted to `application/`, not left duplicated in `infrastructure/` per-adapter as it is today. `Settings`'s type lives in `application/ports/` (mirrors `LoggingDraft`) since `storage-port.ts` references it and `application-ports` may import only `domain`. No `presentation/settings/` file imports `infrastructure/` or `domain/` directly. | PASS |
| VI. Deterministic, Traceable Insights | Untouched by this feature except FR-018's mechanical parameter threading (`firstDayOfWeek` into the already-deterministic `computeConsistency`) — no new insight, no new heuristic. | PASS |
| Escalation (technology choices) | No new production dependency (File System Access's save/open pickers and hand-rolled CSV are both within already-approved/native surface). The one implementation-detail choice needing a documented rationale — the File System adapter's write-ahead-journal atomicity technique, since Dexie's transaction cannot cover the file-based adapter — is recorded with alternatives considered in research.md §2, the same disposition spec 003 gave its own Playwright-vs-jsdom choice. The D9/ADR-0005 gap-closure (Summary) is not a new decision (D9 was already Accepted) so it does not need re-escalation, only implementation. | PASS |

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-settings-data/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── storage-port-additions.md
│   ├── file-exchange-port.md
│   └── screen-contracts.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not this command)
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── (unchanged — no canonical entity added or reshaped)
├── application/
│   ├── ports/
│   │   ├── settings.ts                    # NEW — Settings type + withSettingsDefaults() (mirrors logging-draft.ts)
│   │   ├── file-exchange-port.ts          # NEW — FileExchangePort interface (save/pick a file)
│   │   └── storage-port.ts                # EDIT — + getSettings/saveSettings, + importBulk, + resetToFreshInstall
│   ├── schema-migration.ts                # NEW — extracted from both adapters' #migrateExerciseTemplateDefaults/withTemplateDefaults (FR-012 in-memory reuse)
│   ├── catalogue/
│   │   └── seed-exercises.ts              # NEW — D9/ADR-0005 gap closure: the seed list + buildSeedCatalogue()
│   ├── settings-store.ts                  # NEW — Zustand store, configure(storage) pattern (mirrors logging-store.ts)
│   └── data-transfer/
│       ├── export-file.ts                 # NEW — ExportFile type + buildExportFile() (FR-007/008/021/022/023)
│       ├── tabular-export.ts              # NEW — FR-009 CSV encoding, one row per Set
│       ├── import-preview.ts              # NEW — FR-010 computeImportPreview(), pure
│       ├── import-validation.ts           # NEW — FR-013/014 parse + structural validation, no partial reads
│       └── apply-import.ts                # NEW — FR-011/012 orchestrates migration + preview + StoragePort.importBulk
├── infrastructure/
│   ├── in-memory-storage-adapter.ts       # EDIT — + settings map, + importBulk, + resetToFreshInstall
│   ├── indexed-db-storage-adapter.ts      # EDIT — + settings table, + importBulk/resetToFreshInstall via db.transaction
│   ├── indexed-db/schema.ts               # EDIT — + settings table
│   ├── file-system-storage-adapter.ts     # EDIT — + settings.json, + importBulk/resetToFreshInstall via write-ahead journal (research.md §2)
│   ├── file-system/layout.ts              # EDIT — + SETTINGS_FILE, + PENDING_BULK_WRITE_FILE constants
│   └── file-exchange-adapter.ts           # NEW — FileExchangePort impl: File System Access pickers + <a download>/<input> fallback
├── presentation/
│   ├── main.tsx                           # EDIT — first-launch seeding (seed-exercises.ts), useFileExchangeAccess.configure, "/settings" route
│   ├── nav/header-nav.tsx                 # EDIT — + Settings entry
│   ├── insights/
│   │   ├── insights-screen.tsx            # EDIT — reads Settings.firstDayOfWeek, passes to buildInsights (FR-018)
│   │   └── build-insights.ts (application) # EDIT — threads firstDayOfWeek through to consistency.ts
│   └── settings/
│       ├── settings-screen.tsx            # NEW — FR-001-004, hosts all sub-sections
│       ├── unit-and-increments-section.tsx # NEW — FR-001
│       ├── theme-section.tsx              # NEW — FR-001/003
│       ├── first-day-of-week-section.tsx  # NEW — FR-001/018
│       ├── band-labels-section.tsx        # NEW — FR-004/005 (reorder/rename/remove)
│       ├── data-section.tsx               # NEW — FR-006 hosts export/import/delete-everything
│       ├── export-controls.tsx            # NEW — FR-007/009
│       ├── import-flow.tsx                # NEW — FR-010/011 file pick → preview → confirm/cancel
│       └── delete-everything-flow.tsx     # NEW — FR-015/016 two-step confirmation
└── application/insights/consistency.ts    # EDIT — computeConsistency(sessions, firstDayOfWeek, asOf) FR-018

test/
├── unit/
│   ├── application/
│   │   ├── schema-migration.test.ts
│   │   ├── settings.test.ts               # withSettingsDefaults()
│   │   ├── catalogue/seed-exercises.test.ts
│   │   ├── data-transfer/
│   │   │   ├── export-file.test.ts
│   │   │   ├── tabular-export.test.ts
│   │   │   ├── import-preview.test.ts
│   │   │   ├── import-validation.test.ts
│   │   │   └── apply-import.test.ts
│   │   └── insights/consistency.test.ts   # EDIT — firstDayOfWeek cases
│   ├── infrastructure/
│   │   └── file-exchange-adapter.test.ts
│   └── presentation/settings/
│       ├── settings-screen.test.tsx
│       ├── import-flow.test.tsx
│       └── delete-everything-flow.test.tsx
├── contract/
│   └── storage-adapter-contract.ts        # EDIT — + settings, importBulk, resetToFreshInstall cases
├── integration/
│   └── data-transfer-flow.test.ts         # NEW — export → import round-trip via createHarness()
└── e2e/
    └── shell-smoke.spec.ts                # EDIT — + /settings route reachability
```

**Structure Decision**: Single project, existing layered `src/` structure.
No new top-level directory and no new edge in `eslint.boundaries.js` — the
new `application/data-transfer/`, `application/catalogue/`, and
`presentation/settings/` trees all follow the exact directory-per-feature
convention specs 004/005 already established, and the new
`FileExchangePort` follows the same port/adapter split ADR-0002 set for
`StoragePort`.

## Complexity Tracking

*No violations — table intentionally omitted.*
