/**
 * `Volume` — a value object, one of three variants
 * (`docs/requirements.md` §3.2; FR-008).
 */

import { InvalidVolumeError } from './errors';

export type Volume =
  | { kind: 'reps'; count: number }
  | { kind: 'duration'; seconds: number }
  | { kind: 'distance'; metres: number };

/**
 * The only supported way to produce a `Volume` value.
 *
 * `reps.count` MUST be a positive integer (FR-008: "Reps (integer)");
 * `duration.seconds` and `distance.metres` are unrestricted decimals,
 * stored exactly as entered (FR-015) — no rounding, no unit conversion.
 */
export function createVolume(volume: Volume): Volume {
  if (
    volume.kind === 'reps' &&
    (!Number.isInteger(volume.count) || volume.count <= 0)
  ) {
    throw new InvalidVolumeError(
      `Volume.reps.count must be a positive integer, got ${volume.count}`,
    );
  }
  return volume;
}
