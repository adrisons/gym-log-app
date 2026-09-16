# Implementation Plan: PWA Installability and Update Lifecycle

**Branch**: `009-pwa-installability-and-updates` (work happens on
`claude/app-evolution-next-steps-f4tih0` per this session's branch mapping)
| **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-pwa-installability-and-updates/spec.md`

## Summary

Closes the first slice of D22's "polish before a new discipline": three
gaps in how the app behaves as an installable, updatable PWA, none
touching the domain model or the stored schema (spec.md Non-Goals). Flips
`vite.config.ts`'s service-worker registration from `'autoUpdate'` (today's
silent, forced reload — the Principle II risk that motivated this spec) to
`'prompt'`, giving the app a user-visible, user-controlled update notice
(FR-001-005) via a new `PwaLifecyclePort`. The same port also drives a
browser-to-install offer (FR-010-015), native on Chromium
(`beforeinstallprompt`) and instructional on iOS Safari. `StoragePort`
gains two read-only/gesture-gated methods so Settings can finally show
which of `ADR-0002`'s two adapters is active and, for the File System
Access adapter, the chosen folder's name and a way to reconfirm lost
permission (FR-006-009/FR-017 — the latter closes a "future spec" item
`specs/003-persistence` explicitly deferred). Both new UI surfaces render
inside the existing `AppShell` only, never `LoggingShell`, which satisfies
FR-018 (never on `/log`) structurally rather than with a runtime check.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), unchanged.

**Primary Dependencies**: None new. Reuses `vite-plugin-pwa` (already in
`docs/stack.md` for this exact concern) — only its `registerType` config
value changes (`'autoUpdate'` → `'prompt'`) and the already-present,
non-React `virtual:pwa-register` module is called from a new adapter
instead of inline in `main.tsx`. The install offer uses the native
`beforeinstallprompt`/`appinstalled` window events and `matchMedia`/
`navigator.standalone` — no library. Storage status reads the File System
Access handle's own `.name` and `requestPermission()`, both already
available to `FileSystemStorageAdapter` today.

**Storage**: Extends the existing `StoragePort`
(`specs/002-domain-and-ports`) with `getStorageStatus()` and
`reconfirmFileSystemAccess()` (contracts/storage-port-additions.md),
implemented on all three adapters. The one new *persisted* bit
(install-offer-dismissed, FR-016) is deliberately stored outside
`StoragePort`, directly in `localStorage` by the new
`PwaLifecycleAdapter` — see research.md §4/data-model.md for why that
placement is what makes FR-016 true by construction rather than by a
filtering rule.

**Testing**: Vitest unit tests for `pwa-lifecycle-store.ts`,
`storage-status-store.ts`, `unconfirmed-entry-tracker.ts`, and the two new
presentation components (`@testing-library/react`, all six interaction
states per `docs/design.md` §5). `test/contract/storage-adapter-contract.ts`
extended with `getStorageStatus`/`reconfirmFileSystemAccess` cases across
all three adapters (mirrors spec 006's own extension). One new Playwright
spec (`test/e2e/pwa-lifecycle.contract.spec.ts`, Chromium only) drives a
real service-worker update and a synthetic `beforeinstallprompt` via
Chrome DevTools Protocol — the same "real browser API, not jsdom"
rationale spec 003/006 already established for their own browser-only
suites. iOS Safari's manual-install copy is verified once, manually
(quickstart.md §3.3), not in CI.

**Target Platform**: Same PWA, no new platform dependency — every
capability used here (`beforeinstallprompt`, `matchMedia
('display-mode')`, `navigator.standalone`, `FileSystemDirectoryHandle
.name`/`.requestPermission()`, `vite-plugin-pwa`'s `registerSW`) is either
already used elsewhere in this codebase or standard, already-targeted
browser surface.

**Project Type**: Single web app, existing layered `src/` structure — no
structural change beyond new files (below).

**Performance Goals**: `docs/requirements.md` §7.1 sets no number specific
to this feature; the periodic update-check interval (30 minutes,
research.md §1) is a UX/battery balance, not a performance target to
benchmark. No change to any existing logging-path timing.

**Constraints**: Principle II (NON-NEGOTIABLE) is this feature's central
constraint for User Story 1 — enforced by (a) `registerType: 'prompt'`
itself never auto-applying, and (b) the update notice rendering only
inside `AppShell`, structurally excluded from `LoggingShell`/`/log`
(research.md §3), combined with the `unconfirmed-entry-tracker` gate
(research.md §2) for the case where a user reaches Settings or Insights
mid-entry via some other path. `docs/requirements.md` §7.4 accessibility
baseline applies to every new interactive element (all six states,
`docs/design.md` §5) — Settings' reconnect button, the update notice's
apply control, the install offer's install/dismiss controls.

**Scale/Scope**: One new application-layer port
(`application/ports/pwa-lifecycle.ts` + its store), one new small
`StoragePort` extension + type (`storage-status.ts`), one new tracker
store (`unconfirmed-entry-tracker.ts`), one new infrastructure adapter
(`pwa-lifecycle-adapter.ts`) + its test fake, one new Settings section
(`storage-status-section.tsx`), two new presentation components rendered
once each inside `AppShell` (`update-notice.tsx`, `install-offer.tsx`),
one `vite.config.ts` one-line change, one `set-row.tsx` edit (calls the
new tracker), one `main.tsx` wiring edit.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — no changes below the gate re-check line.*

| Principle | Check | Result |
|---|---|---|
| I. Data Ownership & Recoverability | No canonical entity touched (Non-Goals; `schema-guardian`-confirmed). FR-016's export/import exclusion is itself in service of invariant 1's "the user controls their data" — a device-local UI preference never masquerades as portable user data. | PASS |
| II. Logging Is the Critical Path | The one feature whose entire P1 story exists to *protect* this principle (spec.md User Story 1). No `StoragePort` method used on `logging-store.ts`'s paths changes shape or timing; `set-row.tsx`'s edit only adds two cheap store calls (`increment`/`decrement`), no added latency or blocking step. Both new notices are structurally excluded from `/log` (research.md §3). | PASS |
| III. BDD Before Code | spec.md's three User Stories are already Given/When/Then, revised once already against `spec-reviewer` findings before this plan. | PASS |
| IV. External Dependencies Behind Ports | Two ports, both with in-memory fakes: the extended `StoragePort` (existing pattern) and the new `PwaLifecyclePort` (`beforeinstallprompt`, service-worker lifecycle, standalone detection) — no `presentation/` or `application/` file touches `window.beforeinstallprompt`, `registerSW`, or `localStorage` directly outside `infrastructure/pwa-lifecycle-adapter.ts`. | PASS |
| V. Dependency-Inward Layering | `unconfirmed-entry-tracker.ts` and `pwa-lifecycle-store.ts`/`storage-status-store.ts` all live in `application/`, consumed by `presentation/` only through their public store API (never a raw port import from a screen). `StorageStatus`/`PwaLifecyclePort` types live in `application/ports/`, matching `settings.ts`/`logging-draft.ts`'s existing placement. | PASS |
| VI. Deterministic, Traceable Insights | Untouched — this feature adds no insight card, no computed number shown to the user beyond plain status text (folder name, "update available"). | PASS |
| Escalation (technology choices) | No new production dependency. The one config change (`registerType: 'prompt'`) is a value change to an already-approved tool for the exact concern it's approved for (`docs/stack.md`), not a new tool — does not itself need a fresh ADR. The two ADR-0002 adapters' contract is extended, not altered (`docs/stack.md`'s "any change to the storage architecture" bar refers to the two-adapter/one-port *architecture*, which is unchanged; adding two methods to the shared interface is the same category of change spec 006 already made without an ADR). | PASS |

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/009-pwa-installability-and-updates/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── storage-port-additions.md
│   ├── pwa-lifecycle-port.md
│   └── screen-contracts.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not this command)
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── (unchanged — no canonical entity added or reshaped)
├── application/
│   ├── ports/
│   │   ├── storage-status.ts              # NEW — StorageStatus type
│   │   ├── pwa-lifecycle.ts               # NEW — PwaLifecyclePort interface + InstallOfferKind
│   │   └── storage-port.ts                # EDIT — + getStorageStatus, + reconfirmFileSystemAccess
│   ├── pwa-lifecycle-store.ts             # NEW — Zustand store, configure(port) pattern
│   ├── storage-status-store.ts            # NEW — Zustand store, configure(storage)/load()/reconfirm()
│   └── logging/
│       └── unconfirmed-entry-tracker.ts   # NEW — ref-count store (FR-002/FR-018)
├── infrastructure/
│   ├── pwa-lifecycle-adapter.ts           # NEW — registerSW wrapper, beforeinstallprompt, localStorage dismiss flag
│   ├── in-memory-storage-adapter.ts       # EDIT — + getStorageStatus/reconfirmFileSystemAccess (no-ops)
│   ├── indexed-db-storage-adapter.ts      # EDIT — + getStorageStatus/reconfirmFileSystemAccess (no-ops)
│   └── file-system-storage-adapter.ts     # EDIT — + getStorageStatus/reconfirmFileSystemAccess (real)
├── presentation/
│   ├── main.tsx                           # EDIT — construct PwaLifecycleAdapter (replaces bare registerSW call), configure() the two new stores
│   ├── app-shell.tsx                      # EDIT — + <UpdateNotice/> + <InstallOffer/> inside AppShell only
│   ├── logging/
│   │   └── set-row.tsx                    # EDIT — calls unconfirmed-entry-tracker's increment/decrement
│   ├── pwa/
│   │   ├── update-notice.tsx              # NEW — FR-001-005/FR-018
│   │   └── install-offer.tsx              # NEW — FR-010-018
│   └── settings/
│       ├── settings-screen.tsx            # EDIT — + <StorageStatusSection/>
│       └── storage-status-section.tsx     # NEW — FR-006-009/FR-017
└── (vite.config.ts EDIT — registerType: 'autoUpdate' → 'prompt')

test/
├── unit/
│   ├── application/
│   │   ├── pwa-lifecycle-store.test.ts
│   │   ├── storage-status-store.test.ts
│   │   └── logging/unconfirmed-entry-tracker.test.ts
│   ├── infrastructure/
│   │   └── pwa-lifecycle-adapter.test.ts
│   └── presentation/
│       ├── pwa/update-notice.test.tsx
│       ├── pwa/install-offer.test.tsx
│       └── settings/storage-status-section.test.tsx
├── support/fakes/
│   └── pwa-lifecycle-fake.ts               # NEW — PwaLifecyclePort in-memory fake
├── contract/
│   └── storage-adapter-contract.ts         # EDIT — + getStorageStatus/reconfirmFileSystemAccess cases
└── e2e/
    └── pwa-lifecycle.contract.spec.ts      # NEW — Chromium-only, real SW update + synthetic beforeinstallprompt
```

**Structure Decision**: Single project, existing layered `src/` structure.
No new top-level directory beyond `presentation/pwa/` (mirrors the
existing directory-per-feature convention of `presentation/settings/`,
`presentation/insights/`, etc.) and no new edge in `eslint.boundaries.js`
— `PwaLifecyclePort` follows the exact port/adapter split ADR-0002 already
set for `StoragePort`.

## Complexity Tracking

*No violations — table intentionally omitted.*
