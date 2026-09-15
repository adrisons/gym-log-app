# Data Model: Settings, Export and Import

No new canonical entity (`docs/requirements.md` §3.1 is unchanged). This
spec adds one new non-canonical persisted record (`Settings`, same
footing as the existing band-label list and `LoggingDraft` — D14) and two
transient, never-persisted shapes (`ExportFile`, `ImportPreview`).

## Settings (`src/application/ports/settings.ts`)

| Field | Type | Notes |
|---|---|---|
| `defaultUnit` | `'kg' \| 'lb'` | FR-001. Default `'kg'` (D4). |
| `quickIncrements` | `{ durationSeconds: number; distanceMetres: number }` | FR-001, FR-3 (`docs/requirements.md`). Weight has no increment setting (research.md §7). Default `{ durationSeconds: 5, distanceMetres: 5 }`. |
| `theme` | `'light' \| 'dark' \| 'system'` | FR-001/003. Default `'system'`. |
| `firstDayOfWeek` | `'monday' \| 'sunday'` | FR-001/018. Default `'monday'` (matches spec 005's provisional ISO default — research.md §7). |
| `hideShareImagePrompt` | *(not part of this spec)* | Reserved by spec 007 (Share as Image), not defined here — noted so a future reader does not look for it in this file. |

`withSettingsDefaults(stored?: Partial<Settings>): Settings` fills any
field a stored record is missing (a fresh install, or a settings record
written by an older app version before a field existed — D14: a Settings
field defaults silently, no migration). `StoragePort.getSettings()`
always returns a fully-populated `Settings`, never `undefined` — callers
never null-check it.

**No schema-version bump.** Settings is additive, non-canonical
per-device state, on the same precedent already accepted for band labels
and the logging draft (spec.md Non-Goals, `schema-guardian`-reviewed).

## ExportFile (`src/application/data-transfer/export-file.ts`)

The interchange record (FR-007/008, research.md §4). Never persisted —
built fresh on every export, parsed fresh on every import, discarded
after.

| Field | Type | Notes |
|---|---|---|
| `format` | `'gym-log-export'` | Literal discriminant — FR-014's first check: a file missing this exact literal is rejected before anything else is inspected. |
| `schemaVersion` | `number` | The `CURRENT_SCHEMA_VERSION` the data was written at (research.md §4 — same axis as local storage, not a second one). |
| `exportedAt` | `string` (ISO 8601) | Informational only; never used for identity/merge decisions (FR-023 — not device-identifying, just a timestamp the user themselves can see). |
| `sessions` | `ExportedSession[]` | Every `Session`, field-for-field, plus each `ExerciseEntry` gaining a denormalized `exerciseName` (research.md §4). |
| `exerciseCatalogue` | `Exercise[]` | Every catalogue entry, verbatim domain shape. |
| `bandLabels?` | `string[]` | Present only if the device has a non-empty band-label list (Assumptions: singleton, presence-based). |
| `settings?` | `Settings` | Present only if the device has a Settings record (i.e., the user has opened Settings or changed something at least once). |
| `loggingDraft?` | `LoggingDraft` | Present only if a pending draft exists (`specs/001-log-a-session` FR-024). |

`ExportedSession` = `Session` with each block's `exercises[i]` widened to
`ExerciseEntry & { exerciseName: string }`. Every other field (dates,
notes, `Load`/`Volume`/`Effort` value objects) is the exact domain type —
no flattening, no renaming (FR-021/FR-022, research.md §4).

**Extensibility rule (FR-021)**: a future schema version MAY add an
optional field, a new `Exercise.discipline` value, or a new top-level
record kind here; none of that requires a second version axis or a
redesign of this shape — it goes through the same
schema-version-bump-and-migration mechanism (`docs/requirements.md` §6)
this file's own `schemaVersion` field already carries.

**Exclusions (FR-023)**: no file-system path, user-agent string, or
per-install random identifier appears anywhere in `ExportFile`. The
branded `SessionId`/`ExerciseId` string values are the same opaque-at-the-
type-level, plain-string-at-runtime identifiers already used locally —
not device identifiers, and already accompanied by a readable name per
field above.

## ImportPreview (`src/application/data-transfer/import-preview.ts`)

Computed fresh each time a file is selected (FR-010); never persisted;
discarded on confirm or cancel.

```ts
interface RecordSetPreview { toAdd: number; toReplace: number; }
interface SingletonPreview { present: boolean; willReplace: boolean; }

interface ImportPreview {
  sessions: RecordSetPreview;       // matched by SessionId
  exercises: RecordSetPreview;      // matched by ExerciseId
  bandLabels: SingletonPreview;
  settings: SingletonPreview;
  loggingDraft: SingletonPreview;
  schemaVersion: { fileVersion: number; willMigrate: boolean };
}
```

`computeImportPreview(local, file)` is a pure function of two already-read
snapshots (local `listSessions`/`listExercises`/`getSettings`/
`listBandLabels`/`getDraft` results, and the parsed+migrated `ExportFile`)
— no `StoragePort` call happens inside it.

## StoragePort additions

See `contracts/storage-port-additions.md` for full method signatures.
Summary: `getSettings`, `saveSettings`, `importBulk`, `resetToFreshInstall`.

## FileExchangePort (new port)

See `contracts/file-exchange-port.md`. Summary: `saveFile`, `pickFile` —
the only two file-dialog operations export/import need, kept separate
from `StoragePort` because they are one-shot user-gesture file exchanges,
not durable app storage (research.md).
