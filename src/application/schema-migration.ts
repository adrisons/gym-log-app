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
import type { Session } from '@/domain/session';
import type { Load } from '@/domain/load';
import type { LoggingDraft } from '@/application/ports/logging-draft';

/**
 * The schema version this build of the app understands
 * (`docs/requirements.md` §6; spec 003 FR-007a). The one place this number
 * exists — both real adapters, and `application/data-transfer/` (spec
 * 006), read it from here so they can never disagree about what "current"
 * means.
 */
export const CURRENT_SCHEMA_VERSION = 5;

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
 * (ADR-0008: `Block` gained `rounds`) and v3->v4 (ADR-0013: `rounds`
 * removed again) both need no `Exercise`-level backfill at all — neither
 * step touches the `Exercise` shape, and `Block.rounds`'s own
 * addition/removal round-trips through storage with no rewrite either way
 * (matches both adapters' own `#checkSchema` comments).
 */
export function migrateExerciseCatalogue(
  exercises: Exercise[],
  storedVersion: number,
): Exercise[] {
  if (storedVersion >= 2) return exercises;
  return exercises.map(migrateExerciseTemplateDefaults);
}

/**
 * ADR-0016's v4->v5 backfill for the Exercise catalogue: a template's
 * `defaultLoadType` could be `'band'` (the removed `Load` kind), the same
 * exposure `migrateBandLoad` fixes for a `Set`'s own load — rewritten to
 * `'freeText'` here for the same reason (band exercises are better served
 * by free text than by the removed band editor). Idempotent — a
 * `defaultLoadType` that is already something else passes through
 * unchanged.
 */
export function migrateExerciseDefaultLoadType(exercise: Exercise): Exercise {
  // See `migrateBandLoad`'s own comment on the cast: `'band'` no longer
  // type-checks against `Load['kind']` in schema v5.
  if ((exercise.defaultLoadType as string) !== 'band') return exercise;
  return { ...exercise, defaultLoadType: 'freeText' };
}

/**
 * Migrates a whole Exercise catalogue's `defaultLoadType` from
 * `storedVersion` up to whatever this build understands. `storedVersion <
 * 5` runs the v4->v5 `defaultLoadType` backfill (ADR-0016) — kept as its
 * own function/gate, parallel to `migrateSessionsBandLoad`, rather than
 * folded into `migrateExerciseCatalogue`'s v1->v2 gate, since a catalogue
 * already at v2-v4 must still run this step while skipping the v1->v2 one.
 */
export function migrateExerciseCatalogueLoadType(
  exercises: Exercise[],
  storedVersion: number,
): Exercise[] {
  if (storedVersion >= 5) return exercises;
  return exercises.map(migrateExerciseDefaultLoadType);
}

/**
 * ADR-0016's v4->v5 backfill: the `band` `Load` kind was removed (its
 * label editor blocked the "add set" flow, and band exercises are better
 * served by `freeText`/`none`). Every stored `Set.load` with `kind ===
 * 'band'` is rewritten to `{ kind: 'freeText', text: 'Band: ' + label }`,
 * preserving the original label — and, when present, the legacy
 * `estimatedResistanceKg` — as text so no data is silently lost. Idempotent
 * — a `Load` that is already some other kind (including `freeText`) passes
 * through unchanged, and a legacy `band` value found more than once (e.g.
 * re-running the migration) is only ever rewritten once because its `kind`
 * is no longer `'band'` afterward.
 */
export function migrateBandLoad(load: Load): Load {
  // `band` was removed from the `Load` union in schema v5, so a
  // still-persisted v4 record's `kind: 'band'` value no longer type-checks
  // against `Load` — this function is exactly the boundary where such
  // legacy data is normalized, hence the cast.
  const legacy = load as
    Load | { kind: 'band'; label: string; estimatedResistanceKg?: number };
  if (legacy.kind !== 'band') return load;
  const resistance =
    legacy.estimatedResistanceKg !== undefined
      ? ` (~${legacy.estimatedResistanceKg}kg)`
      : '';
  return { kind: 'freeText', text: `Band: ${legacy.label}${resistance}` };
}

/** Applies `migrateBandLoad` to every `Set.load` in a whole `Session`. */
export function migrateSessionBandLoads(session: Session): Session {
  return {
    ...session,
    blocks: session.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((entry) => ({
        ...entry,
        sets: entry.sets.map((set) => ({
          ...set,
          load: migrateBandLoad(set.load),
        })),
      })),
    })),
  };
}

/**
 * Migrates a whole session list from `storedVersion` up to whatever this
 * build understands. `storedVersion < 5` runs the v4->v5 band-load
 * backfill (ADR-0016).
 */
export function migrateSessionsBandLoad(
  sessions: Session[],
  storedVersion: number,
): Session[] {
  if (storedVersion >= 5) return sessions;
  return sessions.map(migrateSessionBandLoads);
}

/**
 * `LoggingDraft.blocks[].exercises[].sets[].load` (`DraftSet.load`,
 * `application/ports/logging-draft.ts`) is structurally identical to
 * `Session.blocks[].exercises[].sets[].load` — the same `band` exposure
 * `migrateSessionBandLoads` walks a `Session` for, walked here for the
 * one, currently-in-progress `LoggingDraft` instead.
 */
export function migrateDraftBandLoad(draft: LoggingDraft): LoggingDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((entry) => ({
        ...entry,
        sets: entry.sets.map((set) => ({
          ...set,
          load: migrateBandLoad(set.load),
        })),
      })),
    })),
  };
}
