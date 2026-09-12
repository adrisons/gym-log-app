/**
 * FR-012/013: the push/pull split of working sets within the trailing
 * 90 days, shown only with >=20 classified sets (§5.7).
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';
import { classifyMovementPattern } from './push-pull-classification';

const MIN_CLASSIFIED_SETS = 20;

export interface PushPullBalanceResult {
  pushCount: number;
  pullCount: number;
  periodStart: string;
  periodEnd: string;
}

function isWorkingSet(setKind: 'warmUp' | 'working' | 'toFailure'): boolean {
  return setKind === 'working' || setKind === 'toFailure';
}

export function computePushPullBalance(
  sessions: Session[],
  exercises: Exercise[],
): PushPullBalanceResult | undefined {
  if (sessions.length === 0) return undefined;

  const patternById = new Map<ExerciseId, string | undefined>(
    exercises.map((exercise) => [exercise.id, exercise.movementPattern]),
  );

  let pushCount = 0;
  let pullCount = 0;
  let earliest: string | undefined;
  let latest: string | undefined;

  for (const session of sessions) {
    for (const block of session.blocks) {
      for (const entry of block.exercises) {
        const classification = classifyMovementPattern(
          patternById.get(entry.exerciseId),
        );
        if (classification === 'unclassified') continue;

        for (const set of entry.sets) {
          if (!isWorkingSet(set.setKind)) continue;
          if (classification === 'push') pushCount += 1;
          else pullCount += 1;
        }
      }
    }
    if (earliest === undefined || session.dateTime < earliest)
      earliest = session.dateTime;
    if (latest === undefined || session.dateTime > latest)
      latest = session.dateTime;
  }

  if (pushCount + pullCount < MIN_CLASSIFIED_SETS) return undefined;

  return {
    pushCount,
    pullCount,
    periodStart: earliest!,
    periodEnd: latest!,
  };
}
