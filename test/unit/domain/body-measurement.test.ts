import { describe, expect, it } from 'vitest';
import { createBodyMeasurement } from '@/domain/body-measurement';
import { InvalidBodyMeasurementError } from '@/domain/errors';

describe('Body measurement construction rule (§3.1/§3.3; FR-021)', () => {
  it('rejects construction with no bodyWeightKg value (red)', () => {
    expect(() =>
      createBodyMeasurement({
        date: '2026-09-11',
        bodyWeightKg: Number.NaN,
        notes: '',
      }),
    ).toThrow(InvalidBodyMeasurementError);
  });

  it('accepts construction with bodyWeightKg present, fat/muscle fields omitted (green)', () => {
    const measurement = createBodyMeasurement({
      date: '2026-09-11',
      bodyWeightKg: 78.4,
      notes: '',
    });
    expect(measurement.bodyWeightKg).toBe(78.4);
    expect(measurement.fatPercentage).toBeUndefined();
  });

  it('accepts fat and muscle fields when present', () => {
    const measurement = createBodyMeasurement({
      date: '2026-09-11',
      bodyWeightKg: 78.4,
      fatPercentage: 18.2,
      musclePercentageOrMassKg: 40.1,
      notes: 'morning weigh-in',
    });
    expect(measurement.fatPercentage).toBe(18.2);
    expect(measurement.musclePercentageOrMassKg).toBe(40.1);
  });
});
