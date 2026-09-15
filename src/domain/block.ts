/**
 * `Block` — an ordered grouping within a `Session`
 * (`docs/requirements.md` §3.1; FR-003).
 *
 * A `Block` with zero `Exercise entry` items is a valid domain state
 * (FR-017) — enforced by `createBlock` accepting an empty list, not by any
 * length constraint on the type itself.
 *
 * `rounds` (ADR-0008, schema v3) — a target round count for the whole
 * block — was removed by ADR-0013: redundant with each exercise entry's
 * own set count, which already says how many times it was actually done.
 * A stored `Block` from before that ADR may still carry a leftover
 * `rounds` key; nothing reads it any more, so it is simply inert.
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
