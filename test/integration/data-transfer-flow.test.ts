import { describe, expect, it } from 'vitest';
import { createHarness } from '../support';
import { buildExportFile } from '../../src/application/data-transfer/export-file';
import { prepareImport } from '../../src/application/data-transfer/apply-import';
import { allStoredDataRange } from '../../src/application/date-range';
import { createSession } from '../../src/domain/session';
import { createSet } from '../../src/domain/set';
import { createLoad } from '../../src/domain/load';
import { createVolume } from '../../src/domain/volume';
import type { Exercise } from '../../src/domain/exercise';
import type { ExerciseId, SessionId } from '../../src/domain/ids';
import type { Settings } from '../../src/application/ports/settings';
import type { LoggingDraft } from '../../src/application/ports/logging-draft';

// spec.md User Story 2 Independent Test / SC-001 / SC-005: a file produced
// by US1 (export), imported into a second, independent installation,
// matches the source after confirming the preview — including Settings and
// the in-progress draft, not just sessions/exercises — and importing the
// same file twice in a row is idempotent.

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

const settings: Settings = {
  defaultUnit: 'lb',
  quickIncrements: { durationSeconds: 15, distanceMetres: 100 },
  theme: 'dark',
  firstDayOfWeek: 'sunday',
};

const draft: LoggingDraft = {
  id: 'draft-1',
  dateTime: '2026-09-12T09:00:00.000Z',
  notes: 'in progress',
  blocks: [],
  lastEditedAt: '2026-09-12T09:05:00.000Z',
};

describe('Data transfer flow: export from one install, import into another (US2 Independent Test)', () => {
  it('sessions, exercises, band labels, settings, and the draft all match after import (SC-001)', async () => {
    const source = createHarness();
    const exercise = makeExercise();
    await source.storage.saveExercise(exercise);
    await source.storage.saveSession(
      createSession({
        id: 'sess-1' as SessionId,
        dateTime: '2026-09-10T18:00:00.000Z',
        notes: 'leg day',
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
      }),
    );
    await source.storage.saveBandLabels(['Red', 'Blue']);
    await source.storage.saveSettings(settings);
    await source.storage.saveDraft(draft);

    const file = buildExportFile({
      sessions: await source.storage.listSessions(allStoredDataRange()),
      exercises: await source.storage.listExercises(),
      bandLabels: await source.storage.listBandLabels(),
      settings: await source.storage.getSettings(),
      loggingDraft: await source.storage.getDraft(),
    });
    const content = JSON.stringify(file);

    const destination = createHarness();
    const result = await prepareImport(destination.storage, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await result.prepared.commit();

    const [
      importedSessions,
      importedExercises,
      importedBandLabels,
      importedSettings,
      importedDraft,
    ] = await Promise.all([
      destination.storage.listSessions(allStoredDataRange()),
      destination.storage.listExercises(),
      destination.storage.listBandLabels(),
      destination.storage.getSettings(),
      destination.storage.getDraft(),
    ]);

    expect(importedSessions).toEqual(
      await source.storage.listSessions(allStoredDataRange()),
    );
    expect(importedExercises).toEqual([exercise]);
    expect(importedBandLabels).toEqual(['Red', 'Blue']);
    expect(importedSettings).toEqual(settings);
    expect(importedDraft).toEqual(draft);
  });

  it('importing the same file twice in a row is idempotent (SC-005)', async () => {
    const source = createHarness();
    const exercise = makeExercise();
    await source.storage.saveExercise(exercise);
    await source.storage.saveBandLabels(['Red']);

    const file = buildExportFile({
      sessions: [],
      exercises: await source.storage.listExercises(),
      bandLabels: await source.storage.listBandLabels(),
      settings: undefined,
      loggingDraft: undefined,
    });
    const content = JSON.stringify(file);

    const destination = createHarness();

    const first = await prepareImport(destination.storage, content);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await first.prepared.commit();

    const second = await prepareImport(destination.storage, content);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    await second.prepared.commit();

    expect(await destination.storage.listExercises()).toEqual([exercise]);
    expect(await destination.storage.listBandLabels()).toEqual(['Red']);
  });
});
