import { describe, expect, it } from 'vitest';
import {
  buildExportFile,
  EXPORT_FORMAT,
} from '../../../../src/application/data-transfer/export-file';
import type { Session } from '../../../../src/domain/session';
import type { Exercise } from '../../../../src/domain/exercise';
import type { SessionId, ExerciseId } from '../../../../src/domain/ids';
import { createSet } from '../../../../src/domain/set';
import { createLoad } from '../../../../src/domain/load';
import { createVolume } from '../../../../src/domain/volume';
import { CURRENT_SCHEMA_VERSION } from '../../../../src/application/schema-migration';

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

describe('buildExportFile (spec 006 FR-007/008/021/022/023)', () => {
  it('always includes format, schemaVersion, exportedAt, sessions, exerciseCatalogue', () => {
    const file = buildExportFile({
      sessions: [],
      exercises: [],
      settings: undefined,
      loggingDraft: undefined,
      now: new Date('2026-09-15T00:00:00.000Z'),
    });
    expect(file.format).toBe(EXPORT_FORMAT);
    expect(file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(file.exportedAt).toBe('2026-09-15T00:00:00.000Z');
    expect(file.sessions).toEqual([]);
    expect(file.exerciseCatalogue).toEqual([]);
  });

  it('omits settings/loggingDraft entirely when absent locally (presence semantics, data-model.md)', () => {
    const file = buildExportFile({
      sessions: [],
      exercises: [],
      settings: undefined,
      loggingDraft: undefined,
    });
    expect(file).not.toHaveProperty('settings');
    expect(file).not.toHaveProperty('loggingDraft');
  });

  it('denormalizes each ExerciseEntry with a readable exerciseName, keeping exerciseId as the identity field (FR-008/022)', () => {
    const exercise = makeExercise({ canonicalName: 'Back Squat' });
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
                  load: createLoad({ kind: 'weight', value: 100, unit: 'kg' }),
                  setKind: 'working',
                  completed: true,
                }),
              ],
            },
          ],
        },
      ],
    });
    const file = buildExportFile({
      sessions: [session],
      exercises: [exercise],
      settings: undefined,
      loggingDraft: undefined,
    });
    const entry = file.sessions[0]?.blocks[0]?.exercises[0];
    expect(entry?.exerciseId).toBe(exercise.id);
    expect(entry?.exerciseName).toBe('Back Squat');
  });

  it('carries no device-, installation-, or browser-identifying field anywhere (FR-023)', () => {
    const file = buildExportFile({
      sessions: [],
      exercises: [makeExercise()],
      settings: {
        defaultUnit: 'kg',
        quickIncrements: { durationSeconds: 5, distanceMetres: 5 },
        theme: 'dark',
        firstDayOfWeek: 'monday',
      },
      loggingDraft: undefined,
    });
    const serialized = JSON.stringify(file).toLowerCase();
    for (const forbidden of [
      'useragent',
      'user-agent',
      'deviceid',
      'navigator',
      'c:\\',
      '/users/',
      '/home/',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
