# ADR-0016: Remove the `band` load kind and band-label management entirely

## Status

Accepted.

## Context

A user report (in Spanish): selecting the "band" tracked field for an
exercise opens the band-label editor (`BandLoadInput`) as a sub-form
inside the "add set" row, and this sub-form blocks the set from being
saved — the Confirm button never became enabled from that state. Beyond
the immediate bug, the band-label catalogue (a whole settings section,
a `StoragePort` surface, and a per-set label picker) is disproportionate
machinery for a load kind that a short free-text value already
represents adequately ("red band", "light band + 2 plates", etc).

`Load` (`src/domain/load.ts`) is a domain value object with, through
schema v4, five variants: `weight | band | bodyweight | freeText | none`.
Per `docs/requirements.md` §6 ("Format changes: any change to the
persisted schema bumps the version and ships with its ADR and a tested
migration"), removing a `Load` variant is a persisted-schema change, not
a UI-only cleanup — every already-stored `Set` whose `load.kind` is
`'band'` needs an explicit, tested migration path, the same way
ADR-0006's v1→v2 `Exercise` backfill did.

The band-label catalogue itself (`StoragePort.listBandLabels`/
`saveBandLabels`, `docs/requirements.md` former FR-11 bullet) was already
documented as non-canonical, per-device state (`specs/001-log-a-session/
research.md` §7) — but it exists purely to serve the `band` load kind, so
its removal is bundled into this same schema-version bump rather than
treated as a separate concern.

## Decision

1. **Domain.** `Load`'s `band` variant is removed from the union in
   `src/domain/load.ts`. `Load` is now four variants:
   `weight | bodyweight | freeText | none`. A band exercise is tracked
   going forward with `freeText` (e.g. "red band") or `none`.
2. **Schema version bump, v4 → v5.** `CURRENT_SCHEMA_VERSION`
   (`src/application/schema-migration.ts`) becomes `5`. A new pure
   migration, `migrateBandLoad`, rewrites any persisted `Load` whose
   `kind` is still `'band'` to
   `{ kind: 'freeText', text: 'Band: ' + label }` — the original label is
   preserved as text, so no data is silently lost, and it is otherwise
   idempotent. `migrateSessionBandLoads`/`migrateSessionsBandLoad` apply
   it across every `Set` in a `Session`/list of `Session`s. Both
   `IndexedDbStorageAdapter` and `FileSystemStorageAdapter` wire this in
   exactly like ADR-0006's v1→v2 exercise-template backfill, gated on
   `stored < 5`; `InMemoryStorageAdapter` (a non-durable test fake) needs
   no such step since nothing survives a restart to migrate.
3. **Band-label catalogue removed.** `StoragePort.listBandLabels`/
   `saveBandLabels`, the `bandLabels` field on `BulkImportInput`, the
   IndexedDB `bandLabels` table wiring, the File System `band-labels.json`
   file, the `application/logging/use-cases.ts` wrapper use-cases, and the
   `logging-store.ts` `bandLabels` state slice are all deleted — this is
   the same version bump's "the persisted schema changed" scope, not a
   separate decision.
4. **Presentation.** `band-load-input.tsx` and `band-labels-section.tsx`
   (and their tests) are deleted outright. `LoadTypePicker` drops the
   "Band" option (four remain: Weight, Bodyweight, Free text, None).
   `SetRow`/`ExerciseSetList` drop every band-specific branch, prop, and
   the `bandLabels`/`onSaveBandLabels` plumbing through
   `LoggingScreen`/`SessionDetailScreen`.
5. **Export/import.** The export file's `bandLabels` field is dropped
   from `ExportFile`/`LocalExportSource` going forward — a device no
   longer produces it. A pre-v5 import file may still carry a stale
   top-level `bandLabels` array or a `Set.load` of `kind: 'band'`;
   `import-validation.ts` still structurally accepts `'band'` as a load
   kind (with a comment explaining why) so such a file is not hard-rejected,
   and `apply-import.ts` runs the same `migrateSessionsBandLoad` migration
   on its sessions before committing — consistent with how the storage
   adapters migrate already-stored data, rather than two different
   behaviors for "already on this device" vs. "just imported."

## Consequences

- `docs/requirements.md` §3.2's `Load` value-object bullet list drops
  `Band` (with a note pointing at this ADR), and FR-11's "Band catalogue
  management" bullet is replaced with a note that it was removed here.
- Every test that constructed a `band`-kind `Load` for progression/
  insights/tabular-export "non-numeric load" fixtures now uses `freeText`
  instead — behaviorally identical for those tests' purposes (both are
  non-numeric, non-eligible-for-e1RM load kinds).
- A device that upgrades from schema v4 (or earlier) silently rewrites
  any band-kind sets to free text on its next storage-adapter schema
  check; the band-label catalogue itself is simply never read or written
  again afterward.
- No further band-specific UI, storage surface, or domain branch remains
  anywhere in the codebase.
