import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage } from '../../../support';
import {
  openLoggingForm,
  discardDraft,
  searchExercises,
  createExercise,
  updateExerciseTemplate,
  suggestFreeTextLoads,
  listBandLabels,
  saveBandLabels,
  renameExerciseWithCollisionCheck,
  mergeExercises,
  deleteExerciseCascade,
} from '@/application/logging/use-cases';
import { StorageError } from '@/application/errors';
import { ExerciseDeleteConfirmationRequiredError } from '@/domain/errors';
import { createDraft } from '@/application/logging/draft';
import type { Exercise } from '@/domain/exercise';
import type { Session } from '@/domain/session';
import type { ExerciseId, SessionId } from '@/domain/ids';

// Foundational: openLoggingForm/discardDraft. searchExercises/createExercise
// are US1. Every other use case in this file is added by later phases
// (US3/US2/US4) — see tasks.md.

describe('openLoggingForm (FR-001, FR-024; research.md §4)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a new draft when no draft is stored, and does not save a Session (Acceptance Scenario 1)', async () => {
    vi.setSystemTime(new Date('2026-09-11T09:00:00.000Z'));
    const draft = await openLoggingForm(storage);
    expect(draft.blocks).toEqual([]);
    expect(await storage.getDraft()).toEqual(draft);
    expect(
      await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
    ).toEqual([]);
  });

  it('restores the stored draft unchanged when its lastEditedAt is today (Acceptance Scenario 2)', async () => {
    vi.setSystemTime(new Date('2026-09-11T09:00:00.000Z'));
    const existing = createDraft('2026-09-11T08:00:00.000Z');
    await storage.saveDraft(existing);

    const draft = await openLoggingForm(storage);

    expect(draft).toEqual(existing);
    expect(
      await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
    ).toEqual([]);
  });

  it('promotes a draft from an earlier local calendar day to a Session, then returns a brand-new draft (Acceptance Scenario 4)', async () => {
    const yesterday = createDraft('2026-09-10T20:00:00.000Z');
    await storage.saveDraft({ ...yesterday, lastEditedAt: yesterday.dateTime });

    vi.setSystemTime(new Date('2026-09-11T09:00:00.000Z'));
    const draft = await openLoggingForm(storage);

    expect(draft.id).not.toBe(yesterday.id);
    expect(draft.blocks).toEqual([]);
    expect(await storage.getDraft()).toEqual(draft);

    const sessions = await storage.listSessions({
      from: '2000-01-01',
      to: '2100-01-01',
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.dateTime).toBe(yesterday.dateTime);
  });
});

describe('discardDraft (FR-024, Acceptance Scenario 3)', () => {
  it('clears the stored draft; a subsequent openLoggingForm returns a new one, not the discarded one', async () => {
    const storage = new InMemoryStorage();
    const original = await openLoggingForm(storage);

    await discardDraft(storage);
    expect(await storage.getDraft()).toBeUndefined();

    const next = await openLoggingForm(storage);
    expect(next.id).not.toBe(original.id);
  });
});

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

