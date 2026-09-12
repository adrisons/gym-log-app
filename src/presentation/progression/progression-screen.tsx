/**
 * FR-013/014/019: hosts the progression list + chart for one exercise,
 * reading `listSessions(allStoredDataRange())` filtered to sessions
 * referencing it, and driving `buildProgressionSeries` with the
 * currently-selected metric/range.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { requireStorage } from '@/application/storage-access';
import { allStoredDataRange } from '@/application/date-range';
import { buildProgressionSeries } from '@/application/progression/progression-series';
import type {
  ProgressionMetric,
  ProgressionRange,
} from '@/application/progression/progression-series';
import { mostRecentNumericLoad } from '@/application/progression/most-recent-load';
import type {
  Exercise,
  ExerciseId,
  Session,
} from '@/application/logging/use-cases';
import { ProgressionList } from './progression-list';
import { ProgressionChart } from './progression-chart';
import './progression.css';

export function ProgressionScreen() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [exercise, setExercise] = useState<Exercise | undefined>(undefined);
  const [exerciseSessions, setExerciseSessions] = useState<
    Session[] | undefined
  >(undefined);
  const [metric, setMetric] = useState<ProgressionMetric>('e1rm');
  const [range, setRange] = useState<ProgressionRange>('all');

  useEffect(() => {
    if (!exerciseId) return;
    void (async () => {
      const storage = requireStorage();
      const [foundExercise, sessions] = await Promise.all([
        storage.getExercise(exerciseId as ExerciseId),
        storage.listSessions(allStoredDataRange()),
      ]);
      setExercise(foundExercise);
      setExerciseSessions(
        sessions.filter((session) =>
          session.blocks.some((block) =>
            block.exercises.some(
              (entry) => entry.exerciseId === (exerciseId as ExerciseId),
            ),
          ),
        ),
      );
    })();
  }, [exerciseId]);

  const fixedLoadValue = useMemo(
    () =>
      exerciseSessions
        ? mostRecentNumericLoad(exerciseSessions, exerciseId as ExerciseId)
        : undefined,
    [exerciseSessions, exerciseId],
  );

  const series = useMemo(() => {
    if (!exerciseSessions || !exerciseId) return undefined;
    return buildProgressionSeries(
      exerciseSessions,
      exerciseId as ExerciseId,
      metric,
      range,
      fixedLoadValue,
    );
  }, [exerciseSessions, exerciseId, metric, range, fixedLoadValue]);

  if (!exerciseId) {
    return null;
  }

  if (!series || !exerciseSessions) {
    return <main className="progression-screen" aria-label="Progression" />;
  }

  // FR-021: the initially-selected metric ('e1rm') can turn out to be
  // unavailable for this exercise; fall back to the first metric that is.
  const effectiveMetric = series.availableMetrics.includes(metric)
    ? metric
    : series.availableMetrics[0]!;
  const effectiveSeries =
    effectiveMetric === metric
      ? series
      : buildProgressionSeries(
          exerciseSessions,
          exerciseId as ExerciseId,
          effectiveMetric,
          range,
          fixedLoadValue,
        );

  return (
    <main className="progression-screen" aria-label="Progression">
      <h1>{exercise?.canonicalName ?? 'Progression'}</h1>
      {exerciseSessions.length === 0 ? (
        <p>No sessions logged for this exercise yet.</p>
      ) : (
        <>
          <ProgressionChart
            series={effectiveSeries}
            metric={effectiveMetric}
            range={range}
            onMetricChange={setMetric}
            onRangeChange={setRange}
          />
          <ProgressionList rows={effectiveSeries.listRows} />
        </>
      )}
    </main>
  );
}
