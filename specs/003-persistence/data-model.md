# Data Model: Persistence

This spec introduces no new domain entity or value object — see spec.md's
own "Key Entities" section. What follows is the **physical mapping** of the
existing `StoragePort` surface (finalized by `specs/002-domain-and-ports/`)
onto each real adapter's storage, per research.md §5/§6. This is
infrastructure-layer detail, not a domain model change.

## Shared: schema version

| Field | Type | Notes |
|---|---|---|
| `CURRENT_SCHEMA_VERSION` | `number` (constant) | `1` (FR-007a). Lives in `src/infrastructure/schema-version.ts`, imported by both adapters — the one place this number exists. |
| stored version | `number` | `0` means "never initialized" (FR-007a sentinel); otherwise the version last written by `setSchemaVersion`. |

`decideSchemaAction(stored, current)` (research.md §1) is the single
source of migrate/open/refuse truth; neither adapter re-implements the
comparison.

## IndexedDB (Dexie) — table map

| Table | Key | Value shape | Corresponds to |
|---|---|---|---|
| `sessions` | `Session.id` | `Session` (domain shape, unchanged) | `saveSession`/`getSession`/`listSessions`/`deleteSession` |
| `exercises` | `Exercise.id` | `Exercise` (domain shape, unchanged) | `saveExercise`/`getExercise`/`listExercises`, and the target/source of `mergeExercises`/`deleteExerciseCascade` |
| `bodyMeasurements` | `BodyMeasurement.id` | `BodyMeasurement` (domain shape, unchanged) | `saveBodyMeasurement`/`listBodyMeasurements` |
| `draft` | fixed key `'current'` | `LoggingDraft \| undefined` (row absent when none) | `saveDraft`/`getDraft`/`discardDraft` |
| `bandLabels` | fixed key `'current'` | `string[]` (order-significant) | `listBandLabels`/`saveBandLabels` |
| `meta` | fixed key `'schemaVersion'` | `number` | `getSchemaVersion`/`setSchemaVersion` |
| `fileSystemHandle` (test/production shared handle cache — research.md §2) | fixed key `'root'` | `FileSystemDirectoryHandle` | Not part of `StoragePort` — internal to `FileSystemStorageAdapter`'s own handle persistence, stored via Dexie purely as a convenient structured-clone store. |

No indexes beyond the primary key are required for v1 scope — `listSessions`'s
date-range filter and `listExercises`/`listBodyMeasurements` are expected
session/catalogue sizes (a personal tool, not a multi-tenant system) that a
full-table scan handles well within `docs/requirements.md` §7.1's
performance targets; a secondary index is a future optimization, not a
correctness requirement this spec establishes.

## File System Access — file map

Rooted at the single directory the user grants access to (research.md §2):

| Path | Contains | Corresponds to |
|---|---|---|
| `sessions/<Session.id>.json` | One `Session`, as JSON | `saveSession`/`getSession`/`listSessions`/`deleteSession` (list = read every file in `sessions/`, filter by range) |
| `exercises.json` | `Exercise[]`, the whole catalogue | `saveExercise`/`getExercise`/`listExercises`, `mergeExercises`/`deleteExerciseCascade`'s catalogue-side effect |
| `body-measurements.json` | `BodyMeasurement[]` | `saveBodyMeasurement`/`listBodyMeasurements` |
| `draft.json` | `LoggingDraft`, absent (file not present) when none | `saveDraft`/`getDraft`/`discardDraft` (discard = delete the file) |
| `band-labels.json` | `string[]` | `listBandLabels`/`saveBandLabels` |
| `_meta.json` | `{ "schemaVersion": number }` | `getSchemaVersion`/`setSchemaVersion` |

`mergeExercises`/`deleteExerciseCascade`'s cascade across Sessions rewrites
every affected `sessions/<id>.json` file (per research.md §4's per-file
atomicity) plus `exercises.json` and, if the draft referenced the affected
exercise, `draft.json`.

## Validation rules carried over unchanged

Every field-level constraint (max lengths, required/nullable, enum values)
already lives on the domain types themselves
(`specs/002-domain-and-ports/data-model.md`) and on `LoggingDraft`
(`specs/001-log-a-session/data-model.md`) — neither adapter re-validates or
re-states them; both simply serialize/deserialize the same shape a
`StoragePort` caller already constructed and validated upstream.
