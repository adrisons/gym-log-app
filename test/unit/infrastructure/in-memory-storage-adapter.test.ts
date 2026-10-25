import { describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../../support';
import type { Session } from '@/domain/session';
import type { ExerciseId, SessionId } from '@/domain/ids';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1' as SessionId,
    dateTime: '2026-03-10T12:00:00.000Z',
    blocks: [],
    notes: '',
    ...overrides,
  };
}

// spec 010 contracts/storage-port-additions.md scenarios 1-5, exercised
// directly against InMemoryStorageAdapter (no real browser needed, unlike
// the IndexedDB/File System adapters — see
// test/contract/storage-adapter-contract.ts's own doc comment).
describe('InMemoryStorageAdapter.deleteSessionsBefore (spec 010 FR-009/FR-009a/FR-010/FR-011)', () => {
  it('removes only sessions strictly before the cutoff', async () => {
    const storage = new InMemoryStorage();
    const older = makeSession({
      id: 'sess-older' as SessionId,
      dateTime: '2026-01-01T12:00:00.000Z',
    });
    const newer = makeSession({
      id: 'sess-newer' as SessionId,
      dateTime: '2026-06-01T12:00:00.000Z',
    });
    await storage.saveSession(older);
    await storage.saveSession(newer);

    await storage.deleteSessionsBefore('2026-03-01T00:00:00.000Z');

    expect(await storage.getSession(older.id)).toBeUndefined();
    expect(await storage.getSession(newer.id)).toEqual(newer);
  });

  it('resolves to the exact count of sessions removed', async () => {
    const storage = new InMemoryStorage();
    await storage.saveSession(
      makeSession({
        id: 'a' as SessionId,
        dateTime: '2026-01-01T00:00:00.000Z',
      }),
    );
    await storage.saveSession(
      makeSession({
        id: 'b' as SessionId,
        dateTime: '2026-01-02T00:00:00.000Z',
      }),
    );
    await storage.saveSession(
      makeSession({
        id: 'c' as SessionId,
        dateTime: '2026-06-01T00:00:00.000Z',
      }),
    );

    const removed = await storage.deleteSessionsBefore(
      '2026-03-01T00:00:00.000Z',
    );

    expect(removed).toBe(2);
  });

  it('matching zero sessions resolves to 0 and changes nothing', async () => {
    const storage = new InMemoryStorage();
    const session = makeSession({ dateTime: '2026-06-01T00:00:00.000Z' });
    await storage.saveSession(session);

    const removed = await storage.deleteSessionsBefore(
      '2020-01-01T00:00:00.000Z',
    );

    expect(removed).toBe(0);
    expect(await storage.getSession(session.id)).toEqual(session);
  });

  it('leaves the Exercise catalogue, Settings, and the pending logging draft untouched', async () => {
    const storage = new InMemoryStorage();
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
    const settings = {
      defaultUnit: 'kg' as const,
      quickIncrements: { durationSeconds: 5, distanceMetres: 5 },
      theme: 'dark' as const,
      firstDayOfWeek: 'monday' as const,
    };
    await storage.saveSettings(settings);
    const draft = {
      id: 'draft-1',
      dateTime: '2026-03-11T09:00:00.000Z',
      lastEditedAt: '2026-03-11T09:00:00.000Z',
      blocks: [],
      notes: '',
    };
    await storage.saveDraft(draft);
    await storage.saveSession(
      makeSession({ dateTime: '2026-01-01T00:00:00.000Z' }),
    );

    await storage.deleteSessionsBefore('2026-06-01T00:00:00.000Z');

    expect(await storage.listExercises()).toHaveLength(1);
    expect(await storage.getSettings()).toEqual(settings);
    expect(await storage.getDraft()).toEqual(draft);
  });

  it('keeps a session logged later the same calendar day as the cutoff', async () => {
    const storage = new InMemoryStorage();
    const sameDay = makeSession({ dateTime: '2026-03-01T20:00:00.000Z' });
    await storage.saveSession(sameDay);

    const removed = await storage.deleteSessionsBefore(
      '2026-03-01T00:00:00.000Z',
    );

    expect(removed).toBe(0);
    expect(await storage.getSession(sameDay.id)).toEqual(sameDay);
  });
});
