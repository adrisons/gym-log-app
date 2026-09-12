import { describe, expect, it } from 'vitest';
import { buildInsights } from '@/application/insights/build-insights';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import type { Session } from '@/domain/session';

const ASOF = new Date('2026-06-01T00:00:00.000Z');

function exercise(
  id: string,
  canonicalName: string,
  movementPattern?: string,
): Exercise {
  return {
    id: id as ExerciseId,
    canonicalName,
    aliases: [],
    ...(movementPattern !== undefined && { movementPattern }),
    defaultLoadType: 'weight',
    unilateral: false,
    discipline: 'Strength',
  };
}

function weightSession(
  id: string,
  dateTime: string,
  exerciseId: ExerciseId,
  kg: number,
): Session {
  const entry: ExerciseEntry = {
    exerciseId,
    notes: '',
    sets: [
      createSet({
        volume: createVolume({ kind: 'reps', count: 5 }),
        load: createLoad({ kind: 'weight', value: kg, unit: 'kg' }),
        setKind: 'working',
        completed: true,
      }),
    ],
  };
  return createSession({
    id: id as SessionId,
    dateTime,
    notes: '',
    blocks: [createBlock({ type: 'straightSets', exercises: [entry] })],
  });
}

describe('buildInsights', () => {
  it('wires all six card types end to end against one shared fixture catalogue', () => {
    const squat = exercise('ex-squat', 'Squat', 'Legs');
    const deadlift = exercise('ex-deadlift', 'Deadlift', 'Legs');
    const exercises = [squat, deadlift];

    const sessions: Session[] = [];
    // ~14 weeks of increasing-load sessions for both exercises, weekly,
    // ending recently — qualifies per-exercise progress, aggregate
    // progress (shared "Legs" pattern), recent records (last session is
    // the heaviest), and consistency (>=4 weeks, several trained weeks).
    // Plateau intentionally does not qualify here (load keeps rising).
    for (let week = 0; week < 14; week++) {
      const date = new Date(ASOF);
      date.setDate(date.getDate() - (13 - week) * 7);
      const iso = date.toISOString();
      sessions.push(weightSession(`sq-${week}`, iso, squat.id, 80 + week * 2));
      sessions.push(
        weightSession(`dl-${week}`, iso, deadlift.id, 100 + week * 2),
      );
    }

    const result = buildInsights(sessions, exercises, ASOF);

    expect(result.perExerciseProgress.cards.length).toBeGreaterThan(0);
    expect(result.aggregateProgress.cards.length).toBeGreaterThan(0);
    expect(result.recentRecords.cards.length).toBeGreaterThan(0);
    expect(result.consistency.cards).toHaveLength(1);
    // Plateau and push/pull balance have nothing to show in this fixture.
    expect(result.plateau.cards).toHaveLength(0);
    expect(result.plateau.missingDataExplanation).toBeTruthy();
    expect(result.pushPullBalance.cards).toHaveLength(0);
    expect(result.pushPullBalance.missingDataExplanation).toBeTruthy();
  });

  it('completes well within a human-perceptible delay at a realistic data volume (research.md §1)', () => {
    const exercises = Array.from({ length: 15 }, (_, i) =>
      exercise(`ex-${i}`, `Exercise ${i}`, i % 2 === 0 ? 'push' : 'pull'),
    );
    const sessions: Session[] = [];
    for (let day = 0; day < 300; day++) {
      const date = new Date(ASOF);
      date.setDate(date.getDate() - day);
      const exerciseForDay = exercises[day % exercises.length]!;
      sessions.push(
        weightSession(
          `s-${day}`,
          date.toISOString(),
          exerciseForDay.id,
          80 + (day % 20),
        ),
      );
    }

    const start = performance.now();
    buildInsights(sessions, exercises, ASOF);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});
