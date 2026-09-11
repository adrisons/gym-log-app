import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../support';
import type {
  SessionRecord,
  ExerciseRecord,
} from '../../src/application/ports/storage-port';

// Spec 000 FR-014 / contracts/storage-port.md "Verification": for every
// StoragePort method, the in-memory fake round-trips a value, with no real
// storage API involved anywhere in this file.

describe('InMemoryStorage (StoragePort fake)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  const session: SessionRecord = { id: 's1', dateTime: '2026-09-10T18:00:00Z' };
  const exercise: ExerciseRecord = { id: 'e1', canonicalName: 'Back squat' };

  it('saveSession → getSession round-trips', async () => {
    await storage.saveSession(session);
    await expect(storage.getSession('s1')).resolves.toEqual(session);
  });

  it('getSession on an unknown id returns undefined', async () => {
    await expect(storage.getSession('nope')).resolves.toBeUndefined();
  });

  it('saveSession → listSessions includes it within range', async () => {
    await storage.saveSession(session);
    const result = await storage.listSessions({
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-30T23:59:59Z',
    });
    expect(result).toContainEqual(session);
  });

  it('listSessions excludes sessions outside the range', async () => {
    await storage.saveSession(session);
    const result = await storage.listSessions({
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-31T23:59:59Z',
    });
    expect(result).toEqual([]);
  });

  it('listSessions compares parsed instants, not raw ISO strings (mixed offsets)', async () => {
    // 2026-09-10T20:00:00+02:00 is the same instant as 18:00:00Z — a naive
    // string comparison against a "Z" bound would wrongly exclude it.
    const offsetSession: SessionRecord = {
      id: 's2',
      dateTime: '2026-09-10T20:00:00+02:00',
    };
    await storage.saveSession(offsetSession);

    const result = await storage.listSessions({
      from: '2026-09-10T17:00:00Z',
      to: '2026-09-10T19:00:00Z',
    });

    expect(result).toContainEqual(offsetSession);
  });

  it('deleteSession → getSession returns undefined', async () => {
    await storage.saveSession(session);
    await storage.deleteSession('s1');
    await expect(storage.getSession('s1')).resolves.toBeUndefined();
  });

  it('saveExercise → getExercise round-trips', async () => {
    await storage.saveExercise(exercise);
    await expect(storage.getExercise('e1')).resolves.toEqual(exercise);
  });

  it('saveExercise → listExercises includes it', async () => {
    await storage.saveExercise(exercise);
    await expect(storage.listExercises()).resolves.toContainEqual(exercise);
  });

  it('setSchemaVersion → getSchemaVersion round-trips', async () => {
    await expect(storage.getSchemaVersion()).resolves.toBe(0);
    await storage.setSchemaVersion(3);
    await expect(storage.getSchemaVersion()).resolves.toBe(3);
  });

  it('reset() clears all state', async () => {
    await storage.saveSession(session);
    await storage.saveExercise(exercise);
    await storage.setSchemaVersion(5);

    storage.reset();

    await expect(storage.getSession('s1')).resolves.toBeUndefined();
    await expect(storage.getExercise('e1')).resolves.toBeUndefined();
    await expect(storage.getSchemaVersion()).resolves.toBe(0);
  });
});
