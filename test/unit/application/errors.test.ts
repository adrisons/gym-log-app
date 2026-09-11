import { describe, expect, it } from 'vitest';
import { StorageError } from '../../../src/application/errors';

// spec 003 FR-012a: the `kind` discriminant is additive — existing
// two-arg call sites are unaffected, and `kind` reads back exactly what
// was passed in.

describe('StorageError', () => {
  it('defaults kind to undefined when constructed with only message/cause', () => {
    const error = new StorageError('boom', new Error('cause'));
    expect(error.kind).toBeUndefined();
    expect(error.message).toBe('boom');
  });

  it.each(['quota-exceeded', 'permission-lost', 'schema-too-new'] as const)(
    'stores and exposes kind = %s',
    (kind) => {
      const error = new StorageError('boom', undefined, kind);
      expect(error.kind).toBe(kind);
    },
  );
});
