import { describe, expect, it } from 'vitest';
import {
  computeImportPreview,
  type LocalImportSnapshot,
} from '../../../../src/application/data-transfer/import-preview';
import {
  buildExportFile,
  type ExportFile,
} from '../../../../src/application/data-transfer/export-file';
import type { Session } from '../../../../src/domain/session';
import type { Exercise } from '../../../../src/domain/exercise';
import type { SessionId, ExerciseId } from '../../../../src/domain/ids';
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

const emptyLocal: LocalImportSnapshot = {
  sessions: [],
  exercises: [],
  bandLabels: [],
  settings: undefined,
  loggingDraft: undefined,
};

describe('computeImportPreview (spec 006 FR-010)', () => {
  it('counts sessions/exercises with no local match as additions', () => {
    const file = buildExportFile({
      sessions: [makeSession()],
      exercises: [makeExercise()],
      bandLabels: [],
      settings: undefined,
      loggingDraft: undefined,
    });
    const preview = computeImportPreview(emptyLocal, file);
    expect(preview.sessions).toEqual({ toAdd: 1, toReplace: 0 });
    expect(preview.exercises).toEqual({ toAdd: 1, toReplace: 0 });
  });

  it('counts a session/exercise matching a local id as a replacement', () => {
    const session = makeSession();
    const exercise = makeExercise();
    const local: LocalImportSnapshot = {
      ...emptyLocal,
      sessions: [session],
      exercises: [exercise],
    };
    const file = buildExportFile({
      sessions: [session],
      exercises: [exercise],
      bandLabels: [],
      settings: undefined,
      loggingDraft: undefined,
    });
    const preview = computeImportPreview(local, file);
    expect(preview.sessions).toEqual({ toAdd: 0, toReplace: 1 });
    expect(preview.exercises).toEqual({ toAdd: 0, toReplace: 1 });
  });

  it('is idempotent: re-importing the same file into the same local state shows zero adds, all replaces (SC-005)', () => {
    const session = makeSession();
    const exercise = makeExercise();
    const local: LocalImportSnapshot = {
      sessions: [session],
      exercises: [exercise],
      bandLabels: ['Red'],
      settings: {
        defaultUnit: 'kg',
        quickIncrements: { durationSeconds: 5, distanceMetres: 5 },
        theme: 'dark',
        firstDayOfWeek: 'monday',
      },
      loggingDraft: undefined,
    };
    const file = buildExportFile(local);
    const preview = computeImportPreview(local, file);
    expect(preview.sessions).toEqual({ toAdd: 0, toReplace: 1 });
    expect(preview.exercises).toEqual({ toAdd: 0, toReplace: 1 });
    expect(preview.bandLabels).toEqual({ present: true, willReplace: true });
    expect(preview.settings).toEqual({ present: true, willReplace: true });
  });

  it('reports bandLabels/settings/loggingDraft presence and replacement per singleton semantics', () => {
    const fileWithNone: ExportFile = buildExportFile(emptyLocal);
    const preview = computeImportPreview(emptyLocal, fileWithNone);
    expect(preview.bandLabels).toEqual({ present: false, willReplace: false });
    expect(preview.settings).toEqual({ present: false, willReplace: false });
    expect(preview.loggingDraft).toEqual({
      present: false,
      willReplace: false,
    });
  });

  it('present-but-no-local-match reports willReplace: false (it will be added, not replaced)', () => {
    const file = buildExportFile({
      ...emptyLocal,
      bandLabels: ['Red'],
    });
    const preview = computeImportPreview(emptyLocal, file);
    expect(preview.bandLabels).toEqual({ present: true, willReplace: false });
  });

  it('reports the original (pre-migration) file version and willMigrate correctly', () => {
    const file = buildExportFile(emptyLocal);
    const preview = computeImportPreview(emptyLocal, file, 1);
    expect(preview.schemaVersion).toEqual({
      fileVersion: 1,
      willMigrate: 1 < CURRENT_SCHEMA_VERSION,
    });
  });
});
