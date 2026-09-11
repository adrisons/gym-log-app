import { describe, expect, it } from 'vitest';
import { selectAdapterClass } from '../../../src/infrastructure/select-adapter';

// spec 003 FR-004: feature detection alone decides the adapter class, no
// user-facing choice.

describe('selectAdapterClass', () => {
  it('selects "file-system" when File System Access is available', () => {
    expect(selectAdapterClass(true)).toBe('file-system');
  });

  it('selects "indexed-db" when File System Access is unavailable (e.g. iOS Safari)', () => {
    expect(selectAdapterClass(false)).toBe('indexed-db');
  });
});
