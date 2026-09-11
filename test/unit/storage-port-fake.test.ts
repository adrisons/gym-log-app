import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../support';
import type { LoggingDraft } from '../../src/application/ports/storage-port';
import type { Session } from '../../src/domain/session';
import type { Exercise } from '../../src/domain/exercise';
import type { BodyMeasurement } from '../../src/domain/body-measurement';
import type { SessionId, ExerciseId } from '../../src/domain/ids';
import { StorageError } from '../../src/application/errors';
import { createSet } from '../../src/domain/set';
import { createLoad } from '../../src/domain/load';
import { createVolume } from '../../src/domain/volume';

// Spec 002 FR-023..FR-027 / contracts/storage-port.md "Verification": for
// every StoragePort method, the in-memory fake round-trips a real
// domain-shaped value, with no real storage API involved anywhere in this
// file.

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    unilateral: false,
    discipline: 'Strength',
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1' as SessionId,
    dateTime: '2026-09-10T18:00:00.000Z',
    blocks: [],
    notes: '',
    ...overrides,
  };
}

describe('InMemoryStorage (StoragePort fake)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  describe('Sessions (FR-023; Acceptance Scenario 3.1)', () => {
    it('round-trips a Session with nested Block/ExerciseEntry/Set data through saveSession/getSession, deep-equal', async () => {
      const session = makeSession({
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: 'ex-1' as ExerciseId,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({
                      kind: 'weight',
                      value: 100,
                      unit: 'kg',
                    }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          },
        ],
      });
      await storage.saveSession(session);
      const loaded = await storage.getSession(session.id);
      expect(loaded).toEqual(session);
    });

    it('lists sessions within a date range and deletes a session', async () => {
      const inRange = makeSession({
        id: 'sess-in' as SessionId,
        dateTime: '2026-09-10T18:00:00.000Z',
      });
      const outOfRange = makeSession({
        id: 'sess-out' as SessionId,
        dateTime: '2026-01-01T00:00:00.000Z',
      });
      await storage.saveSession(inRange);
      await storage.saveSession(outOfRange);

      const listed = await storage.listSessions({
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T00:00:00.000Z',
      });
      expect(listed).toEqual([inRange]);

      await storage.deleteSession(inRange.id);
      expect(await storage.getSession(inRange.id)).toBeUndefined();
    });

    it('compares parsed instants, not raw ISO 8601 strings, across mixed UTC offsets (regression)', async () => {
      // A session at 20:00+02:00 is 18:00Z — inside a 17:00Z..19:00Z range
      // when compared as instants, but would wrongly sort outside it under
      // naive lexicographic string comparison.
      const mixedOffset = makeSession({
        id: 'sess-mixed-offset' as SessionId,
        dateTime: '2026-09-10T20:00:00.000+02:00',
      });
      await storage.saveSession(mixedOffset);

      const listed = await storage.listSessions({
        from: '2026-09-10T17:00:00.000Z',
        to: '2026-09-10T19:00:00.000Z',
      });
      expect(listed).toEqual([mixedOffset]);
    });
  });

  describe('Exercise catalogue', () => {
    it('round-trips an Exercise through saveExercise/getExercise/listExercises', async () => {
      const exercise = makeExercise();
      await storage.saveExercise(exercise);
      expect(await storage.getExercise(exercise.id)).toEqual(exercise);
      expect(await storage.listExercises()).toEqual([exercise]);
    });
  });

  describe('Body measurements', () => {
    it('round-trips a BodyMeasurement through saveBodyMeasurement/listBodyMeasurements', async () => {
      const measurement: BodyMeasurement = {
        date: '2026-09-10',
        bodyWeightKg: 78.4,
        notes: '',
      };
      await storage.saveBodyMeasurement(measurement);
      const listed = await storage.listBodyMeasurements({
        from: '2026-09-01',
        to: '2026-09-30',
      });
      expect(listed).toEqual([measurement]);
    });
  });

  describe('mergeExercises (FR-012 cross-session half, FR-019, FR-024)', () => {
    it('reassigns every dependent Set reference (via its ExerciseEntry) to the survivor', async () => {
      const survivor = makeExercise({
        id: 'ex-survivor' as ExerciseId,
        canonicalName: 'Back squat',
      });
      const loser = makeExercise({
        id: 'ex-loser' as ExerciseId,
        canonicalName: 'Squats',
      });
      await storage.saveExercise(survivor);
      await storage.saveExercise(loser);

      const session = makeSession({
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: loser.id,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({ kind: 'none' }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          },
        ],
      });
      await storage.saveSession(session);

      await storage.mergeExercises(survivor.id, loser.id);

      const reloaded = await storage.getSession(session.id);
      expect(reloaded?.blocks[0]?.exercises[0]?.exerciseId).toBe(survivor.id);
      const survivorReloaded = await storage.getExercise(survivor.id);
      expect(survivorReloaded?.aliases).toContain('Squats');
      expect(await storage.getExercise(loser.id)).toBeUndefined();
    });

    it('rejects merging the same id as survivor and loser (red)', async () => {
      const exercise = makeExercise();
      await storage.saveExercise(exercise);
      await expect(
        storage.mergeExercises(exercise.id, exercise.id),
      ).rejects.toThrow(StorageError);
    });

    it('rejects merging a nonexistent id (red)', async () => {
      const exercise = makeExercise();
      await storage.saveExercise(exercise);
      await expect(
        storage.mergeExercises(exercise.id, 'ex-does-not-exist' as ExerciseId),
      ).rejects.toThrow(StorageError);
    });

    it('repoints a matching LoggingDraft reference to the survivor', async () => {
      const survivor = makeExercise({ id: 'ex-survivor' as ExerciseId });
      const loser = makeExercise({
        id: 'ex-loser' as ExerciseId,
        canonicalName: 'Squats',
      });
      await storage.saveExercise(survivor);
      await storage.saveExercise(loser);
      const draft: LoggingDraft = { id: 'draft-1', exerciseId: loser.id };
      await storage.saveDraft(draft);

      await storage.mergeExercises(survivor.id, loser.id);

      const reloadedDraft = await storage.getDraft();
      expect(reloadedDraft?.['exerciseId']).toBe(survivor.id);
    });
  });

  describe('deleteExerciseCascade (FR-013, FR-024)', () => {
    it('removes the exercise and every dependent ExerciseEntry/Set data', async () => {
      const exercise = makeExercise();
      await storage.saveExercise(exercise);
      const session = makeSession({
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: exercise.id,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({ kind: 'none' }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          },
        ],
      });
      await storage.saveSession(session);

      await storage.deleteExerciseCascade(exercise.id);

      expect(await storage.getExercise(exercise.id)).toBeUndefined();
      const reloadedSession = await storage.getSession(session.id);
      expect(reloadedSession?.blocks[0]?.exercises).toEqual([]);
    });

    it('rejects deleting a nonexistent id (red)', async () => {
      await expect(
        storage.deleteExerciseCascade('ex-does-not-exist' as ExerciseId),
      ).rejects.toThrow(StorageError);
    });

    it('prunes a matching LoggingDraft reference', async () => {
      const exercise = makeExercise();
      await storage.saveExercise(exercise);
      const draft: LoggingDraft = { id: 'draft-1', exerciseId: exercise.id };
      await storage.saveDraft(draft);

      await storage.deleteExerciseCascade(exercise.id);

      const reloadedDraft = await storage.getDraft();
      expect(reloadedDraft?.['exerciseId']).toBeUndefined();
    });
  });

  describe('Logging draft (FR-025)', () => {
    it('round-trips an opaque payload through saveDraft/getDraft/discardDraft, without the fake interpreting its shape', async () => {
      const draft: LoggingDraft = {
        id: 'draft-1',
        inProgressDateTime: '2026-09-11T09:00:00.000Z',
        arbitraryField: { nested: true },
      };
      await storage.saveDraft(draft);
      expect(await storage.getDraft()).toEqual(draft);

      await storage.discardDraft();
      expect(await storage.getDraft()).toBeUndefined();
    });
  });

  describe('Schema version (FR-026; Acceptance Scenario 3.2)', () => {
    it('round-trips getSchemaVersion/setSchemaVersion', async () => {
      expect(await storage.getSchemaVersion()).toBe(0);
      await storage.setSchemaVersion(3);
      expect(await storage.getSchemaVersion()).toBe(3);
    });
  });

  describe('Test isolation', () => {
    it('reset() clears all state', async () => {
      await storage.saveExercise(makeExercise());
      await storage.saveSession(makeSession());
      await storage.saveDraft({ id: 'draft-1' });
      await storage.setSchemaVersion(2);

      storage.reset();

      expect(await storage.listExercises()).toEqual([]);
      expect(
        await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
      ).toEqual([]);
      expect(await storage.getDraft()).toBeUndefined();
      expect(await storage.getSchemaVersion()).toBe(0);
    });
  });
});
