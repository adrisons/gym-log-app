import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage } from '../../../support';
import {
  openLoggingForm,
  discardDraft,
  searchExercises,
  createExercise,
} from '@/application/logging/use-cases';
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
});
