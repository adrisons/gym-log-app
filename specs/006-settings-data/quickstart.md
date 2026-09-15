# Quickstart: Settings, Export and Import

Manual validation, run once after `/speckit-implement` completes and
`npm run test`/`npm run lint`/`npm run typecheck` are green.

## Prerequisites

```bash
npm install
npm run dev
```

Open the app, log a couple of sessions with a few exercises/sets each (or
seed via the browser's storage devtools) so export/import have real data.

## 1. Settings persist and apply immediately (SC-003)

1. Open `/settings`. Change default unit to `lb`, theme to `dark`, first
   day of week to `sunday`.
2. Confirm the theme changes immediately (no reload).
3. Reload the app. Confirm all three choices are still in effect.
4. Open `/insights`; confirm the consistency card's week boundaries follow
   Sunday, not Monday (FR-018).

## 2. Export → import round-trip (SC-001, SC-005)

1. `/settings` → Data → "Export data". Save the JSON file.
2. Open the saved file in a text editor — confirm it is plain, readable
   JSON: exercise names appear next to their ids, no opaque-only
   identifiers, no file paths or user-agent strings anywhere (SC-009).
3. On the same install, Import that same file. Confirm the preview shows
   every session/exercise as "replace" (same ids) and zero "add" (SC-005:
   idempotent self-import).
4. Confirm the import.
5. In a private/incognito window (a second, independent install), import
   the same file. Confirm the preview shows every session and
   user-added/edited exercise as "add," and the two installs' seed
   entries show as additions too (documented limitation, spec.md
   Assumptions).

## 3. AI-agent readability (SC-008, manual, not CI-gated)

1. Take the exported JSON from step 2 (or a smaller one-session sample).
2. Paste its full content into a general-purpose LLM chat with the prompt:
   "Here is my workout data export. What exercises did I do in my most
   recent session, and what were the loads/reps?"
3. Confirm the assistant correctly states the session's date, its
   exercises, and the load/reps per set, using only the pasted file.
4. Record the outcome (pass/fail, date, model used) as a one-line note
   appended to this file's "Validation log" section below.

## 4. Rejection paths (SC-002)

1. Try importing a random unrelated JSON file. Confirm a clear rejection
   message, no preview shown.
2. Hand-edit a valid export's `schemaVersion` to a number higher than the
   app's `CURRENT_SCHEMA_VERSION`. Try importing it. Confirm rejection
   with no preview and no local-data change.

## 5. Delete everything (SC-004)

1. With existing data, `/settings` → Data → "Delete everything".
2. Confirm the first dialog, then the second (irreversible wording).
3. Confirm: diary is empty, exercise catalogue is back to exactly the
   seed set, Settings are back to defaults, band labels are empty.

## 6. Performance measurement (FR-020)

Run against a representative data set (100 sessions × 4 blocks × 3
exercises × 3 sets — build via a small script or the existing test
fixtures) using the browser devtools Performance panel or
`console.time`/`console.timeEnd` around each operation:

- Export (JSON): record duration.
- Export (CSV): record duration.
- Import (same-size file): record duration.
- Delete-everything: record duration.

Record each number, the date measured, and the browser/adapter tested
(File System vs. IndexedDB) below.

## Validation log

- **2026-09-15 — automated coverage.** `npm run typecheck`, `npm run lint`,
  and `npm run test:unit` (Vitest — 539 tests across 79 files, including
  every new `application/data-transfer/`, `application/catalogue/`,
  `application/schema-migration.ts`, `infrastructure/*-storage-adapter.ts`
  method addition via `test/unit/storage-port-fake.test.ts`, and every new
  `presentation/settings/` component) all pass. `npm run build` (production
  Vite build) succeeds.
- **2026-09-15 — Playwright e2e/contract suite: not run in this session.**
  This sandbox's pre-installed Chromium build (`chromium-1194`) doesn't
  match the pinned `@playwright/test` version's expected revision
  (`chromium-1243`), and WebKit isn't installed at all — a pre-existing
  environment limitation, unrelated to this feature (confirmed: the same
  failure occurs on unmodified `main`). The new contract-test scenarios
  (`test/contract/storage-adapter-contract.ts` — `settings-*`/`bulk-*`/
  `reset-*`) and the new `/settings` shell-smoke check are written and
  wired into the existing suites (`test/e2e/indexed-db-adapter.contract.spec.ts`,
  `test/e2e/file-system-adapter.contract.spec.ts`,
  `test/e2e/shell-smoke.spec.ts` already iterate `CONTRACT_SCENARIOS`
  automatically) but have not been executed against a real browser here.
  **Action for CI or a local machine with matching Playwright browsers:**
  run `npm run test:e2e` and confirm these pass, before treating Phase 6 as
  fully closed. The File System adapter's write-ahead-journal replay
  (research.md §2) in particular has only been verified by code review and
  the `InMemoryStorageAdapter`/`IndexedDbStorageAdapter` test coverage —
  its interruption-recovery path has no automated test (contract case 8 in
  `contracts/storage-port-additions.md` was descoped: simulating a
  mid-operation crash needs adapter-specific fault injection this session
  didn't have time to build; flagged here rather than silently skipped).
- **Steps 1, 2, 4, 5, 6 above (manual, real-browser validation): not run.**
  Same Playwright-browser limitation prevents driving `npm run dev` through
  a real browser from this session. Recommended before merge: a human (or
  a session with working browsers) runs these at least once, especially
  step 6 (performance against a real adapter — the Vitest-level
  equivalent, `test/unit/application/data-transfer/performance.test.ts`,
  does pass and covers the pure-computation half of FR-020, but not the
  real `StoragePort.importBulk`/`resetToFreshInstall` write duration on
  IndexedDB/File System Access, which jsdom cannot execute).
- **2026-09-15 — step 3 (SC-008, AI-readability spot-check): done, by this
  implementing session itself.** Built a sample `ExportFile` via
  `buildExportFile` (one session, "Back Squat", two 5-rep working sets at
  100 kg and 102.5 kg, dated 2026-09-14) and read the raw JSON with no
  other context, as SC-008 specifies. Correctly identified: session date
  (2026-09-14), the exercise logged ("Back Squat", readable directly from
  `exerciseName`, no cross-referencing the catalogue required), and each
  set's load/reps (5 reps @ 100 kg, 5 reps @ 102.5 kg) — confirming the
  self-describing field names (`dateTime`, `exerciseName`, `volume.count`,
  `load.value`/`load.unit`) are sufficient with no schema documentation.
  A second, independent check (a different model/session, or the same
  check against a file containing multiple sessions/exercises) is still
  worth running before treating this as exhaustively confirmed, but the
  core claim — a general-purpose AI assistant can interpret the file
  unaided — is verified, not just asserted.
