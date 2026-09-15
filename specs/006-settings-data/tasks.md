---

description: "Task list for specs/006-settings-data (Settings, Export and Import)"
---

# Tasks: Settings, Export and Import

**Input**: Design documents from `/specs/006-settings-data/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the constitution's Definition of Done requires a
test for every new behavior (`docs/testing.md`).

**Organization**: Grouped by user story (spec.md priorities: US1/US2 = P1,
US3 = P2, US4 = P3, US5 = P4), after one Foundational phase for the pieces
every story needs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task in this list.
- **[Story]**: US1 (Export), US2 (Import), US3 (Settings adjustments), US4
  (Band-label management), US5 (Delete everything). Foundational/Polish
  tasks carry no story label.

---

## Phase 1: Setup

No new npm dependency for this feature (plan.md Technical Context — JSON/CSV
are hand-rolled, File System Access's save/open pickers are native,
feature-detected the same way `select-adapter.ts` already does). Nothing to
install.

- [x] T001 Confirm `npm run typecheck`, `npm run lint`, `npm test` are
      green on `claude/next-implementation-steps-h28ebx` before starting
      (baseline, so any later red run is attributable to this feature).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Every user story below depends on this phase.**

- [x] T002 [P] Add `Settings` type + `withSettingsDefaults()` in
      `src/application/ports/settings.ts` (data-model.md): fields
      `defaultUnit: 'kg' | 'lb'`, `quickIncrements: { durationSeconds:
      number; distanceMetres: number }`, `theme: 'light' | 'dark' |
      'system'`, `firstDayOfWeek: 'monday' | 'sunday'`; defaults exactly
      `{ defaultUnit: 'kg', quickIncrements: { durationSeconds: 5,
      distanceMetres: 5 }, theme: 'system', firstDayOfWeek: 'monday' }`
      (research.md §7).
- [x] T003 [P] Add `src/application/ports/file-exchange-port.ts`
      (`FileExchangePort` — `saveFile`/`pickFile`, contracts/file-exchange-port.md).
- [x] T004 Extend `src/application/ports/storage-port.ts`
      (contracts/storage-port-additions.md): `getSettings(): Promise<Settings
      | undefined>`, `saveSettings(settings: Settings): Promise<void>`,
      `importBulk(input: BulkImportInput): Promise<void>` (`BulkImportInput`
      as specified — `sessions`, `exercises` required arrays to upsert by
      id; `bandLabels?`, `settings?`, `loggingDraft?` optional — present
      means replace, absent means leave untouched; `schemaVersion: number`
      required), `resetToFreshInstall(seedExercises: Exercise[]):
      Promise<void>`. Depends on T002.
- [x] T005 [P] Extract `src/application/schema-migration.ts`
      (`migrateExerciseCatalogue(exercises: Exercise[], storedVersion:
      number): Exercise[]`, re-exporting `decideSchemaAction` from
      `src/infrastructure/schema-version.ts`) from the logic currently
      duplicated as `IndexedDbStorageAdapter#migrateExerciseTemplateDefaults`
      and `FileSystemStorageAdapter`'s `withTemplateDefaults` (research.md
      §3) — same v1→v2 backfill (`defaultVolumeKind ?? 'reps'`,
      `trackEffort ?? false`), behavior unchanged.
- [x] T006 [P] Add `src/application/catalogue/seed-exercises.ts`:
      `buildSeedCatalogue(): Exercise[]` returning twelve common strength
      exercises (fresh `crypto.randomUUID()` ids per call, `discipline:
      'Strength'`) covering squat, hinge, horizontal push, horizontal pull,
      vertical push, vertical pull, lunge, and core movement patterns
      (research.md §1).
- [x] T007 [US*] [P] Wire first-launch seeding into
      `src/presentation/main.tsx`'s `mount()`: after
      `useStorageAccess.getState().configure(storage)`, if
      `storage.listExercises()` is empty, save every `buildSeedCatalogue()`
      entry (D9/ADR-0005 gap closure, research.md §1 — first-run only, no
      later-launch re-seed). Depends on T006.
- [x] T008 [P] Add `src/infrastructure/file-exchange-adapter.ts`
      (`FileExchangePort` impl: `showSaveFilePicker`/`showOpenFilePicker`
      where `'showSaveFilePicker' in window`, else `<a download>` /
      `<input type="file">` fallback — contracts/file-exchange-port.md).
      Depends on T003.
