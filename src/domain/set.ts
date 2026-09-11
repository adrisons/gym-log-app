/**
 * `Set` — one performed set (`docs/requirements.md` §3.1; FR-005).
 *
 * Cannot exist with neither a `Volume` nor a `Load` other than `none`
 * (FR-010) — enforced by `createSet`, not by the structural shape alone.
 */

import type { Volume } from './volume';
import type { Load } from './load';
import type { Effort } from './effort';
import { InvalidSetError } from './errors';

export interface Set {
  volume?: Volume;
  /** Use `{ kind: 'none' }`, never `undefined`, when load doesn't apply. */
  load: Load;
  /** Optionality lives here, not on `Effort` itself (FR-022). */
  effort?: Effort;
  setKind: 'warmUp' | 'working' | 'toFailure';
  completed: boolean;
}

/**
 * The only supported way to produce a `Set` value.
 *
 * Throws `InvalidSetError` when `volume` is absent AND `load.kind ===
 * 'none'` — a set is only representable with at least a volume or a load
 * (FR-010).
 */
export function createSet(set: Set): Set {
  if (set.volume === undefined && set.load.kind === 'none') {
    throw new InvalidSetError(
      'A Set must have a Volume, a Load other than "none", or both.',
    );
  }
  return set;
}
