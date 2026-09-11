# Phase 1 Quickstart — verifying the domain model and ports are done

Run these after `/speckit-implement` to confirm every Phase 1 (scoped)
requirement holds. Each step maps to FRs / success criteria in
[spec.md](./spec.md).

## Prerequisites

- Phase 0 (`specs/000-scaffolding/`) merged; `npm ci` already run.

## 1. Every entity and value object exists, technology-free (FR-001..FR-009, SC-001)

```
npm run typecheck
```

Expected: `src/domain/` exports `Exercise`, `Session`, `Block`,
`ExerciseEntry`, `Set`, `BodyMeasurement`, `Load`, `Volume`, `Effort` per
[data-model.md](./data-model.md). Then:

```
grep -RInE "from '\.\./(application|infrastructure|presentation)" src/domain/
```

Expected: no output — `domain/` imports nothing internal (unchanged
forbidden-edge table from spec 000).

## 2. Domain rules are enforced (FR-010..FR-015, FR-019..FR-022, SC-002)

```
npm run test:unit -- test/unit/domain
```

Expected: every rule in `docs/requirements.md` §3.3 has a red (violation
rejected) and green (valid case accepted) test, named traceably to the rule
(e.g. `'§3.3: renaming never breaks history'`). Confirm by name, not just by
count:

- `set.test.ts`: constructing a `Set` with no `Volume` and `Load: {kind:
  'none'}` throws `InvalidSetError`; the same construction with either
  present succeeds.
- `exercise.test.ts`: rename preserves every `ExerciseEntry` reference
  (id-based); merge reassigns every `Set` to the survivor and keeps the
  loser's name as an alias; merging an id with itself, or a nonexistent id,
  throws `ExerciseMergeError` (FR-019); deleting an exercise with history
  without confirmation throws
  `ExerciseDeleteConfirmationRequiredError` (FR-013); deleting one with no
  history succeeds without confirmation (FR-020).
- `body-measurement.test.ts`: constructing without `bodyWeightKg` throws
  `InvalidBodyMeasurementError` (FR-021); with it, succeeds.

## 3. No real I/O anywhere in this phase's tests (FR-028, SC-003)

```
grep -RInE "from 'fs'|from 'node:fs'|indexedDB|fetch\(" test/unit/domain test/unit/storage-port-fake.test.ts
```

Expected: no output.

## 4. The finalized storage port and its fake (FR-023..FR-027, SC-005)

```
npm run test:unit -- test/unit/storage-port-fake.test.ts
```

Expected: every method in [contracts/storage-port.md](./contracts/storage-port.md)
round-trips a real domain-shaped value (a `Session` with nested
`Block`/`ExerciseEntry`/`Set` data, an `Exercise`, a `BodyMeasurement`)
through `test/support/in-memory-storage.ts` with deep equality. Additionally
confirm:

- `mergeExercises` and `deleteExerciseCascade` are exercised as dedicated
  fake methods (not composed from save/get/delete in the test) and their
  rejection cases (FR-019, and cascade on a nonexistent id) are covered.
- `saveDraft` / `getDraft` / `discardDraft` round-trip an opaque payload —
  the fake does not interpret the draft's shape (FR-025).
- `getSchemaVersion` / `setSchemaVersion` still round-trip (FR-026, carried
  over from Phase 0).
- `src/application/ports/storage-port.ts` no longer references
  `SessionRecord` / `ExerciseRecord` — only the real entity types (FR-023).

## 5. Seed-catalogue shape check (FR-016, User Story 4)

Inspect `Exercise` in [data-model.md](./data-model.md): confirm no field
(e.g. `isSeed`, `source`) distinguishes a seed-provided entry. Construct one
in a test using only fields an ordinary user-created entry would have —
succeeds with no special-casing.

## 6. Cross-spec readiness for spec 001 (SC-004)

Manually diff spec 001's Key Entities section against this spec's: every
type spec 001 names as part of a `Session` (Session, Block, Exercise entry,
Set, Load, Volume, Effort) now has a concrete import path under
`src/domain/`. The one gap left on purpose: spec 001's **Logging draft**
has no domain type here — only the `saveDraft`/`getDraft`/`discardDraft`
port surface (step 4 above) exists for it; its own shape is spec 001's
`/speckit-plan` job.

## Done

All six sections pass ⇒ Phase 1 (scoped) deliverable met
(`docs/agent-brief.md` §3, narrowed per spec.md's Context) ⇒
`specs/001-log-a-session` can proceed to `/speckit-plan` against real
domain types, and Phase 2 (Persistence) has a finalized port to implement
against.
