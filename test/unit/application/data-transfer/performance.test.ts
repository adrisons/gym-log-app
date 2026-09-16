import { describe, expect, it } from 'vitest';
import { buildExportFile } from '../../../../src/application/data-transfer/export-file';
import { buildTabularExport } from '../../../../src/application/data-transfer/tabular-export';
import { computeImportPreview } from '../../../../src/application/data-transfer/import-preview';
import type { Session } from '../../../../src/domain/session';
import type { Exercise } from '../../../../src/domain/exercise';
import type { SessionId, ExerciseId } from '../../../../src/domain/ids';
import { createSet } from '../../../../src/domain/set';
import { createLoad } from '../../../../src/domain/load';
import { createVolume } from '../../../../src/domain/volume';

/**
 * FR-020 / SC-007: a recorded, repeatable performance measurement of
 * export/import against a representative data set (100 sessions × 4
 * blocks × 3 exercises × 3 sets — the same order of magnitude spec 003/005
 * already exercise, plan.md's Performance Goals). `docs/requirements.md`
 * §7.1 sets no numeric target specific to these operations (spec.md
 * FR-020), so this test's own threshold is a generous, human-perceptible
 * ceiling (matches `build-insights.test.ts`'s own precedent), not a
 * product requirement — its job is to keep a number on record and catch a
 * severe regression, not to gate a specific millisecond budget.
 *
 * delete-everything/importBulk's own adapter-level duration (the
 * StoragePort write itself) isn't measured here — jsdom has no
 * IndexedDB/File System Access implementation (same boundary the storage
 * adapter contract suite documents), so that half is measured against a
 * real browser in `quickstart.md` §6, manually, alongside this file's own
 * result.
 */

function exercises(count: number): Exercise[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ex-${i}` as ExerciseId,
    canonicalName: `Exercise ${i}`,
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  }));
}

function representativeSessions(
  sessionCount: number,
  allExercises: Exercise[],
): Session[] {
  const sessions: Session[] = [];
  for (let s = 0; s < sessionCount; s++) {
    const date = new Date('2026-01-01T00:00:00.000Z');
    date.setDate(date.getDate() + s);
    sessions.push({
      id: `sess-${s}` as SessionId,
      dateTime: date.toISOString(),
      notes: '',
      blocks: Array.from({ length: 4 }, (_, b) => ({
        type: 'straightSets' as const,
        exercises: Array.from({ length: 3 }, (_, e) => ({
          exerciseId: allExercises[(b * 3 + e) % allExercises.length]!.id,
          notes: '',
          sets: Array.from({ length: 3 }, () =>
            createSet({
              volume: createVolume({ kind: 'reps', count: 5 }),
              load: createLoad({ kind: 'weight', value: 100, unit: 'kg' }),
              setKind: 'working',
              completed: true,
            }),
          ),
        })),
      })),
    });
  }
  return sessions;
}

describe('data-transfer performance (spec 006 FR-020, SC-007)', () => {
  const allExercises = exercises(12);
  const sessions = representativeSessions(100, allExercises);

  it('buildExportFile completes well within a human-perceptible delay at this data volume', () => {
    const start = performance.now();
    const file = buildExportFile({
      sessions,
      exercises: allExercises,
      settings: undefined,
      loggingDraft: undefined,
    });
    const elapsed = performance.now() - start;
    expect(file.sessions).toHaveLength(100);
    expect(elapsed).toBeLessThan(200);
  });

  it('buildTabularExport completes well within a human-perceptible delay at this data volume', () => {
    const start = performance.now();
    const csv = buildTabularExport(sessions, allExercises);
    const elapsed = performance.now() - start;
    expect(csv.split('\n').length).toBeGreaterThan(100 * 4 * 3 * 3);
    expect(elapsed).toBeLessThan(200);
  });

  it('computeImportPreview completes well within a human-perceptible delay at this data volume', () => {
    const file = buildExportFile({
      sessions,
      exercises: allExercises,
      settings: undefined,
      loggingDraft: undefined,
    });
    const start = performance.now();
    const preview = computeImportPreview(
      {
        sessions,
        exercises: allExercises,
        settings: undefined,
        loggingDraft: undefined,
      },
      file,
    );
    const elapsed = performance.now() - start;
    expect(preview.sessions.toReplace).toBe(100);
    expect(elapsed).toBeLessThan(200);
  });
});
