/**
 * `Block` — an ordered grouping within a `Session`
 * (`docs/requirements.md` §3.1; FR-003).
 *
 * A `Block` with zero `Exercise entry` items is a valid domain state
 * (FR-017) — enforced by `createBlock` accepting an empty list, not by any
 * length constraint on the type itself.
 *
 * Deliberately has no "loose"/implicit-container flag: whether a block
 * renders with header chrome or "bare" (`application/ports/logging-draft.ts`'s
 * `DraftBlock.loose`) is a presentation-only concern, scoped to the
 * in-progress editing state (`LoggingDraft`/`EditableSession`) and never
 * persisted here — adding a field to this type is a schema change under
 * `docs/requirements.md` §6 (version bump, ADR, migration), which a purely
 * cosmetic rendering choice doesn't warrant.
 */

import type { ExerciseEntry } from './exercise-entry';

export interface Block {
  name?: string;
  type: 'straightSets' | 'superset' | 'circuit';
  exercises: ExerciseEntry[];
}

/**
 * The only supported way to produce a `Block` value. Accepts an empty
 * `exercises` list (FR-017) — there is nothing to reject here; this
 * constructor exists for symmetry with the other entities and as the
 * single documented construction path (plan.md "Domain error strategy").
 */
export function createBlock(block: Block): Block {
  return block;
}
