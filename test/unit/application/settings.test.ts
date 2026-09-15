import { describe, expect, it } from 'vitest';
import {
  withSettingsDefaults,
  DEFAULT_SETTINGS,
} from '../../../src/application/ports/settings';

describe('withSettingsDefaults (spec 006 FR-001, D14)', () => {
  it('returns the documented defaults when given no stored record', () => {
    expect(withSettingsDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('fills only the missing top-level fields of a partial stored record', () => {
    const result = withSettingsDefaults({ theme: 'dark' });
    expect(result).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' });
  });

  it('fills only the missing quickIncrements sub-field, keeping the other', () => {
    const result = withSettingsDefaults({
      quickIncrements: { durationSeconds: 10, distanceMetres: 5 },
    });
    expect(result.quickIncrements).toEqual({
      durationSeconds: 10,
      distanceMetres: 5,
    });
  });

  it('passes a fully-populated record through unchanged', () => {
    const full = {
      defaultUnit: 'lb' as const,
      quickIncrements: { durationSeconds: 15, distanceMetres: 25 },
      theme: 'light' as const,
      firstDayOfWeek: 'sunday' as const,
    };
    expect(withSettingsDefaults(full)).toEqual(full);
  });
});
