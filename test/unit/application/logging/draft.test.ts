import { describe, expect, it } from 'vitest';
import { createDraft, draftToSession } from '@/application/logging/draft';
import type { LoggingDraft } from '@/application/logging/draft';
import type { SessionId, ExerciseId } from '@/domain/ids';

describe('LoggingDraft (data-model.md "LoggingDraft")', () => {
  it('createDraft returns an empty draft dated `now`, with a fresh id every call', () => {
    const now = '2026-09-11T18:00:00.000Z';
    const a = createDraft(now);
    const b = createDraft(now);
    expect(a.blocks).toEqual([]);
    expect(a.dateTime).toBe(now);
    expect(a.lastEditedAt).toBe(now);
    expect(a.notes).toBe('');
    expect(a.id).not.toBe(b.id);
  });

  it('draftToSession strips every draft-local id and matches an independently-constructed Session', () => {
    const exerciseId = 'exercise-1' as ExerciseId;
    const sessionId = 'session-1' as SessionId;
    const draft: LoggingDraft = {
      id: 'draft-1',
      dateTime: '2026-09-11T18:00:00.000Z',
      lastEditedAt: '2026-09-11T18:05:00.000Z',
      notes: 'felt good',
      overallFeeling: 4,
      durationSeconds: 3600,
      blocks: [
        {
          id: 'block-1',
          name: 'Squats',
          type: 'straightSets',
          exercises: [
            {
              id: 'entry-1',
              exerciseId,
              notes: '',
              sets: [
                {
                  id: 'set-1',
                  volume: { kind: 'reps', count: 8 },
                  load: { kind: 'weight', value: 60, unit: 'kg' },
                  effort: 3,
                  setKind: 'working',
                  completed: true,
                },
              ],
            },
          ],
        },
      ],
    };

    const session = draftToSession(draft, sessionId);

    expect(session).toEqual({
      id: sessionId,
      dateTime: draft.dateTime,
      notes: draft.notes,
      overallFeeling: 4,
      durationSeconds: 3600,
      blocks: [
        {
          name: 'Squats',
          type: 'straightSets',
          exercises: [
            {
              exerciseId,
              notes: '',
              sets: [
                {
                  volume: { kind: 'reps', count: 8 },
                  load: { kind: 'weight', value: 60, unit: 'kg' },
                  effort: 3,
                  setKind: 'working',
                  completed: true,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('draftToSession handles a draft with zero blocks (FR-017 applies to a submitted draft too)', () => {
    const draft = createDraft('2026-09-11T18:00:00.000Z');
    const session = draftToSession(draft, 'session-2' as SessionId);
    expect(session.blocks).toEqual([]);
  });
});
