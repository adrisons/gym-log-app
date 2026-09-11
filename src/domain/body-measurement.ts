/**
 * `Body measurement` — a dated record of body weight and optional
 * composition figures, independent of any `Session`
 * (`docs/requirements.md` §3.1; FR-006).
 *
 * Not constructible without a body weight value (FR-021) — enforced by
 * `createBodyMeasurement`.
 */

import { InvalidBodyMeasurementError } from './errors';

export interface BodyMeasurement {
  /** ISO 8601 date. */
  date: string;
  bodyWeightKg: number;
  fatPercentage?: number;
  musclePercentageOrMassKg?: number;
  notes: string;
}

/**
 * The only supported way to produce a `BodyMeasurement` value.
 *
 * Throws `InvalidBodyMeasurementError` when `bodyWeightKg` is not a finite
 * number — weight is the one non-optional field of this entity (FR-021);
 * the fat/muscle fields remain optional.
 */
export function createBodyMeasurement(
  measurement: BodyMeasurement,
): BodyMeasurement {
  if (!Number.isFinite(measurement.bodyWeightKg)) {
    throw new InvalidBodyMeasurementError(
      'A BodyMeasurement requires a finite bodyWeightKg value.',
    );
  }
  return measurement;
}