- [x] T009 [P] Add `src/infrastructure/in-memory-file-exchange-adapter.ts`
      (test-only fake: `saveFile` records calls, `pickFile` returns a
      pre-set response via `setNextPick()`) and re-export it from
      `test/support/index.ts` alongside `InMemoryStorage`. Depends on T003.
- [x] T010 Add a `settings` table to `src/infrastructure/indexed-db/schema.ts`
      (single row keyed `'current'`, mirroring the existing `bandLabels`/
      `draft` tables). Depends on T004.
- [x] T011 Add `SETTINGS_FILE = 'settings.json'` and
      `PENDING_BULK_WRITE_FILE = '_pending-bulk-write.json'` constants to
      `src/infrastructure/file-system/layout.ts`. Depends on T004.
- [x] T012 [P] Implement `getSettings`/`saveSettings`/`importBulk`/
      `resetToFreshInstall` on `src/infrastructure/in-memory-storage-adapter.ts`
      (trivially atomic — synchronous `Map` mutations, no `await` between
      them, research.md §2). Depends on T004, T005.
- [x] T013 Implement `getSettings`/`saveSettings` on
      `src/infrastructure/indexed-db-storage-adapter.ts` (new `settings`
      table) and `importBulk`/`resetToFreshInstall` via
      `this.#db.transaction('rw', [sessions, exercises, draft, bandLabels,
      settings, meta], async () => {...})` (research.md §2, same pattern as
      the existing `mergeExercises`/`deleteExerciseCascade`); replace its
      own migration logic with `schema-migration.ts` (T005). Depends on
      T004, T005, T010.
- [x] T014 Implement `getSettings`/`saveSettings` on
      `src/infrastructure/file-system-storage-adapter.ts` (new
      `settings.json`) and `importBulk`/`resetToFreshInstall` via the
      write-ahead journal (`_pending-bulk-write.json`, research.md §2:
      write the whole payload as one atomic file, apply each target file
      sequentially, delete the journal last; `#checkSchema()` replays a
      leftover journal found on the next instantiation); replace its own
      migration logic with `schema-migration.ts` (T005). Depends on T004,
      T005, T011.
