---

description: "Task list for storage size display and old-data retention cleanup"
---

# Tasks: Storage Size Display and Old-Data Retention Cleanup

**Input**: Design documents from `/specs/010-storage-size-retention/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/storage-port-additions.md, quickstart.md

**Tests**: Required — constitution's Development Workflow: "every new
behaviour has at least one test." Written before the implementation they
cover, per each task's ordering below.

**Organization**: Tasks are grouped by user story (both Priority P1 in
spec.md, independently testable and independently shippable). Neither
story depends on the other — User Story 1 (size readout) needs no port
change at all; User Story 2 (delete old data) needs the new
`deleteSessionsBefore` port method but nothing from User Story 1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an
  incomplete task)
- **[Story]**: US1 or US2, mapping to spec.md's two user stories

## Phase 1: Setup

No new dependency, build tool, or project-structure change (`docs/stack.md`
unchanged per plan.md's Technical Context) — nothing to do here.

## Phase 2: Foundational

Neither story shares a blocking prerequisite the other needs first (US1
touches no port method; US2's new port method is entirely within US2's own
phase, used by nothing else). Skipped — proceed straight to the stories.

---

## Phase 3: User Story 1 - See how much space my data takes up (Priority: P1)

**Goal**: Settings → Data shows a whole-number KB/MB figure for the
device's stored data (FR-001-004).

**Independent Test**: seed storage with a known amount of data, open
Settings, confirm the displayed figure is the correct whole-number KB/MB
value (quickstart.md §1).

### Tests for User Story 1

- [ ] T001 [P] [US1] Unit tests for `computeStorageSizeLabel`'s
  unit-selection/rounding rules (research.md §2: exact-`kb`-before-rounding
  unit selection; the 1023.6 KB → "1 MB" promotion case from FR-002; the
  "≥1 byte never rounds to 0 KB" floor from FR-003) in
  `test/unit/application/settings/storage-size.test.ts`
- [ ] T002 [P] [US1] Component test for the size readout — renders a
  whole-number KB/MB string next to the existing storage-status line, with
  no decimal point ever present (FR-001) — in
  `test/unit/presentation/settings/storage-size-section.test.tsx`

### Implementation for User Story 1

- [ ] T003 [US1] Implement `computeStorageSizeLabel(storage: StoragePort): Promise<string>`
  in `src/application/settings/storage-size.ts`: reads
  `listSessions(allStoredDataRange())`, `listExercises()`, `getSettings()`
  (band labels — confirm during this task whether they're a `Settings`
  field or need their own read, per data-model.md), and `getDraft()`;
  builds one combined plain object from the results; measures
  `new TextEncoder().encode(JSON.stringify(thatObject)).length`; applies
  the unit-selection/rounding algorithm from research.md §2 (must make
  T001 pass). No `StoragePort` change.
- [ ] T004 [US1] Create `StorageSizeSection` in
  `src/presentation/settings/storage-size-section.tsx`: calls
  `computeStorageSizeLabel` on mount (mirrors
  `storage-status-section.tsx`'s own on-mount-read shape) and renders the
  resulting string (must make T002 pass).
- [ ] T005 [US1] Wire `StorageSizeSection` into
  `src/presentation/settings/data-section.tsx`, next to the existing
  `StorageStatusSection` (recomputed whenever this section is shown,
  FR-004 — same "re-read on mount" convention already used throughout
  this screen).

**Checkpoint**: User Story 1 is fully functional and independently
testable — quickstart.md §1.

---

## Phase 4: User Story 2 - Delete training history older than a cutoff (Priority: P1)

**Goal**: A "Delete old data" modal removes every Session dated before a
chosen cutoff — a quick option (1y/6m/3m) or an explicit date — leaving
everything else untouched (FR-005-012).

**Independent Test**: seed storage with sessions on both sides of a known
date, run the flow with that date as the cutoff, confirm only the earlier
sessions are gone afterward (quickstart.md §2-3).

### Tests for User Story 2

- [ ] T006 [P] [US2] Unit tests for `deleteSessionsBefore` against
  `InMemoryStorageAdapter` — contract scenarios 1-5 from
  `contracts/storage-port-additions.md` (removes strictly-before matches
  only, resolves to the exact removed count, zero-match is a valid `0`
  result, leaves the Exercise catalogue/band labels/Settings/draft
  untouched, keeps a same-day session) — in
  `test/unit/infrastructure/in-memory-storage-adapter.test.ts`
- [ ] T007 [P] [US2] Extend `test/e2e/indexed-db-adapter.contract.spec.ts`
  with the same contract scenarios 1-5, run against
  `IndexedDbStorageAdapter`, plus durability (survives a simulated
  restart, matching this file's existing durability-case pattern)
- [ ] T008 [P] [US2] Extend `test/e2e/file-system-adapter.contract.spec.ts`
  with the same contract scenarios 1-5 against `FileSystemStorageAdapter`,
  plus scenario 6 (a call interrupted after the journal write but before
  every matching file is removed resumes correctly on the next read/write,
  matching this file's existing `importBulk`/`resetToFreshInstall`
  interruption-case pattern)
- [ ] T009 [P] [US2] Unit tests for the quick-option cutoff helper —
  month/leap-day clamping per research.md §3 (e.g. 6 months before Aug 31
  clamps to the last valid day of February, not an overflow into March;
  1 year before a leap day clamps correctly) and the start-of-day zeroing
  (FR-009a) — in `test/unit/application/settings/retention-cutoff.test.ts`
- [ ] T010 [P] [US2] Component tests for the "Delete old data" modal in
  `test/unit/presentation/settings/delete-old-data-flow.test.tsx`:
  delete action disabled with no cutoff chosen (FR-008); each quick option
  selects a cutoff and shows a live count (FR-006, FR-007); an explicit
  date does the same; a zero-match count disables delete (Acceptance
  Scenario 2.3); an incomplete/invalid explicit date shows no stale count
  and keeps delete disabled (Edge Cases); confirming calls through with the
  chosen cutoff and shows a brief success confirmation naming the removed
  count (FR-011); cancelling leaves everything untouched and closes with no
  cutoff retained (Key Entities: Retention cutoff is not persisted); the
  modal's own text stays to just the cutoff chooser, count, confirm, and
  cancel (FR-012, a literal check of what's rendered).

### Implementation for User Story 2

- [ ] T011 [US2] Add `deleteSessionsBefore(cutoff: string): Promise<number>`
  to the `StoragePort` interface in
  `src/application/ports/storage-port.ts`, with the doc comment from
  `contracts/storage-port-additions.md` (start-of-day semantics, FR-009's
  untouched-record list, the all-or-nothing guarantee).
- [ ] T012 [P] [US2] Implement `deleteSessionsBefore` in
  `src/infrastructure/in-memory-storage-adapter.ts`: filter `#sessions` by
  `Date.parse(dateTime) < Date.parse(cutoff)` (parsed-instant comparison,
  matching this adapter's existing `listSessions` convention), delete the
  matches, return the removed count (depends on T011; must make T006 pass).
- [ ] T013 [P] [US2] Implement `deleteSessionsBefore` in
  `src/infrastructure/indexed-db-storage-adapter.ts`: a single Dexie
  `'rw'` transaction on the `sessions` table using a `dateTime`
  range-delete, returning Dexie's own deleted-row count (research.md §4;
  depends on T011; must make T007 pass).
