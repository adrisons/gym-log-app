import { describe, expect, it } from 'vitest';
import { decideSchemaAction } from '../../../src/infrastructure/schema-version';

// spec 003 FR-007a/FR-008/FR-009/FR-010; research.md §1. Exercises the
// decision function against fixture current/stored pairs, independent of
// the real CURRENT_SCHEMA_VERSION constant's actual value.

describe('decideSchemaAction', () => {
  it('returns "open" for a never-initialized device (stored === 0), regardless of current', () => {
    expect(decideSchemaAction(0, 1)).toBe('open');
    expect(decideSchemaAction(0, 5)).toBe('open');
  });

  it('returns "migrate" when stored is older than current (0 < stored < current)', () => {
    expect(decideSchemaAction(1, 2)).toBe('migrate');
    expect(decideSchemaAction(3, 5)).toBe('migrate');
  });

  it('returns "open" when stored equals current', () => {
    expect(decideSchemaAction(1, 1)).toBe('open');
    expect(decideSchemaAction(4, 4)).toBe('open');
  });

  it('returns "refuse" when stored is newer than current', () => {
    expect(decideSchemaAction(2, 1)).toBe('refuse');
  });
});
