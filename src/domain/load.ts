/**
 * `Load` — a value object, one of five variants
 * (`docs/requirements.md` §3.2; FR-007).
 *
 * The union type below is structural, like any TypeScript interface — it
 * cannot by itself stop a caller from building an object literal directly
 * instead of calling `createLoad`. Treat bypassing `createLoad` as a
 * code-review-enforced convention: every `Load` value in this codebase is
 * expected to originate from `createLoad`, the same boundary
 * `exercise.ts`'s smart constructors rely on.
 */

import { InvalidLoadError } from './errors';

export type Load =
  | { kind: 'weight'; value: number; unit: 'kg' | 'lb' }
  | { kind: 'band'; label: string; estimatedResistanceKg?: number }
  | { kind: 'bodyweight'; addedOrAssistedKg?: number }
  | { kind: 'freeText'; text: string }
  | { kind: 'none' };

const BODYWEIGHT_COMPONENT_MIN = -300;
const BODYWEIGHT_COMPONENT_MAX = 300;

/**
 * The only supported way to produce a `Load` value.
 *
 * - `weight`/`band`/`freeText` values are stored exactly as entered
 *   (FR-015) — no unit conversion, no rounding.
 * - `bodyweight.addedOrAssistedKg` MUST be within -300..+300 (spec 001
 *   FR-014 precedent); outside that range throws `InvalidLoadError`.
 * - `bodyweight.addedOrAssistedKg` of exactly `0` is canonicalized to
 *   "no component" (the field is omitted from the returned value, not set
 *   to `undefined` — `exactOptionalPropertyTypes` distinguishes the two)
 *   so "no component" has exactly one representation, not two.
 */
export function createLoad(load: Load): Load {
  if (load.kind === 'bodyweight') {
    const component = load.addedOrAssistedKg;
    if (component === undefined || component === 0) {
      return { kind: 'bodyweight' };
    }
    if (
      !Number.isFinite(component) ||
      component < BODYWEIGHT_COMPONENT_MIN ||
      component > BODYWEIGHT_COMPONENT_MAX
    ) {
      throw new InvalidLoadError(
        `Load.bodyweight.addedOrAssistedKg must be within ${BODYWEIGHT_COMPONENT_MIN}..${BODYWEIGHT_COMPONENT_MAX}, got ${component}`,
      );
    }
    return { kind: 'bodyweight', addedOrAssistedKg: component };
  }
  return load;
}