- [x] T015 Extend `test/contract/storage-adapter-contract.ts` with the
      eight cases in contracts/storage-port-additions.md ("Contract
      tests"), run against all three adapters. Depends on T012, T013, T014.
- [x] T016 [P] Add `src/presentation/settings/settings-screen.tsx` (empty
      section placeholders + a `DataSection` host — contracts/
      screen-contracts.md), route it at `/settings` in
      `src/presentation/main.tsx` under `<Route element={<AppShell />}>`,
      and add a "Settings" entry to `DESTINATIONS` in
      `src/presentation/nav/header-nav.tsx`.

**Checkpoint**: `npm run typecheck && npm run lint && npm test` green;
`/settings` reachable and renders an (empty) shell; every adapter passes
the new contract-test cases.

---

## Phase 3: User Story 1 — Export all data (Priority: P1) 🎯 MVP

**Goal**: Settings → Data → Export produces one readable, versioned JSON
file with every record kind, plus a separate CSV for spreadsheets.

**Independent Test** (spec.md): on a device with sessions, a customized
catalogue, band labels, settings and a pending draft, trigger export and
confirm the file is a single, self-contained, versioned, human-readable
record of all of it — independent of whether import exists yet.

### Tests for User Story 1

- [x] T017 [P] [US1] Unit tests for `buildExportFile()` in
      `test/unit/application/data-transfer/export-file.test.ts`: every
      record kind included with correct presence semantics (data-model.md:
      `bandLabels`/`settings`/`loggingDraft` each omitted when absent
      locally, `sessions`/`exerciseCatalogue` always arrays, each
      `ExerciseEntry` gains `exerciseName`), `format`/`schemaVersion`/
      `exportedAt` always present, no device-identifying field anywhere
      (FR-023 spot-check).
- [x] T018 [P] [US1] Unit tests for `buildTabularExport()` in
      `test/unit/application/data-transfer/tabular-export.test.ts`: one row
      per `Set`, RFC 4180 quoting for values containing commas/quotes/
      newlines, header row present.

### Implementation for User Story 1

- [x] T019 [US1] Implement `buildExportFile(local): ExportFile` in
      `src/application/data-transfer/export-file.ts` per data-model.md
      (pure function of already-read `StoragePort` results — no I/O
      inside it).
- [x] T020 [US1] Implement `buildTabularExport(sessions, exercises):
      string` in `src/application/data-transfer/tabular-export.ts`
      (research.md §5 column list).
- [x] T021 [US1] Add `src/presentation/settings/data-section.tsx` and
      `src/presentation/settings/export-controls.tsx` (contracts/
      screen-contracts.md: two buttons, each reads via `requireStorage()`,
      builds the file, calls `fileExchange.saveFile(...)`); wire
      `DataSection` into `settings-screen.tsx`.
- [x] T022 [US1] Component test in
      `test/unit/presentation/settings/settings-screen.test.tsx` (or a
      dedicated `data-section.test.tsx`) asserting both export buttons call
      `fileExchange.saveFile` with the expected filename/mime type, via the
      in-memory `FileExchangePort` fake (T009).

**Checkpoint**: export works end-to-end against `InMemoryStorage`,
independent of import/settings/band-labels/delete-everything.

---

## Phase 4: User Story 2 — Import a previously exported file (Priority: P1)

**Goal**: Settings → Data → Import picks a file, shows an accurate
add/replace preview per record kind, and applies nothing until confirmed.

**Independent Test** (spec.md): a file produced by US1, imported into a
second, independent installation, matches the source after confirming the
preview.

### Tests for User Story 2

- [x] T023 [P] [US2] Unit tests for `computeImportPreview()` in
      `test/unit/application/data-transfer/import-preview.test.ts`: add vs.
      replace counts by id for sessions/exercises; presence/replace
      reporting for bandLabels/settings/loggingDraft (data-model.md); a
      file re-imported into the same device shows zero adds, all replaces
      (SC-005).
- [x] T024 [P] [US2] Unit tests for parse/validation in
      `test/unit/application/data-transfer/import-validation.test.ts`:
      rejects a file missing `format: 'gym-log-export'`; rejects
      unparseable JSON; rejects a `schemaVersion` newer than
      `CURRENT_SCHEMA_VERSION` (FR-013) with nothing written; rejects a
      structurally invalid but same-version file (FR-014) — every
      rejection path returns a result, never throws past the caller.
- [x] T025 [P] [US2] Unit tests for `applyImport()` orchestration in
      `test/unit/application/data-transfer/apply-import.test.ts`: an older
      `schemaVersion` file is migrated in memory via
      `schema-migration.ts` before the preview is computed (FR-012);
      cancelling after preview calls no `StoragePort` write method at all
      (no trace, spec.md FR-012).
- [x] T026 [US2] Integration test
      `test/integration/data-transfer-flow.test.ts` using `createHarness()`:
      export from one `InMemoryStorage`, import into a second, assert
      sessions/exercises/bandLabels/settings/draft all match (SC-001), and
      that importing the same file twice in a row is idempotent (SC-005).

### Implementation for User Story 2

- [x] T027 [US2] Implement `parseAndValidateExportFile(content: string):
      { ok: true; file: ExportFile } | { ok: false; message: string }` in
      `src/application/data-transfer/import-validation.ts` (FR-013/014).
- [x] T028 [US2] Implement `computeImportPreview(local, file):
      ImportPreview` in `src/application/data-transfer/import-preview.ts`
      per data-model.md (pure — no `StoragePort` call inside it).
- [x] T029 [US2] Implement `applyImport()` in
      `src/application/data-transfer/apply-import.ts`: validate → migrate
      via `schema-migration.ts` if `file.schemaVersion < CURRENT_SCHEMA_VERSION`
      → read local state → `computeImportPreview` → (caller decides
      confirm/cancel) → on confirm, `storage.importBulk(...)` with
      `schemaVersion: CURRENT_SCHEMA_VERSION`.
- [x] T030 [US2] Add `src/presentation/settings/import-flow.tsx`
      (contracts/screen-contracts.md steps 1-6: pick → validate → preview →
      confirm/cancel → `importBulk`); wire into `data-section.tsx`.
- [x] T031 [US2] Component test
      `test/unit/presentation/settings/import-flow.test.tsx`: rejection
      message shown and no preview for an invalid file; preview counts
      rendered for a valid file; Cancel calls no storage write; Confirm
      calls `storage.importBulk` exactly once.

**Checkpoint**: US1 + US2 together give the full "move data between
devices" value (spec.md — both P1 for this reason). Run
quickstart.md §2 and §4 manually.

---

## Phase 5: User Story 3 — Adjust personal settings (Priority: P2)

**Goal**: unit, quick increments, theme, and first-day-of-week each apply
immediately and persist; first-day-of-week drives the Insights consistency
card (FR-018).

**Independent Test** (spec.md): change each setting in isolation, restart,
confirm each persisted and is visibly in effect where it renders.

### Tests for User Story 3

- [x] T032 [P] [US3] Unit tests for `withSettingsDefaults()` in
      `test/unit/application/settings.test.ts`: an empty/partial stored
      record is filled to the documented defaults (T002); a fully-populated
      record passes through unchanged.
- [x] T033 [P] [US3] Unit tests for `computeConsistency(sessions,
      firstDayOfWeek, asOf)` in
      `test/unit/application/insights/consistency.test.ts` (extends the
      existing file): a `'sunday'` first-day-of-week buckets weeks
      starting Sunday, not Monday, for the same fixture data the existing
      Monday-start tests already use — confirm the trained/total week
      counts change accordingly for a session that falls on a Sunday.

### Implementation for User Story 3

- [x] T034 [US3] Add `src/application/settings-store.ts` (Zustand,
      `configure(storage)` pattern per `logging-store.ts`): holds
      `settings: Settings` (always defaulted via `withSettingsDefaults`
      over the port's raw, possibly-`undefined` `getSettings()`), exposes
      `updateSettings(patch: Partial<Settings>)` that merges, calls
      `storage.saveSettings(next)`, and updates state optimistically
      (FR-002 — no Save button).
- [x] T035 [P] [US3] Add `src/presentation/settings/unit-and-increments-section.tsx`
      (`defaultUnit`, `quickIncrements`).
- [x] T036 [P] [US3] Add `src/presentation/settings/theme-section.tsx`
      (`theme`); on change, set `document.documentElement.dataset.theme`
      directly (`'system'` re-enables following the OS preference).
- [x] T037 [P] [US3] Add `src/presentation/settings/first-day-of-week-section.tsx`
      (`firstDayOfWeek`).
- [x] T038 [US3] Edit `src/presentation/main.tsx`'s
      `applyThemeFromSystemPreference()` listener to no-op once an explicit
      `theme` choice exists (read via `useSettingsStore` at mount — the
      doc comment already anticipates this exact change, plan.md Scope).
- [x] T039 [US3] Edit `src/application/insights/consistency.ts`:
      `computeConsistency(sessions: Session[], firstDayOfWeek:
      'monday' | 'sunday', asOf: Date = new Date())`, replacing the
      hardcoded Monday-only `isoWeekStart` with a
      `weekStart(date, firstDayOfWeek)` that branches on the new
      parameter (FR-018).
- [x] T040 [US3] Edit `src/application/insights/build-insights.ts` and
      `src/presentation/insights/insights-screen.tsx`: read
      `useSettingsStore`'s `firstDayOfWeek` and thread it into
      `buildInsights`/`computeConsistency`.
- [x] T041 [US3] Wire the three new sections into `settings-screen.tsx`;
      component tests for each section (immediate apply, persisted value
      shown on remount) in `test/unit/presentation/settings/`.

**Checkpoint**: run quickstart.md §1 manually; all three settings sections
independently testable.

---

## Phase 6: User Story 4 — Manage band labels from Settings (Priority: P3)

**Goal**: add/rename/reorder/remove band labels from Settings, reusing the
existing `listBandLabels`/`saveBandLabels` (no new port method).

**Independent Test** (spec.md): from Settings alone, add/rename/reorder/
remove a label; confirm it's reflected next time labels are offered while
logging.

### Tests for User Story 4

- [x] T042 [US4] Component test
      `test/unit/presentation/settings/band-labels-section.test.tsx`:
      reorder/rename/add/remove each call `storage.saveBandLabels` with the
      expected next list; a renamed/removed label already used on a logged
      set is unaffected (read via a `Session` fixture, confirming spec.md
      FR-005 — this feature never rewrites `Set.load` history).

### Implementation for User Story 4

- [x] T043 [US4] Add `src/presentation/settings/band-labels-section.tsx`
      (contracts/screen-contracts.md) and wire it into
      `settings-screen.tsx`.

**Checkpoint**: run quickstart.md's band-label steps (folded into §1)
manually against the logging screen's existing band picker.

---

## Phase 7: User Story 5 — Delete everything (Priority: P4)

**Goal**: two-step confirmation, then an atomic reset to exactly the seed
catalogue and default settings.

**Independent Test** (spec.md): with existing data, confirm twice, then
confirm every session/custom entry/band label/setting/draft is gone, the
catalogue is back to the seed set, and the app behaves like a fresh
install.

### Tests for User Story 5

- [x] T044 [US5] Component test
      `test/unit/presentation/settings/delete-everything-flow.test.tsx`:
      backing out of either confirmation calls no storage method; both
      confirmations call `storage.resetToFreshInstall(buildSeedCatalogue())`
      exactly once.

### Implementation for User Story 5

- [x] T045 [US5] Add `src/presentation/settings/delete-everything-flow.tsx`
      (contracts/screen-contracts.md: two sequential confirmations, second
      states irreversibility) and wire it into `data-section.tsx`.

**Checkpoint**: run quickstart.md §5 manually.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T046 [P] Accessibility pass (`docs/requirements.md` §7.4,
      `docs/testing.md`'s six interactive-element states) over every new
      component from T016–T045: focus-visible, keyboard reachability,
      disabled-with-reason, loading state on export/import/delete actions,
      no color-only state. Record as SC-006's "zero unresolved critical
      findings" check.
- [x] T047 [P] Playwright: extend `test/e2e/shell-smoke.spec.ts` with a
      `/settings` route-reachability check (spec 004/005 precedent).
- [x] T048 Performance measurement (FR-020): run quickstart.md §6 against a
      representative data set (100 sessions × 4 blocks × 3 exercises × 3
      sets) for export/import/delete-everything on both adapters; append
      the recorded numbers to quickstart.md's "Validation log".
- [x] T049 SC-008 manual AI-readability check: run quickstart.md §3, append
      the outcome to quickstart.md's "Validation log".
- [x] T050 Run `npm run typecheck && npm run lint && npm test` and the full
      `quickstart.md` script end to end; fix anything red.
- [ ] T051 Update `specs/006-settings-data/spec.md`'s `**Status**` line to
      `Implemented — merged to main via PR #<n>` once the PR is open
      (`commit-and-pr-conventions`, `sdd-workflow`).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002-T016)**, blocking every story.
- **US1 (T017-T022)** and **US2 (T023-T031)** both depend only on
  Foundational; US2's `apply-import.ts` (T029) calls `storage.importBulk`
  (Foundational T004/T012-14) and `schema-migration.ts` (T005) — it does
  **not** depend on US1's code, only on the same `ExportFile` shape US1
  also builds against (data-model.md), so the two can proceed in parallel
  if staffed, though US2's integration test (T026) is easiest to write
  once T019 (`buildExportFile`) exists.
- **US3 (T032-T041)**, **US4 (T042-T043)**, **US5 (T044-T045)** each depend
  only on Foundational (T002-T016) — none depends on US1 or US2. US5's
  `resetToFreshInstall` call needs `buildSeedCatalogue()` (Foundational
  T006), already built.
- **Polish (T046-T051)** depends on every story phase in scope being done.

### Parallel opportunities

- T002, T003, T005, T006 (Foundational): different files, no
  interdependency — parallelizable.
- T008, T009 (FileExchangePort adapter + fake): parallelizable with each
  other and with T010/T011 (layout constants).
- T012 (in-memory adapter) is parallelizable with T013/T014 once T004/T005
  land, since the three adapters are different files implementing the same
  interface independently.
- Once Foundational is done: US1, US3, US4, US5 can all proceed in
  parallel (different files); US2 can start in parallel too but benefits
  from US1's `export-file.ts` existing first for its integration test.

## Implementation Strategy

**MVP = US1 + US2** (both P1, spec.md: "neither delivers the underlying
value alone") — export/import is the concrete migration/backup capability
FR-11/FR-12 exist for. US3/US4/US5 are real, independently shippable
increments on top, in priority order, matching spec.md's own P2/P3/P4.