describe('searchExercises (FR-002, FR-016, SC-004)', () => {
  it('ranks an exact/alias match first and tolerates a typo, in the top 3', () => {
    const catalogue = [
      makeExercise({
        id: 'ex-squat' as ExerciseId,
        canonicalName: 'Barbell squat',
      }),
      makeExercise({
        id: 'ex-bench' as ExerciseId,
        canonicalName: 'Bench press',
      }),
      makeExercise({
        id: 'ex-row' as ExerciseId,
        canonicalName: 'Barbell row',
      }),
    ];

    const results = searchExercises('squta', catalogue, []);

    expect(results.slice(0, 3).map((e) => e.id)).toContain('ex-squat');
  });

  it('with an empty query, orders by most-used then most-recently-used, computed from the given sessions (Acceptance Scenario US1-5)', () => {
    const oftenUsed = makeExercise({
      id: 'ex-often' as ExerciseId,
      canonicalName: 'Often used',
    });
    const rarelyUsed = makeExercise({
      id: 'ex-rare' as ExerciseId,
      canonicalName: 'Rarely used',
    });
    const neverUsed = makeExercise({
      id: 'ex-never' as ExerciseId,
      canonicalName: 'Never used (seeded)',
    });
    const catalogue = [neverUsed, rarelyUsed, oftenUsed];

    const sessions: Session[] = [
      {
        id: 's1' as SessionId,
        dateTime: '2026-09-01T00:00:00.000Z',
        notes: '',
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: oftenUsed.id,
                notes: '',
                sets: [
                  {
                    load: { kind: 'none' },
                    volume: { kind: 'reps', count: 5 },
                    setKind: 'working',
                    completed: true,
                  },
                  {
                    load: { kind: 'none' },
                    volume: { kind: 'reps', count: 5 },
                    setKind: 'working',
                    completed: true,
                  },
                ],
              },
              {
                exerciseId: rarelyUsed.id,
                notes: '',
                sets: [
                  {
                    load: { kind: 'none' },
                    volume: { kind: 'reps', count: 5 },
                    setKind: 'working',
                    completed: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const results = searchExercises('', catalogue, sessions);

    expect(results.map((e) => e.id)).toEqual([
      'ex-often',
      'ex-rare',
      'ex-never',
    ]);
  });
});

describe('createExercise (FR-002, FR-015)', () => {
  it('saves a new Exercise with a fresh id and returns it', async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, {
      canonicalName: 'Hip thrust',
    });

    expect(exercise.canonicalName).toBe('Hip thrust');
    expect(exercise.discipline).toBe('Strength');
    expect(await storage.getExercise(exercise.id)).toEqual(exercise);
  });

  it('defaults the set-entry template to Weight + Reps, effort untracked (ADR-0006)', async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, {
      canonicalName: 'Hip thrust',
    });

    expect(exercise.defaultLoadType).toBe('weight');
    expect(exercise.defaultVolumeKind).toBe('reps');
    expect(exercise.trackEffort).toBe(false);
  });
});

