# Contract: `StoragePort` additions

Adds to `src/application/ports/storage-port.ts` (existing methods
unchanged — FR-017). All four new methods follow the port's existing
rules: return `Promise`, reject with `StorageError`, no infrastructure
vocabulary.

```ts
// Settings (FR-001/002 — non-canonical singleton, mirrors band labels)
getSettings(): Promise<Settings>;   // never undefined — defaults filled (data-model.md)
saveSettings(settings: Settings): Promise<void>;

// Bulk atomic write (FR-011) — the import/delete-everything dependency
interface BulkImportInput {
  sessions: Session[];        // upsert by SessionId (add if new, replace if matching)
  exercises: Exercise[];      // upsert by ExerciseId
  bandLabels?: string[];      // present => replace whole list; absent => local list untouched
  settings?: Settings;        // present => replace; absent => local settings untouched
  loggingDraft?: LoggingDraft;// present => replace; absent => local draft untouched
  schemaVersion: number;      // becomes the new stored schema version (post-migration, FR-012)
}
importBulk(input: BulkImportInput): Promise<void>;

// Delete-everything (FR-015/016)
resetToFreshInstall(seedExercises: Exercise[]): Promise<void>;
// Atomically: clears every session, replaces the exercise catalogue with
// exactly `seedExercises`, discards the draft, clears band labels to [],
// clears Settings (next getSettings() returns defaults), and sets the
// schema version to CURRENT_SCHEMA_VERSION — never a stale literal
// (spec.md FR-016).
```

## Atomicity requirement

Both `importBulk` and `resetToFreshInstall` MUST be all-or-nothing: an
interruption mid-operation MUST leave the device's data exactly as it was
before the call, or exactly as it would be after — never a mix. Per-adapter
technique is an implementation detail (research.md §2); the contract only
constrains the observable guarantee.

## Contract tests

`test/contract/storage-adapter-contract.ts` gains cases run against all
three adapters (`InMemoryStorageAdapter`, `IndexedDbStorageAdapter`,
`FileSystemStorageAdapter`):

1. `getSettings()` on a never-written device returns the documented
   defaults (data-model.md).
2. `saveSettings()` then `getSettings()` round-trips exactly.
3. `importBulk` with new sessions/exercises and no singleton fields adds
   them and leaves existing band labels/settings/draft untouched.
4. `importBulk` with a session/exercise sharing an existing id replaces
   that record's content exactly (no merge of fields).
5. `importBulk` including `bandLabels`/`settings`/`loggingDraft` replaces
   each accordingly; omitting one leaves the local one untouched.
6. `importBulk` sets the stored schema version to the input's
   `schemaVersion`.
7. `resetToFreshInstall` leaves `listExercises()` returning exactly the
   passed `seedExercises`, `listSessions()` empty, `getDraft()`
   `undefined`, `listBandLabels()` `[]`, `getSettings()` back to defaults,
   and the stored schema version at `CURRENT_SCHEMA_VERSION`.
8. (File System adapter only, or a dedicated infra-level test) an
   `importBulk`/`resetToFreshInstall` call interrupted after the journal
   is written but before every target file is written is fully completed
   on the next adapter instantiation (research.md §2's replay).
