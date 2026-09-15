/**
 * FR-001: the Insights screen — six card-type sections, each rendering
 * its `InsightCard`s or a `MissingDataNotice` when it has nothing to
 * show (FR-015).
 */
import { useEffect, useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { allStoredDataRange } from '@/application/date-range';
import { withSettingsDefaults } from '@/application/settings-store';
import { buildInsights } from '@/application/insights/build-insights';
import type { InsightsResult } from '@/application/insights/build-insights';
import type { ProgressionMetric } from '@/application/progression/progression-series';
import type { Exercise, Session } from '@/application/logging/use-cases';
import { useSetScreenTitle } from '@/presentation/nav/screen-title';
import { InsightCard } from './insight-card';
import { MissingDataNotice } from './missing-data-notice';
import './insights.css';

const METRIC_LABELS: Record<ProgressionMetric, string> = {
  e1rm: 'estimated 1RM',
  topLoad: 'top load',
  tonnage: 'tonnage',
  repsAtLoad: 'reps at that load',
};

function progressionLink(exerciseId: string): string {
  return `/exercises/${exerciseId}/progression`;
}

export function InsightsScreen() {
  useSetScreenTitle('Insights');
  const [result, setResult] = useState<InsightsResult | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const storage = requireStorage();
      const [exercises, sessions, settings] = await Promise.all([
        storage.listExercises(),
        storage.listSessions(allStoredDataRange()),
        storage.getSettings(),
      ]);
      const { firstDayOfWeek } = withSettingsDefaults(settings);
      setResult(
        buildInsights(
          sessions as Session[],
          exercises as Exercise[],
          firstDayOfWeek,
        ),
      );
    })();
  }, []);

  if (!result) {
    return <main className="insights-screen" aria-label="Insights" />;
  }

  return (
    <main className="insights-screen" aria-label="Insights">
      <section aria-label="Per-exercise progress">
        <h2>Progress</h2>
        {result.perExerciseProgress.cards.length > 0 ? (
          result.perExerciseProgress.cards.map((card) => (
            <InsightCard
              key={card.exerciseId}
              claim={`${card.exerciseName} is ${card.trend.percentChange >= 0 ? 'up' : 'down'} ${Math.abs(card.trend.percentChange)}%`}
              period={`${card.trend.periodStart} to ${card.trend.periodEnd}`}
              support={`${card.trend.sessionCount} sessions`}
              linkTo={progressionLink(card.exerciseId)}
            />
          ))
        ) : (
          <MissingDataNotice
            explanation={result.perExerciseProgress.missingDataExplanation!}
          />
        )}
      </section>

      <section aria-label="Aggregate progress">
        <h2>Progress by group</h2>
        {result.aggregateProgress.cards.length > 0 ? (
          result.aggregateProgress.cards.map((card) => (
            <InsightCard
              key={`${card.groupKind}-${card.groupName}`}
              claim={`${card.groupName} is ${card.weightedPercentChange >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(card.weightedPercentChange))}% across ${card.contributingExercises.length} exercises`}
              period={`${card.periodStart} to ${card.periodEnd}`}
              support={`${card.contributingExercises.reduce((sum, e) => sum + e.trend.sessionCount, 0)} sessions`}
            />
          ))
        ) : (
          <MissingDataNotice
            explanation={result.aggregateProgress.missingDataExplanation!}
          />
        )}
      </section>

      <section aria-label="Recent records">
        <h2>Recent records</h2>
        {result.recentRecords.cards.length > 0 ? (
          result.recentRecords.cards.map((entry) => (
            <InsightCard
              key={`${entry.exerciseId}-${entry.metric}`}
              claim={`New ${METRIC_LABELS[entry.metric]} record on ${entry.exerciseName}: ${entry.value}`}
              period={entry.dateAchieved}
              support="1 session"
              linkTo={progressionLink(entry.exerciseId)}
              isPersonalRecord
            />
          ))
        ) : (
          <MissingDataNotice
            explanation={result.recentRecords.missingDataExplanation!}
          />
        )}
      </section>

      <section aria-label="Detected plateau">
        <h2>Plateaus</h2>
        {result.plateau.cards.length > 0 ? (
          result.plateau.cards.map((card) => (
            <InsightCard
              key={card.exerciseId}
              claim={`${card.exerciseName} has been flat (${card.trend.percentChange}%) over the last 8 weeks`}
              period={`${card.trend.periodStart} to ${card.trend.periodEnd}`}
              support={`${card.trend.sessionCount} sessions`}
              linkTo={progressionLink(card.exerciseId)}
            />
          ))
        ) : (
          <MissingDataNotice
            explanation={result.plateau.missingDataExplanation!}
          />
        )}
      </section>

      <section aria-label="Consistency">
        <h2>Consistency</h2>
        {result.consistency.cards.length > 0 ? (
          result.consistency.cards.map((card) => (
            <InsightCard
              key={card.periodStart}
              claim={`You've trained in ${card.trainedWeeks} of the last ${card.totalWeeks} weeks`}
              period={`${card.periodStart} to ${card.periodEnd}`}
              support={`${card.trainedWeeks} of ${card.totalWeeks} weeks trained`}
              linkTo="/diary"
            />
          ))
        ) : (
          <MissingDataNotice
            explanation={result.consistency.missingDataExplanation!}
          />
        )}
      </section>

      <section aria-label="Push/pull balance">
        <h2>Push/pull balance</h2>
        {result.pushPullBalance.cards.length > 0 ? (
          result.pushPullBalance.cards.map((card) => {
            const total = card.pushCount + card.pullCount;
            const pushPercent = Math.round((card.pushCount / total) * 100);
            const pullPercent = 100 - pushPercent;
            return (
              <InsightCard
                key={card.periodStart}
                claim={`${pushPercent}% push, ${pullPercent}% pull`}
                period={`${card.periodStart} to ${card.periodEnd}`}
                support={`${total} classified sets`}
                linkTo="/diary"
              />
            );
          })
        ) : (
          <MissingDataNotice
            explanation={result.pushPullBalance.missingDataExplanation!}
          />
        )}
      </section>
    </main>
  );
}
