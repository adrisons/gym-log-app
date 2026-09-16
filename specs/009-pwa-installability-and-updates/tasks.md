---

description: "Task list template for feature implementation"
---

# Tasks: PWA Installability and Update Lifecycle

**Input**: Design documents from `/specs/009-pwa-installability-and-updates/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/,
quickstart.md — all present (merged to `main` via PR #35).

**Tests**: Included — `plan.md`'s Technical Context explicitly calls for
Vitest unit tests, the extended storage-adapter contract suite, and one
Playwright e2e spec.

**Organization**: Tasks are grouped by user story (spec.md: US1 update
lifecycle P1, US2 storage status P2, US3 install offer P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Every task names its exact file path

---

## Phase 1: Setup

- [ ] T001 Change `registerType: 'autoUpdate'` to `'prompt'` in
  `vite.config.ts` (research.md §1) — the one config line every later task
  in this feature depends on being in "prompt" mode.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared `PwaLifecyclePort` substrate both US1 (update) and
US3 (install offer) are built on. **US2 (storage status) does not depend
on this phase** and could be implemented first if preferred (Independent
Test in spec.md holds either way).

- [ ] T002 [P] Create `PwaLifecyclePort` interface + `InstallOfferKind`
  type in `src/application/ports/pwa-lifecycle.ts`
  (contracts/pwa-lifecycle-port.md — full method list).
- [ ] T003 [P] Create `test/support/fakes/pwa-lifecycle-fake.ts`: an
  in-memory `PwaLifecyclePort` with test helpers
  (`triggerUpdateAvailable()`, `triggerInstallOfferKind(kind)`,
  `simulateInstallChoice(outcome)`) per contracts/pwa-lifecycle-port.md's
  "Test fake" section.
- [ ] T004 Create `src/application/pwa-lifecycle-store.ts`: Zustand store,
  `configure(port: PwaLifecyclePort)` pattern mirroring
  `settings-store.ts`; subscribes to `onUpdateAvailable`/
  `onInstallOfferKindChange` on configure, exposes `updateAvailable`,
  `applyUpdate`, `installOfferKind`, `promptNativeInstall`,
  `dismissInstallOfferPermanently`, `dismissForThisVisit` (in-memory only)
  (depends on T002).
- [ ] T005 Create `src/infrastructure/pwa-lifecycle-adapter.ts` —
  **update-lifecycle half only** in this task (install-offer half is T030,
  US3): wraps `virtual:pwa-register`'s plain `registerSW({ immediate:
  true, onNeedRefresh, onRegisteredSW })`; `onNeedRefresh` notifies every
  `onUpdateAvailable` subscriber; `applyUpdate()` calls the returned
  `updateServiceWorker(true)`; `onRegisteredSW` starts a 30-minute
  `setInterval(() => registration.update(), ...)`, cleared if the
  registration is lost (research.md §1) (depends on T001, T002).
- [ ] T006 Edit `src/presentation/main.tsx`: construct `new
  PwaLifecycleAdapter()` in place of the current bare `registerSW({
  immediate: true })` call; call
  `usePwaLifecycleStore.getState().configure(adapter)` alongside the
  existing `configure()` calls in `mount()` (depends on T004, T005).

**Checkpoint**: `PwaLifecyclePort`'s update half is wired end-to-end (real
adapter + store + fake); US1 can now be implemented and tested.

---

## Phase 3: User Story 1 - Never lose a set to a silent update (Priority: P1) 🎯 MVP

**Goal**: an update notice that never applies while a set is unconfirmed
(spec.md FR-001-005/FR-018).

**Independent Test**: install the app, start filling in the add-set form
without confirming, trigger a new-version deployment, confirm no reload
happens and the notice waits until the entry is confirmed/cancelled
(spec.md User Story 1 Independent Test).

### Tests for User Story 1

- [ ] T007 [P] [US1] Unit test
  `src/application/logging/unconfirmed-entry-tracker.ts`'s
  increment/decrement/`hasUnconfirmedEntry()` ref-counting in
  `test/unit/application/logging/unconfirmed-entry-tracker.test.ts`.
- [ ] T008 [P] [US1] Unit test `pwa-lifecycle-store.ts`'s update-lifecycle
  behavior (using the T003 fake: `triggerUpdateAvailable()` flips
  `updateAvailable`; `applyUpdate()` calls the fake's `applyUpdate`; a
  version already current at launch never sets `updateAvailable`, FR-005)
  in `test/unit/application/pwa-lifecycle-store.test.ts`.
- [ ] T009 [P] [US1] Component test `update-notice.tsx` in
  `test/unit/presentation/pwa/update-notice.test.tsx`: renders nothing by
  default, nothing while `hasUnconfirmedEntry()` is true even with
  `updateAvailable`, the banner + all six interaction states
  (`docs/design.md` §5) on its Apply control once both conditions clear.

### Implementation for User Story 1

- [ ] T010 [P] [US1] Create
  `src/application/logging/unconfirmed-entry-tracker.ts`: Zustand store,
  `count: number`, `increment()`, `decrement()`,
  `hasUnconfirmedEntry(): boolean` (research.md §2).
- [ ] T011 [US1] Edit `src/presentation/logging/set-row.tsx`: call the
  tracker's `increment()` the moment `canConfirm`-relevant fields go from
  empty to holding a value, and `decrement()` on Confirm, Cancel, or
  unmount while still non-empty (depends on T010).
- [ ] T012 [US1] Create `src/presentation/pwa/update-notice.tsx`: renders
  nothing unless `pwa-lifecycle-store`'s `updateAvailable` is true AND
  `unconfirmed-entry-tracker`'s `hasUnconfirmedEntry()` is false; a small,
  non-blocking banner with an "Update" control calling `applyUpdate()` and
  a non-destructive "later" affordance (FR-004) (depends on T004, T010).
- [ ] T013 [US1] Edit `src/presentation/app-shell.tsx`: render
  `<UpdateNotice/>` inside `AppShell`'s render only — `LoggingShell` is
  untouched, which is what satisfies FR-018 structurally (research.md §3)
  (depends on T012).
- [ ] T014 [US1] Manually run quickstart.md §1 against a production build
  (`npm run build && npm run preview`) and record the result.

**Checkpoint**: User Story 1 is fully functional and independently
testable — the MVP slice that fixes the Principle II risk.

---

## Phase 4: User Story 2 - See where your data actually lives (Priority: P2)

**Goal**: Settings states the active storage adapter and, for File System
Access, the chosen folder and a way to recover a lost permission
(spec.md FR-006-009/FR-017). **Independent of Phase 2/US1** — can be done
in parallel by a different contributor.

**Independent Test**: on a device using each adapter, open Settings and
confirm the storage section states the mechanism/folder correctly,
including the "no folder chosen yet" and "needs reconfirmation" states
(spec.md User Story 2 Independent Test; Acceptance Scenarios 1-4).

### Tests for User Story 2

- [ ] T015 [P] [US2] Extend `test/contract/storage-adapter-contract.ts`
  with `getStorageStatus`/`reconfirmFileSystemAccess` cases, run against
  all three adapters: never throws on lost permission; a fresh
  `FileSystemStorageAdapter` with no prior write returns `folderName:
  undefined`; after any write, returns the real folder name and
  `permission: 'granted'`; `reconfirmFileSystemAccess()` on
  IndexedDB/in-memory resolves with no error (contracts/
  storage-port-additions.md "Contract test additions").
- [ ] T016 [P] [US2] Unit test `storage-status-store.ts` in
  `test/unit/application/storage-status-store.test.ts`
  (`configure`/`load`/`reconfirm`, mirrors `settings-store.test.ts`'s own
  shape if one exists).
- [ ] T017 [P] [US2] Component test `storage-status-section.tsx` in
  `test/unit/presentation/settings/storage-status-section.test.tsx`: all
  four states (IndexedDB / folder chosen / no folder yet / needs
  reconfirmation) and all six interaction states on the reconnect button
  (`docs/design.md` §5).

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create `src/application/ports/storage-status.ts`:
  the `StorageStatus` discriminated union exactly as specified in
  data-model.md (`{ kind: 'indexed-db' }` |
  `{ kind: 'file-system'; folderName: string | undefined; permission:
  'granted' | 'needs-reconfirmation' }`).
- [ ] T019 [US2] Add `getStorageStatus(): Promise<StorageStatus>` and
  `reconfirmFileSystemAccess(): Promise<void>` to the `StoragePort`
  interface in `src/application/ports/storage-port.ts`, with the doc
  comments from contracts/storage-port-additions.md (depends on T018).
- [ ] T020 [P] [US2] Implement both methods for real in
  `src/infrastructure/file-system-storage-adapter.ts`: `getStorageStatus()`
  resolves the handle without forcing a picker, reports `folderName:
  handle?.name`, and reports `permission: 'needs-reconfirmation'` (never
  throws) when `queryPermission` isn't `'granted'`;
  `reconfirmFileSystemAccess()` calls the cached handle's
  `requestPermission({ mode: 'readwrite' })` and throws the existing
  `StorageError('permission-lost')` if still refused (depends on T019).
- [ ] T021 [P] [US2] Implement both methods in
  `src/infrastructure/indexed-db-storage-adapter.ts`: `getStorageStatus()`
  returns `{ kind: 'indexed-db' }`; `reconfirmFileSystemAccess()` is a
  no-op `Promise.resolve()` (depends on T019).
- [ ] T022 [P] [US2] Implement both methods identically to T021 in
  `src/infrastructure/in-memory-storage-adapter.ts` (depends on T019).
- [ ] T023 [US2] Create `src/application/storage-status-store.ts`:
  Zustand, `configure(storage)`/`load()`/`reconfirm()`, mirroring
  `settings-store.ts`'s shape (depends on T019).
- [ ] T024 [US2] Create `src/presentation/settings/storage-status-section.tsx`
  per contracts/screen-contracts.md's four-state copy (depends on T023).
- [ ] T025 [US2] Edit `src/presentation/settings/settings-screen.tsx`: add
  `<StorageStatusSection/>` alongside the existing five sections (depends
  on T024).
- [ ] T026 [US2] Edit `src/presentation/main.tsx`: call
  `useStorageStatusStore.getState().configure(storage)` in `mount()`
  (depends on T023).
- [ ] T027 [US2] Manually run quickstart.md §2 (both adapters + the
  permission-loss/reconfirm flow) and record the result.

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Be invited to install, not left guessing (Priority: P3)

**Goal**: an install offer, native on Chromium and instructional on iOS
Safari, that never reappears once installed or permanently dismissed
(spec.md FR-010-018).

**Independent Test**: open the app in a plain browser tab on a platform
that supports installation, confirm the offer appears; dismiss it
permanently, reopen, confirm it doesn't reappear; open an installed copy
and confirm it's never shown there (spec.md User Story 3 Independent
Test).

### Tests for User Story 3

- [ ] T028 [US3] Extend
  `test/unit/application/pwa-lifecycle-store.test.ts` (from T008) with
  install-offer cases: `triggerInstallOfferKind('native'|'manual'|
  'unavailable')`, `dismissInstallOfferPermanently()` persists via the
  fake, `dismissForThisVisit` resets on a fresh store instance (depends
  on T008 — same file).
- [ ] T029 [P] [US3] Component test `install-offer.tsx` in
  `test/unit/presentation/pwa/install-offer.test.tsx`: renders nothing
  when standalone/unavailable/dismissed; native vs. manual copy; all six
  interaction states on every control (`docs/design.md` §5).

### Implementation for User Story 3

- [ ] T030 [US3] Extend `src/infrastructure/pwa-lifecycle-adapter.ts` (from
  T005) with the install-offer half: `beforeinstallprompt`/`appinstalled`
  window listeners; `installOfferKind()` feature-detection (`'native'` if
  a `beforeinstallprompt` event was captured, `'manual'` if `'standalone'
  in navigator`, else `'unavailable'` — research.md §4); `isStandalone()`
  via `matchMedia('(display-mode: standalone)')`/`navigator.standalone`;
  `promptNativeInstall()` calling the cached event's `.prompt()`/awaiting
  `.userChoice`; `isInstallOfferDismissed()`/
  `dismissInstallOfferPermanently()` backed by a single `localStorage` key
  (`gym-log:install-offer-dismissed`) — deliberately never routed through
  `StoragePort` (FR-016, data-model.md) (depends on T005).
- [ ] T031 [US3] Create `src/presentation/pwa/install-offer.tsx` per
  contracts/screen-contracts.md: native/manual/unavailable branches, "Don't
  show again" (permanent) and an implicit "not now" (visit-only) control
  (depends on T030, T004).
- [ ] T032 [US3] Edit `src/presentation/app-shell.tsx` (from T013): render
  `<InstallOffer/>` inside `AppShell` only, alongside `<UpdateNotice/>`
  (depends on T013, T031).
- [ ] T033 [US3] Manually run quickstart.md §3 — Chromium native install +
  permanent dismiss, and iOS Safari's manual instructions on a real device
  or Safari Technology Preview (research.md §6) — and record the result.

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Create `test/e2e/pwa-lifecycle.contract.spec.ts`
  (Playwright, Chromium project only): drives a real service-worker
  update across a two-build deploy and a synthetic `beforeinstallprompt`
  via Chrome DevTools Protocol (research.md §6).
- [ ] T035 Manually run quickstart.md §4 (no update notice for the version
  already current at launch, FR-005) and record the result.
- [ ] T036 Run `npm run typecheck && npm run lint && npm test` (and the
  Playwright suite) and fix anything red before opening the PR.
- [ ] T037 Update `specs/009-pwa-installability-and-updates/spec.md`'s
  **Status** line to `Implemented — merged to main via PR #<N>` once this
  feature's PR merges (`sdd-workflow` skill's status table).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Phase 1 (T001) — blocks US1 and
  US3 only. **US2 does not depend on Phase 2** and may start immediately
  after Phase 1.
