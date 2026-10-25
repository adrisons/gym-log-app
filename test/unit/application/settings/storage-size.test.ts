import { describe, expect, it } from 'vitest';
import {
  computeStorageSizeBytes,
  computeStorageSizeLabel,
  formatStorageSize,
} from '@/application/settings/storage-size';
import { InMemoryStorage } from '../../../support';
import type { ExerciseId, SessionId } from '@/domain/ids';

describe('formatStorageSize (FR-001-003, research.md §2)', () => {
  it('shows a whole-number KB amount below 1024 KB, never a decimal', () => {
    expect(formatStorageSize(48 * 1024)).toBe('48 KB');
  });

  it('shows a whole-number MB amount at/above 1024 KB', () => {
    expect(formatStorageSize(3 * 1024 * 1024)).toBe('3 MB');
  });

  it('rounds within KB, not up into a fake MB, below the boundary', () => {
    // 500.4 KB rounds to 500 KB, well clear of the 1024 KB boundary.
    expect(formatStorageSize(Math.round(500.4 * 1024))).toBe('500 KB');
  });

  it('promotes a KB value that rounds up to exactly 1024 to "1 MB", never "1024 KB"', () => {
    // 1023.6 KB: exact kb < 1024 so the unit test alone would pick KB, but
    // Math.round(1023.6) = 1024 — the one boundary FR-002 names explicitly.
    const bytes = Math.round(1023.6 * 1024);
    expect(formatStorageSize(bytes)).toBe('1 MB');
  });

  it('never shows "0 KB" for any non-zero byte count — shows "1 KB" instead', () => {
    expect(formatStorageSize(1)).toBe('1 KB');
    expect(formatStorageSize(400)).toBe('1 KB');
  });

  it('a true zero byte count shows "0 KB" (defensive, not a reachable production state)', () => {
    expect(formatStorageSize(0)).toBe('0 KB');
  });
});

describe('computeStorageSizeBytes / computeStorageSizeLabel (FR-001, FR-004)', () => {
  it('reflects data actually stored, and grows after adding a session', async () => {
    const storage = new InMemoryStorage();
    const before = await computeStorageSizeBytes(storage);

    const now = new Date().toISOString();
    await storage.saveSession({
      id: 'session-1' as SessionId,
      dateTime: now,
      blocks: [],
      notes: 'x'.repeat(5000),
    });

    const after = await computeStorageSizeBytes(storage);
    expect(after).toBeGreaterThan(before);
  });

  it('never returns a blank/zero label for a completely empty store', async () => {
    const storage = new InMemoryStorage();
    const label = await computeStorageSizeLabel(storage);
    expect(label).toMatch(/^\d+ (KB|MB)$/);
  });

  it('counts multi-byte characters by their real UTF-8 byte length, not UTF-16 code-unit length', async () => {
    const storage = new InMemoryStorage();
    const before = await computeStorageSizeBytes(storage);

    const now = new Date().toISOString();
    // Each "é" is 1 UTF-16 code unit but 2 UTF-8 bytes — .length alone
    // would undercount this exactly where it matters (user-authored text).
    await storage.saveSession({
      id: 'session-2' as SessionId,
      dateTime: now,
      blocks: [],
      notes: 'é'.repeat(100),
    });

    const after = await computeStorageSizeBytes(storage);
    // 100 "é" chars contribute >100 bytes beyond the JSON scaffolding a
    // UTF-16-length measurement of the same string would have reported.
    expect(after - before).toBeGreaterThan(150);
  });

  it('reflects a deletion — the figure shrinks back down', async () => {
    const storage = new InMemoryStorage();
    const now = new Date().toISOString();
    await storage.saveSession({
      id: 'session-3' as SessionId,
      dateTime: now,
      blocks: [],
      notes: 'x'.repeat(5000),
    });
    const withSession = await computeStorageSizeBytes(storage);

    await storage.deleteSession('session-3' as SessionId);
    const afterDelete = await computeStorageSizeBytes(storage);

    expect(afterDelete).toBeLessThan(withSession);
  });

  it('includes the exercise catalogue, not just sessions', async () => {
    const storage = new InMemoryStorage();
    const before = await computeStorageSizeBytes(storage);

    await storage.saveExercise({
      id: 'ex-1' as ExerciseId,
      canonicalName: 'Back squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    });

    const after = await computeStorageSizeBytes(storage);
    expect(after).toBeGreaterThan(before);
  });
});
