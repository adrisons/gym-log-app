/**
 * FR-001/015: the Insights screen's one orchestrator. Computes all six
 * card types fresh from `sessions`/`exercises` (no caching, no
 * persistence — constitution Principle I) and attaches FR-015's
 * missing-data explanation for any card type with nothing to show.
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import { buildPerExerciseProgressCards } from './per-exercise-progress';
import type { PerExerciseProgressCard } from './per-exercise-progress';
import { buildAggregateProgressCards } from './aggregate-progress';
import type { AggregateProgressCard } from './aggregate-progress';
import { buildRecentRecords } from './recent-records';
import type { RecentRecordEntry } from './recent-records';
import { buildPlateauCards } from './plateau';
import type { PlateauCard } from './plateau';
import { computeConsistency } from './consistency';
import type { ConsistencyResult } from './consistency';
import { computePushPullBalance } from './push-pull-balance';
import type { PushPullBalanceResult } from './push-pull-balance';

const NINETY_DAY_WINDOW_DAYS = 90;
const EIGHT_WEEK_WINDOW_DAYS = 56;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export interface CardTypeResult<TCard> {
  cards: TCard[];
  missingDataExplanation: string | undefined;
}

export interface InsightsResult {
  perExerciseProgress: CardTypeResult<PerExerciseProgressCard>;
  aggregateProgress: CardTypeResult<AggregateProgressCard>;
  recentRecords: CardTypeResult<RecentRecordEntry>;
  plateau: CardTypeResult<PlateauCard>;
  consistency: CardTypeResult<ConsistencyResult>;
  pushPullBalance: CardTypeResult<PushPullBalanceResult>;
}

function withinTrailingDays(
  sessions: Session[],
  days: number,
  asOf: Date,
): Session[] {
  const cutoff = asOf.getTime() - days * MILLISECONDS_PER_DAY;
  return sessions.filter((s) => new Date(s.dateTime).getTime() >= cutoff);
}

function groupSessionsByExercise(
  sessions: Session[],
  exercises: Exercise[],
): { exercise: Exercise; sessions: Session[] }[] {
  return exercises.map((exercise) => ({
    exercise,
    sessions: sessions.filter((session) =>
      session.blocks.some((block) =>
        block.exercises.some((entry) => entry.exerciseId === exercise.id),
      ),
    ),
  }));
}

export function buildInsights(
  sessions: Session[],
  exercises: Exercise[],
  asOf: Date = new Date(),
): InsightsResult {
  const sessions90d = withinTrailingDays(
    sessions,
    NINETY_DAY_WINDOW_DAYS,
    asOf,
  );
  const sessions8w = withinTrailingDays(sessions, EIGHT_WEEK_WINDOW_DAYS, asOf);

  const perExerciseCards = buildPerExerciseProgressCards(
    sessions90d,
    exercises,
  );
  const aggregateCards = buildAggregateProgressCards(
    perExerciseCards,
    exercises,
  );
  const recentRecordEntries = buildRecentRecords(
    groupSessionsByExercise(sessions, exercises),
    asOf,
  );
  const plateauCards = buildPlateauCards(sessions8w, exercises);
  const consistencyResult = computeConsistency(sessions, asOf);
  const pushPullResult = computePushPullBalance(sessions90d, exercises);

  const anyExerciseTagged = exercises.some(
    (e) => e.movementPattern !== undefined || (e.muscleGroups?.length ?? 0) > 0,
  );

  return {
    perExerciseProgress: {
      cards: perExerciseCards,
      missingDataExplanation:
        perExerciseCards.length === 0
          ? 'Log an exercise a few more times, spanning at least 3 weeks, to see its trend.'
          : undefined,
    },
    aggregateProgress: {
      cards: aggregateCards,
      missingDataExplanation:
        aggregateCards.length === 0
          ? anyExerciseTagged
            ? 'Not enough exercises in any shared movement pattern or muscle group are showing individual progress yet.'
            : 'Add a movement pattern or muscle group to your exercises to see grouped progress.'
          : undefined,
    },
    recentRecords: {
      cards: recentRecordEntries,
      missingDataExplanation:
        recentRecordEntries.length === 0
          ? 'Nothing new has been set in the last 30 days.'
          : undefined,
    },
    plateau: {
      cards: plateauCards,
      missingDataExplanation:
        plateauCards.length === 0
          ? 'Log an exercise for at least 6 sessions within an 8-week span to check for a plateau.'
          : undefined,
    },
    consistency: {
      cards: consistencyResult ? [consistencyResult] : [],
      missingDataExplanation: consistencyResult
        ? undefined
        : 'Log sessions across at least 4 weeks to see your consistency.',
    },
    pushPullBalance: {
      cards: pushPullResult ? [pushPullResult] : [],
      missingDataExplanation: pushPullResult
        ? undefined
        : 'Log 20 more classifiable working sets (exercises with a recognized push or pull movement pattern) to see your push/pull balance.',
    },
  };
}