- **User Story 1 (Phase 3)**: depends on Phase 2.
- **User Story 2 (Phase 4)**: depends only on Phase 1 (T001 is irrelevant
  to US2, but kept in Setup since it's a one-line, whole-feature config
  change) — independently startable in parallel with Phase 2/3.
- **User Story 3 (Phase 5)**: depends on Phase 2 (T004, T005) — extends
  files T005/T013 already created, so in practice follows Phase 3 unless
  a second contributor coordinates on those files directly.
- **Polish (Phase 6)**: depends on all three user stories being complete.

### Parallel Opportunities

- T002/T003 (Phase 2) in parallel.
- T007/T008/T009 (US1 tests) in parallel; T010 in parallel with those.
- T015/T016/T017 (US2 tests) in parallel; T018 in parallel with those;
  T020/T021/T022 (the three adapters) in parallel once T019 lands.
- T029 (US3 component test) in parallel with T028.
- Once Phase 1 completes, **US2 (Phase 4) can run entirely in parallel
  with Phase 2 + US1 (Phase 3) + US3 (Phase 5)** by a second contributor —
  it shares no file with either.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001).
2. Phase 2 (T002-T006) — the shared `PwaLifecyclePort` substrate.
3. Phase 3 (T007-T014) — the update notice that fixes the Principle II
   risk that motivated this whole spec.
4. **STOP and validate** against quickstart.md §1 before continuing —
   this alone already closes the highest-severity gap (spec.md's own
   priority ordering).

### Incremental Delivery

1. Setup + Foundational → US1 (MVP, fixes the silent-reload risk).
2. Add US2 (storage visibility) — independently valuable, no dependency
   on US1/Foundational.
3. Add US3 (install offer) — extends the Foundational adapter/shell edits
   US1 already touched.
4. Polish (Phase 6) once all three are in.

## Notes

- [P] tasks touch different files with no incomplete-task dependency.
- Every test task is written to fail before its corresponding
  implementation task lands (Vitest/Playwright, per plan.md's Testing
  section) — this project does not gate merges on strict TDD ordering,
  but tests and implementation land in the same PR either way.
- No task in this file adds, changes, or migrates a canonical entity
  (`docs/requirements.md` §3.1) — confirmed by `schema-guardian` at the
  spec stage (spec.md checklist).
