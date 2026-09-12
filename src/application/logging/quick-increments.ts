/**
 * Named quick-increment amounts for numeric load/volume controls
 * (FR-010; research.md §9). Fixed defaults for this slice — "configurable"
 * is satisfied by being named constants in one place
 * (`docs/development-principles.md` §5), not by a user-facing settings UI,
 * which doesn't exist yet (Settings/FR-11 is out of scope, spec.md
 * Non-Goals).
 *
 * Weight and reps no longer have dedicated quick-increment buttons — the
 * numeric keypad and the reps wheel picker replaced them (docs/requirements.md
 * FR-3's updated text) — so their constants were removed with the UI that
 * used them, rather than left as dead exports.
 */

export const WEIGHT_FINE_INCREMENT_KG = 0.5;
export const BODYWEIGHT_COMPONENT_INCREMENT_KG = 2.5;
export const DURATION_INCREMENT_SECONDS = 5;
export const DISTANCE_INCREMENT_METRES = 50;
