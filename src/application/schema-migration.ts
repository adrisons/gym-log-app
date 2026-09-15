/**
 * Shared, pure schema-version and migration logic (`specs/006-settings-data`
 * research.md §3). `CURRENT_SCHEMA_VERSION`/`decideSchemaAction` moved here
 * from `src/infrastructure/schema-version.ts` (which now just re-exports
 * them, so both real adapters' existing `from './schema-version'` imports
 * keep working unchanged) the moment `application/data-transfer/` needed
 * them too: `application` may not import `infrastructure`
 * (`docs/architecture.md`'s forbidden-edge table), so a value every
 * `StoragePort` adapter AND the export/import feature both need has to
 * live at the `application` layer or lower — this is that layer.
 *
 * The migration functions below were previously two separate copies —
 * `IndexedDbStorageAdapter#migrateExerciseTemplateDefaults` and
 * `FileSystemStorageAdapter`'s `withTemplateDefaults` — extracted here so
 * both real adapters AND the new in-memory import-file migration path
 * (spec 006 FR-012) share one implementation instead of three ways to
 * drift apart.
 */
import type { Exercise } from '@/domain/exercise';

/**
 * The schema version this build of the app understands
 * (`docs/requirements.md` §6; spec 003 FR-007a). The one place this number
 * exists — both real adapters, and `application/data-transfer/` (spec
 * 006), read it from here so they can never disagree about what "current"
 * means.
 */
export const CURRENT_SCHEMA_VERSION = 3;

export type SchemaAction = 'migrate' | 'open' | 'refuse';

/**
 * The migrate/open/refuse decision `docs/requirements.md` §6 specifies,
 * as a pure function so every caller shares one implementation and it is
 * unit-testable with no real storage involved (spec 003 research.md §1).
 *
 * `stored === 0` is FR-007a's "never initialized" sentinel — a device
 * that has never written a schema version, not an "older" version needing
 * migration. It resolves to `'open'`: nothing to migrate, and the caller
 * writes `current` on its own first real write.
 */
export function decideSchemaAction(
  stored: number,
  current: number,
): SchemaAction {
  if (stored === 0) return 'open';
  if (stored < current) return 'migrate';
  if (stored === current) return 'open';
  return 'refuse';
}

/**
 * ADR-0006's v1->v2 backfill: every stored `Exercise` gains
 * `defaultVolumeKind`/`trackEffort` with safe defaults (reps / effort not
 * tracked) if it doesn't already have them. Idempotent — re-applying to an
 * already-migrated `Exercise` changes nothing (`??` only fills a missing
 * value).
 */
export function migrateExerciseTemplateDefaults(exercise: Exercise): Exercise {
  return {
    ...exercise,
    defaultVolumeKind: exercise.defaultVolumeKind ?? 'reps',
    trackEffort: exercise.trackEffort ?? false,
  };
}

/**
 * Migrates a whole Exercise catalogue from `storedVersion` up to whatever
 * this build understands, applying every version step's backfill in
 * order. `storedVersion < 2` runs the v1->v2 backfill (ADR-0006); v2->v3
 * (ADR-0008: `Block.rounds`) needs no `Exercise`-level backfill at all —
 * `rounds` is optional everywhere it's read, so its absence in
 * already-stored data is already valid v3 data, not a gap (matches both
 * adapters' own `#checkSchema` comments).
 */
export function migrateExerciseCatalogue(
  exercises: Exercise[],
  storedVersion: number,
): Exercise[] {
  if (storedVersion >= 2) return exercises;
  return exercises.map(migrateExerciseTemplateDefaults);
}
