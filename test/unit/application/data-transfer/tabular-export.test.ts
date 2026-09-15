import { describe, expect, it } from 'vitest';
import { buildTabularExport } from '../../../../src/application/data-transfer/tabular-export';
import type { Session } from '../../../../src/domain/session';
import type { Exercise } from '../../../../src/domain/exercise';
import type { SessionId, ExerciseId } from '../../../../src/domain/ids';
import { createSet } from '../../../../src/domain/set';
import { createLoad } from '../../../../src/domain/load';
import { createVolume } from '../../../../src/domain/volume';

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

describe('buildTabularExport (spec 006 FR-009)', () => {
  it('has a header row and one data row per Set', () => {
    const exercise = makeExercise();
    const session: Session = {
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-10T18:00:00.000Z',
      notes: '',
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
                  load: createLoad({ kind: 'weight', value: 100, unit: 'kg' }),
                  setKind: 'working',
                  completed: true,
                }),
                createSet({
                  volume: createVolume({ kind: 'reps', count: 4 }),
                  load: createLoad({ kind: 'weight', value: 105, unit: 'kg' }),
                  setKind: 'working',
                  completed: true,
                }),
              ],
            },
          ],
        },
      ],
    };

    const csv = buildTabularExport([session], [exercise]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 sets
    expect(lines[0]).toContain('sessionDate');
    expect(lines[1]).toContain('Back squat');
    expect(lines[1]).toContain('100');
  });

  it('quotes a field containing a comma, quote, or newline per RFC 4180', () => {
    const exercise = makeExercise();
    const session: Session = {
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-10T18:00:00.000Z',
      notes: 'felt great, PR today "big"',
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
    };
    const csv = buildTabularExport([session], [exercise]);
    expect(csv).toContain('"felt great, PR today ""big"""');
  });

  it('produces only the header row for no sessions', () => {
    expect(buildTabularExport([], []).split('\n')).toHaveLength(1);
  });

  it('neutralizes a formula-leading session note so spreadsheet apps never execute it (CSV injection)', () => {
    const exercise = makeExercise();
    const session: Session = {
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-10T18:00:00.000Z',
      notes: '=cmd|"/c calc"!A1',
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
    };
    const csv = buildTabularExport([session], [exercise]);
    expect(csv).toContain("'=cmd");
    expect(csv).not.toMatch(/,=cmd/);
  });

  it('neutralizes a formula-leading exercise name and band/free-text load label', () => {
    const exercise = makeExercise({ canonicalName: '+1+1' });
    const session: Session = {
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-10T18:00:00.000Z',
      notes: '',
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
                  load: createLoad({ kind: 'band', label: '@SUM(1,1)' }),
                  setKind: 'working',
                  completed: true,
                }),
              ],
            },
          ],
        },
      ],
    };
    const csv = buildTabularExport([session], [exercise]);
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'@SUM(1,1)");
  });

  it('does not alter a genuinely negative numeric load value', () => {
    const exercise = makeExercise();
    const session: Session = {
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-10T18:00:00.000Z',
      notes: '',
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
                  load: createLoad({
                    kind: 'bodyweight',
                    addedOrAssistedKg: -10,
                  }),
                  setKind: 'working',
                  completed: true,
                }),
              ],
            },
          ],
        },
      ],
    };
    const csv = buildTabularExport([session], [exercise]);
    expect(csv).toContain(',-10,');
    expect(csv).not.toContain("'-10");
  });
});
