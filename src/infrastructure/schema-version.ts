/**
 * The schema version this build of the app understands
 * (`docs/requirements.md` §6; spec 003 FR-007a). The one place this number
 * exists — both real adapters (`IndexedDbStorageAdapter`,
 * `FileSystemStorageAdapter`) import it, so they can never disagree with
 * each other about what "current" means.
 */
export const CURRENT_SCHEMA_VERSION = 4;

export type SchemaAction = 'migrate' | 'open' | 'refuse';

/**
 * The migrate/open/refuse decision `docs/requirements.md` §6 specifies,
 * as a pure function so both adapters share one implementation and it is
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