- [ ] T014 [P] [US2] Implement `deleteSessionsBefore` in
  `src/infrastructure/file-system-storage-adapter.ts`: add a third
  `PendingBulkWrite` journal variant (`{ kind: 'delete-before', cutoff }`)
  alongside the existing `'import'`/`'reset'` kinds; write the journal,
  delete every matching session file, remove the journal, with the same
  replay-on-next-read/write handling `#replayPendingBulkWriteAtRoot`
  already gives the other two kinds (research.md §4; depends on T011;
  must make T008 pass).
- [ ] T015 [US2] Implement the quick-option cutoff helper in
  `src/application/settings/retention-cutoff.ts`: `cutoffMonthsAgo(from, months)`
  per research.md §3's clamping algorithm, plus a start-of-day normalizer
  for both quick options and an explicit date (FR-009a) (must make T009
  pass).
- [ ] T016 [US2] Create `DeleteOldDataFlow` in
  `src/presentation/settings/delete-old-data-flow.tsx`: the modal from
  research.md §5's inline `.block-card` dialog pattern (mirroring
  `delete-everything-flow.tsx`'s shape) — three quick-option controls plus
  an explicit-date field (FR-006), a live matching-session count via
  `listSessions` filtered client-side by the chosen cutoff (FR-007),
  delete disabled with no cutoff or a zero count (FR-008), confirming
  calls `storage.deleteSessionsBefore(cutoff)` and shows the returned
  count in a brief success message (FR-011), and a cancel action — kept to
  only the text FR-012 allows (depends on T011-T015; must make T010 pass).
- [ ] T017 [US2] Wire `DeleteOldDataFlow` into
  `src/presentation/settings/data-section.tsx`, next to
  `DeleteEverythingFlow`, passed the same `onDataChanged` callback this
  section's other data-changing flows already use (depends on T016).

**Checkpoint**: User Story 2 is fully functional and independently
testable — quickstart.md §2-4.

---

## Phase 5: Polish & Cross-Cutting

- [ ] T018 [P] Run `npm run check:no-color-literals` and confirm
  `storage-size-section.tsx`/`delete-old-data-flow.tsx` introduce no new
  CSS beyond existing `settings.css`/`logging.css` token-based classes
  (constitution Principle V).
- [ ] T019 Run the full `quickstart.md` validation manually (all five
  sections) against a real browser build, including
  `npm run test:contract-adapters` for the adapter parity in quickstart.md
  §5.
- [ ] T020 Update `specs/010-storage-size-retention/spec.md`'s **Status**
  line to `Implemented — merged to main via PR #<N>` once the feature PR
  merges, per the `sdd-workflow` skill's Status convention.

---

## Dependencies & Execution Order

- **User Story 1** and **User Story 2** have no dependency on each other —
  either can be implemented and merged first; both are included in this
  single feature branch/PR per the user's instruction to ship both
  together.
- Within each story: tests (T001-T002, T006-T010) before the implementation
  tasks that must make them pass, per the constitution's
  test-before-the-fix/feature discipline.
- T011 (the port interface change) blocks T012-T014 (the three adapter
  implementations), which run in parallel `[P]` against each other
  (different files).
- T016 depends on T011-T015 (needs the port method and the cutoff helper
  to exist before the modal can call them); T017 depends on T016.
- Phase 5 runs after both stories are complete.

## Parallel Example: User Story 2's adapter implementations

```bash
# Once T011 (port interface) lands, all three adapters can proceed together:
Task: "Implement deleteSessionsBefore in src/infrastructure/in-memory-storage-adapter.ts"
Task: "Implement deleteSessionsBefore in src/infrastructure/indexed-db-storage-adapter.ts"
Task: "Implement deleteSessionsBefore in src/infrastructure/file-system-storage-adapter.ts"
```

## Implementation Strategy

Both stories are P1 and small; implement User Story 1 first (no port
change, lowest risk, fastest to a visible result), then User Story 2
(the port addition and the modal), then Phase 5 polish — all on this one
feature branch, matching the user's instruction to deliver one PR covering
the whole feature rather than splitting into two.
