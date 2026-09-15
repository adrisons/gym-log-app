/**
 * Named quick-increment amounts for numeric load controls (FR-010;
 * research.md §9).
 *
 * Duration/distance's own increments moved to `Settings.quickIncrements`
 * (spec 006 FR-001/SC-003, `application/ports/settings.ts`) now that
 * they're genuinely user-configurable — `presentation/logging/
 * volume-input.tsx` takes them as props instead of importing fixed
 * constants from here, which had made the Settings fields it showed a
 * no-op (Copilot review, PR #31). `DEFAULT_SETTINGS.quickIncrements`
 * carries their old values (5s / 50m) forward as the fresh-install
 * default, so this changes no existing behavior on its own.
 */

export const WEIGHT_FINE_INCREMENT_KG = 0.5;
export const BODYWEIGHT_COMPONENT_INCREMENT_KG = 2.5;
