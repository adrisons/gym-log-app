/**
 * `Block` — an ordered grouping within a `Session`
 * (`docs/requirements.md` §3.1; FR-003).
 *
 * A `Block` with zero `Exercise entry` items is a valid domain state
 * (FR-017) — enforced by `createBlock` accepting an empty list, not by any
 * length constraint on the type itself.
 *
 * `rounds` (ADR-0008, schema v3) is the one exception: a genuine, optional
 * schema field — a target round count for the whole block (e.g. "3 rounds"
 * of a circuit), independent of and never derived from how many sets each
 * exercise entry in it actually has.
 */

import type { ExerciseEntry } from './exercise-entry';
import { InvalidBlockError } from './errors';

export interface Block {
  name?: string;
  type: 'straightSets' | 'superset' | 'circuit';
  rounds?: number;
  exercises: ExerciseEntry[];
}

/**
 * The only supported way to produce a `Block` value. Accepts an empty
 * `exercises` list (FR-017) — there is nothing to reject here; this
 * constructor exists for symmetry with the other entities and as the
 * single documented construction path (plan.md "Domain error strategy").
 *
 * `rounds`, when given, must be a positive integer (ADR-0008) — throws
 * `InvalidBlockError` otherwise. Omitting it entirely is always valid.
 */
export function createBlock(block: Block): Block {
  if (
    block.rounds !== undefined &&
    (!Number.isInteger(block.rounds) || block.rounds <= 0)
  ) {
    throw new InvalidBlockError(
      `Block.rounds must be a positive integer, got ${block.rounds}`,
    );
  }
  return block;
}