describe('updateExerciseTemplate (ADR-0006)', () => {
  it("updates the exercise's load type, volume kind and trackEffort", async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, { canonicalName: 'Plank' });

    await updateExerciseTemplate(storage, exercise.id, {
      defaultLoadType: 'none',
      defaultVolumeKind: 'duration',
      trackEffort: true,
    });

    const updated = await storage.getExercise(exercise.id);
    expect(updated?.defaultLoadType).toBe('none');
    expect(updated?.defaultVolumeKind).toBe('duration');
    expect(updated?.trackEffort).toBe(true);
  });

  it('is a no-op when the exercise id does not resolve', async () => {
    const storage = new InMemoryStorage();

    await expect(
      updateExerciseTemplate(storage, 'missing' as ExerciseId, {
        defaultLoadType: 'weight',
        defaultVolumeKind: 'reps',
        trackEffort: false,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('suggestFreeTextLoads (FR-012)', () => {
  it('returns the distinct free-text values previously recorded for that exercise, most-recent-first', () => {
    const exerciseId = 'ex-1' as ExerciseId;
    const sessions: Session[] = [
      {
        id: 's1' as SessionId,
        dateTime: '2026-09-01T00:00:00.000Z',
        notes: '',
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId,
                notes: '',
                sets: [
                  {
                    load: { kind: 'freeText', text: 'Setting 4' },
                    setKind: 'working',
                    completed: true,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 's2' as SessionId,
        dateTime: '2026-09-05T00:00:00.000Z',
        notes: '',
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId,
                notes: '',
                sets: [
                  {
                    load: { kind: 'freeText', text: 'Setting 6' },
                    setKind: 'working',
                    completed: true,
                  },
                  {
                    load: { kind: 'freeText', text: 'Setting 4' },
                    setKind: 'working',
                    completed: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    expect(suggestFreeTextLoads(exerciseId, sessions)).toEqual([
      'Setting 6',
      'Setting 4',
    ]);
  });
});

describe('listBandLabels/saveBandLabels (FR-011)', () => {
  it('round-trip through the port, preserving order', async () => {
    const storage = new InMemoryStorage();
    await saveBandLabels(storage, ['Red', 'Blue']);
    expect(await listBandLabels(storage)).toEqual(['Red', 'Blue']);
  });
});

describe('renameExerciseWithCollisionCheck (FR-020, FR-022)', () => {
  it('renames cleanly when the new name is unused', async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, {
      canonicalName: 'Glute bridge',
    });

    const result = await renameExerciseWithCollisionCheck(
      storage,
      exercise.id,
      'Hip thrust',
    );

    expect(result.status).toBe('renamed');
    expect((await storage.getExercise(exercise.id))?.canonicalName).toBe(
      'Hip thrust',
    );
  });

  it('returns a collision, without renaming, case/accent-insensitively (Acceptance Scenario US4-3)', async () => {
    const storage = new InMemoryStorage();
    const target = await createExercise(storage, {
      canonicalName: 'Glute bridge',
    });
    await createExercise(storage, { canonicalName: 'Hip Thrúst' });

    const result = await renameExerciseWithCollisionCheck(
      storage,
      target.id,
      'hip thrust',
    );

    expect(result.status).toBe('collision');
    expect((await storage.getExercise(target.id))?.canonicalName).toBe(
      'Glute bridge',
    );
  });

  it('detects a collision against an alias too', async () => {
    const storage = new InMemoryStorage();
    const target = await createExercise(storage, { canonicalName: 'Squat' });
    const other = await createExercise(storage, { canonicalName: 'Row' });
    await storage.saveExercise({ ...other, aliases: ['Bent-over row'] });

    const result = await renameExerciseWithCollisionCheck(
      storage,
      target.id,
      'Bent-over row',
    );

    expect(result.status).toBe('collision');
  });
});

describe('mergeExercises (FR-017, FR-019)', () => {
  it('delegates to StoragePort.mergeExercises', async () => {
    const storage = new InMemoryStorage();
    const survivor = await createExercise(storage, { canonicalName: 'Squat' });
    const loser = await createExercise(storage, { canonicalName: 'Squats' });

    await mergeExercises(storage, survivor.id, loser.id);

    expect(await storage.getExercise(loser.id)).toBeUndefined();
    expect((await storage.getExercise(survivor.id))?.aliases).toContain(
      'Squats',
    );
  });

  it('surfaces the port rejection for identical/nonexistent ids unchanged', async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, { canonicalName: 'Squat' });

    await expect(
      mergeExercises(storage, exercise.id, exercise.id),
    ).rejects.toThrow(StorageError);
  });
});

describe('deleteExerciseCascade (FR-018)', () => {
  it('throws ExerciseDeleteConfirmationRequiredError, without calling the port, when history exists and unconfirmed', async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, { canonicalName: 'Squat' });

    await expect(
      deleteExerciseCascade(storage, exercise.id, true, false),
    ).rejects.toThrow(ExerciseDeleteConfirmationRequiredError);
    expect(await storage.getExercise(exercise.id)).toEqual(exercise);
  });

  it('calls StoragePort.deleteExerciseCascade when confirmed', async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, { canonicalName: 'Squat' });

    await deleteExerciseCascade(storage, exercise.id, true, true);

    expect(await storage.getExercise(exercise.id)).toBeUndefined();
  });

  it('calls StoragePort.deleteExerciseCascade when there is no history, without needing confirmation', async () => {
    const storage = new InMemoryStorage();
    const exercise = await createExercise(storage, { canonicalName: 'Squat' });

    await deleteExerciseCascade(storage, exercise.id, false, false);

    expect(await storage.getExercise(exercise.id)).toBeUndefined();
  });
});
