/**
 * `Block` — an ordered grouping within a `Session`
 * (`docs/requirements.md` §3.1; FR-003).
 *
 * A `Block` with zero `Exercise entry` items is a valid domain state
 * (FR-017) — enforced by `createBlock` accepting an empty list, not by any
 * length constraint on the type itself.
 *
 * `loose` marks a block the user never explicitly created via "Add
 * block" — an implicit container the presentation layer synthesizes for
 * an exercise logged outside any named block (`docs/requirements.md`
 * FR-2's "loose" logging path), rendered with no header/controls at all.
 * It is distinct from having no `name`: an explicitly created block that
 * simply hasn't been named yet is *not* `loose` and must still show its
 * position label and stay renameable/deletable (FR-2 — "An unnamed block
 * is shown by its position, not as 'Untitled'"), never collapse to
 * `loose` rendering just because it has no name. Omitted (rather than
 * `false`) on every explicitly created block and on any block predating
 * this field, so old/legacy data defaults to the FR-2-compliant "real
 * block" rendering.
 */

import type { ExerciseEntry } from './exercise-entry';

export interface Block {
  name?: string;
  loose?: boolean;
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
