import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../support';
import type {
  LoggingDraft,
  BulkImportInput,
} from '../../src/application/ports/storage-port';
import type { Settings } from '../../src/application/ports/settings';
import type { Session } from '../../src/domain/session';
import type { Exercise } from '../../src/domain/exercise';
import type { SessionId, ExerciseId } from '../../src/domain/ids';
import { StorageError } from '../../src/application/errors';
import { createSet } from '../../src/domain/set';
import { createLoad } from '../../src/domain/load';
import { createVolume } from '../../src/domain/volume';
import { CURRENT_SCHEMA_VERSION } from '../../src/infrastructure/schema-version';

// Spec 002 FR-023..FR-027 / contracts/storage-port.md "Verification", plus
// spec 001's contracts/storage-port-extension.md: for every StoragePort
// method, the in-memory fake round-trips a real domain-shaped value, with
// no real storage API involved anywhere in this file.

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
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

function makeDraft(overrides: Partial<LoggingDraft> = {}): LoggingDraft {
  return {
    id: 'draft-1',
    dateTime: '2026-09-11T09:00:00.000Z',
    lastEditedAt: '2026-09-11T09:00:00.000Z',
    blocks: [],
    notes: '',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    defaultUnit: 'kg',
    quickIncrements: { durationSeconds: 5, distanceMetres: 5 },
    theme: 'dark',
    firstDayOfWeek: 'sunday',
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

    it('repoints a matching LoggingDraft exercise entry to the survivor, keeping its sets (spec 001 contracts/storage-port-extension.md §1)', async () => {
      const survivor = makeExercise({ id: 'ex-survivor' as ExerciseId });
      const loser = makeExercise({
        id: 'ex-loser' as ExerciseId,
        canonicalName: 'Squats',
      });
      await storage.saveExercise(survivor);
      await storage.saveExercise(loser);
      const draft = makeDraft({
        blocks: [
          {
            id: 'block-1',
            type: 'straightSets',
            exercises: [
              {
                id: 'entry-1',
                exerciseId: loser.id,
                notes: '',
                sets: [
                  {
                    id: 'set-1',
                    load: createLoad({ kind: 'none' }),
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    setKind: 'working',
                    completed: true,
                  },
                ],
              },
            ],
          },
        ],
      });
      await storage.saveDraft(draft);

      await storage.mergeExercises(survivor.id, loser.id);

      const reloaded = await storage.getDraft();
      expect(reloaded?.blocks[0]?.exercises[0]?.exerciseId).toBe(survivor.id);
      expect(reloaded?.blocks[0]?.exercises[0]?.sets).toHaveLength(1);
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

    it('prunes a matching LoggingDraft exercise entry, leaving the (now possibly empty) block in place (spec 001 contracts/storage-port-extension.md §1)', async () => {
      const exercise = makeExercise();
      await storage.saveExercise(exercise);
      const draft = makeDraft({
        blocks: [
          {
            id: 'block-1',
            type: 'straightSets',
            exercises: [
              {
                id: 'entry-1',
                exerciseId: exercise.id,
                notes: '',
                sets: [],
              },
            ],
          },
        ],
      });
      await storage.saveDraft(draft);

      await storage.deleteExerciseCascade(exercise.id);

      const reloadedDraft = await storage.getDraft();
      expect(reloadedDraft?.blocks).toHaveLength(1);
      expect(reloadedDraft?.blocks[0]?.exercises).toEqual([]);
    });
  });

  describe('Logging draft (FR-024/FR-025; spec 001 data-model.md "LoggingDraft")', () => {
    it('round-trips a real nested draft through saveDraft/getDraft/discardDraft', async () => {
      const draft = makeDraft({
        blocks: [
          {
            id: 'block-1',
            name: 'Squats',
            type: 'straightSets',
            exercises: [
              {
                id: 'entry-1',
                exerciseId: 'ex-1' as ExerciseId,
                notes: '',
                sets: [
                  {
                    id: 'set-1',
                    load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
                    volume: createVolume({ kind: 'reps', count: 8 }),
                    setKind: 'working',
                    completed: true,
                  },
                ],
              },
            ],
          },
        ],
      });
      await storage.saveDraft(draft);
      expect(await storage.getDraft()).toEqual(draft);

      await storage.discardDraft();
      expect(await storage.getDraft()).toBeUndefined();
    });
  });

  describe('Band labels (spec 001 FR-011; contracts/storage-port-extension.md §2)', () => {
    it('defaults to an empty list', async () => {
      expect(await storage.listBandLabels()).toEqual([]);
    });

    it('round-trips an ordered list through saveBandLabels/listBandLabels, order preserved', async () => {
      await storage.saveBandLabels(['Red', 'Blue', 'Green']);
      expect(await storage.listBandLabels()).toEqual(['Red', 'Blue', 'Green']);

      await storage.saveBandLabels(['Green', 'Red', 'Blue']);
      expect(await storage.listBandLabels()).toEqual(['Green', 'Red', 'Blue']);
    });
  });

  describe('Schema version (FR-026; Acceptance Scenario 3.2)', () => {
    it('round-trips getSchemaVersion/setSchemaVersion', async () => {
      expect(await storage.getSchemaVersion()).toBe(0);
      await storage.setSchemaVersion(3);
      expect(await storage.getSchemaVersion()).toBe(3);
    });
  });

  describe('Settings (spec 006 FR-001/002)', () => {
    it('getSettings is undefined before any saveSettings call, mirroring getDraft()', async () => {
      expect(await storage.getSettings()).toBeUndefined();
    });

    it('round-trips Settings through saveSettings/getSettings', async () => {
      const settings = makeSettings();
      await storage.saveSettings(settings);
      expect(await storage.getSettings()).toEqual(settings);
    });
  });

  describe('Storage status (spec 009 FR-006-009/FR-017)', () => {
    it('reports kind: indexed-db (test-only fake mirrors the IndexedDB shape, ADR-0002)', async () => {
      expect(await storage.getStorageStatus()).toEqual({ kind: 'indexed-db' });
    });

    it('reconfirmFileSystemAccess is a no-op — nothing to reconfirm', async () => {
      await expect(
        storage.reconfirmFileSystemAccess(),
      ).resolves.toBeUndefined();
    });
  });

  describe('importBulk (spec 006 FR-011)', () => {
    it('adds sessions/exercises and leaves band labels/settings/draft untouched when absent from the input', async () => {
      await storage.saveBandLabels(['Red']);
      await storage.saveSettings(makeSettings());
      await storage.saveDraft(makeDraft());

      const newSession = makeSession({ id: 'bulk-new' as SessionId });
      const newExercise = makeExercise({ id: 'bulk-new-ex' as ExerciseId });
      const input: BulkImportInput = {
        sessions: [newSession],
        exercises: [newExercise],
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };
      await storage.importBulk(input);

      expect(await storage.getSession(newSession.id)).toEqual(newSession);
      expect(await storage.getExercise(newExercise.id)).toEqual(newExercise);
      expect(await storage.listBandLabels()).toEqual(['Red']);
      expect(await storage.getSettings()).toEqual(makeSettings());
      expect(await storage.getDraft()).toEqual(makeDraft());
    });

    it('replaces a session/exercise sharing an existing id, not merges it', async () => {
      const original = makeSession({
        id: 'replace-me' as SessionId,
        notes: 'before',
      });
      await storage.saveSession(original);

      await storage.importBulk({
        sessions: [{ ...original, notes: 'after' }],
        exercises: [],
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });

      expect((await storage.getSession(original.id))?.notes).toBe('after');
    });

    it('replaces bandLabels/settings/loggingDraft when present, and sets the stored schema version', async () => {
      await storage.saveBandLabels(['Old']);
      const importedSettings = makeSettings({ theme: 'light' });
      const importedDraft = makeDraft({ id: 'imported' });

      await storage.importBulk({
        sessions: [],
        exercises: [],
        bandLabels: ['New'],
        settings: importedSettings,
        loggingDraft: importedDraft,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });

      expect(await storage.listBandLabels()).toEqual(['New']);
      expect(await storage.getSettings()).toEqual(importedSettings);
      expect(await storage.getDraft()).toEqual(importedDraft);
      expect(await storage.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('resetToFreshInstall (spec 006 FR-015/016)', () => {
    it('wipes sessions/draft/bandLabels/settings and replaces the catalogue with exactly the seed set', async () => {
      await storage.saveSession(makeSession({ id: 'wipe-me' as SessionId }));
      await storage.saveExercise(
        makeExercise({ id: 'user-added' as ExerciseId }),
      );
      await storage.saveDraft(makeDraft());
      await storage.saveBandLabels(['Red']);
      await storage.saveSettings(makeSettings());

      const seed = [makeExercise({ id: 'seed-1' as ExerciseId })];
      await storage.resetToFreshInstall(seed);

      expect(
        await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
      ).toEqual([]);
      expect(await storage.listExercises()).toEqual(seed);
      expect(await storage.getDraft()).toBeUndefined();
      expect(await storage.listBandLabels()).toEqual([]);
      expect(await storage.getSettings()).toBeUndefined();
      expect(await storage.getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('Test isolation', () => {
    it('reset() clears all state, including the draft, band labels, and settings', async () => {
      await storage.saveExercise(makeExercise());
      await storage.saveSession(makeSession());
      await storage.saveDraft(makeDraft());
      await storage.saveBandLabels(['Red']);
      await storage.saveSettings(makeSettings());
      await storage.setSchemaVersion(2);

      storage.reset();

      expect(await storage.listExercises()).toEqual([]);
      expect(
        await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
      ).toEqual([]);
      expect(await storage.getDraft()).toBeUndefined();
      expect(await storage.listBandLabels()).toEqual([]);
      expect(await storage.getSettings()).toBeUndefined();
      expect(await storage.getSchemaVersion()).toBe(0);
    });
  });
});
