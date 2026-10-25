# Phase 1 Data Model: Storage Size Display and Old-Data Retention Cleanup

No new persisted entity or field (confirmed by `schema-guardian` against
`docs/requirements.md` §3/§6) — both concepts below are derived/ephemeral,
matching the spec's own Key Entities section.

## Stored data size (derived, not persisted)

| Field | Type | Notes |
|---|---|---|
| `bytes` | `number` | Exact UTF-8 byte length of the JSON-serialized snapshot of every record the port holds (research.md §1). Never shown directly. |
| `displayValue` | `number` (integer ≥ 1) | Rounded whole-number amount in `unit`, per research.md §2. |
| `unit` | `'KB' \| 'MB'` | Chosen from the exact `bytes`/1024 value before rounding (FR-002). |

Computed fresh on every read by `computeStorageSizeLabel` (application
layer) — not cached, not written to any store (FR-004). Source records:
every Session (`listSessions(allStoredDataRange())`), the Exercise
catalogue (`listExercises()`), band labels and other Settings
(`getSettings()`), and the pending logging draft if any (`getDraft()`) —
the same scope as `StoragePort.resetToFreshInstall` (spec 006 FR-016).

## Retention cutoff (ephemeral UI/flow state, not persisted)

| Field | Type | Notes |
|---|---|---|
| `source` | `'1y' \| '6m' \| '3m' \| 'explicit'` | Which control produced the cutoff — drives which quick-option button (if any) renders selected. |
| `cutoffDate` | `string` (ISO 8601 date, no time component) | The chosen calendar day. For a quick option, computed by `cutoffMonthsAgo` (research.md §3); for an explicit date, the user's own input. |
| `matchingSessionCount` | `number \| undefined` | `undefined` while no valid cutoff is chosen yet (FR-007's "no stale count" rule) — not `0`, so the UI can tell "nothing to count yet" apart from "counted, found zero" (spec Edge Cases). |

Lives only in the "Delete old data" modal's own component state — gone the
moment the modal closes, reopens with nothing chosen (spec Key Entities).
Not part of `Settings` (the persisted preferences record) and not part of
any Zustand store that survives navigation.

## `StoragePort` contract change

One new method, detailed in `contracts/storage-port-additions.md`:
`deleteSessionsBefore(cutoff: string): Promise<number>`. Operates only on
the existing `Session` entity (`src/domain/session.ts`) via its existing
`dateTime` field — no change to `Session`'s own shape, identity, or
serialized form.

## Entity relationships (unchanged)

This feature introduces no new relationship. `deleteSessionsBefore`
removes whole `Session` records (and, by removal, every `Block`/
`Exercise entry`/`Set` nested inside them — they have no independent
existence outside their owning Session, per `docs/requirements.md` §3.1);
it does not touch `Exercise` catalogue entries even if a deleted Session
was the only one referencing a given exercise (the same "exercise persists
regardless of reference count" rule `deleteExerciseCascade`'s own removal
of a *different* kind — an Exercise, not a Session — already establishes
elsewhere in this codebase, applied here in the opposite direction: an
Exercise with zero remaining Session references is simply an Exercise with
no history, same as a brand-new one).
