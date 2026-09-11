/**
 * FR-016/017/018/019/020/021: metric + range selectors, a Recharts line
 * chart, personal-record markers, and FR-021's one-sentence explanation
 * when e1RM is unavailable for this exercise.
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { E1RM_UNAVAILABLE_REASON } from '@/application/progression/progression-series';
import type {
  ProgressionMetric,
  ProgressionRange,
  ProgressionSeries,
} from '@/application/progression/progression-series';
import './progression.css';

const METRIC_LABELS: Record<ProgressionMetric, string> = {
  e1rm: 'Estimated 1RM',
  topLoad: 'Top load',
  tonnage: 'Tonnage',
  repsAtLoad: 'Reps at fixed load',
};

const RANGE_LABELS: Record<ProgressionRange, string> = {
  '3m': '3 months',
  '6m': '6 months',
  '12m': '1 year',
  all: 'All',
};

export interface ProgressionChartProps {
  series: ProgressionSeries;
  metric: ProgressionMetric;
  range: ProgressionRange;
  onMetricChange: (metric: ProgressionMetric) => void;
  onRangeChange: (range: ProgressionRange) => void;
}

export function ProgressionChart({
  series,
  metric,
  range,
  onMetricChange,
  onRangeChange,
}: ProgressionChartProps) {
  const chartData = series.chartPoints
    .filter((point) => point.value !== undefined)
    .map((point) => ({
      date: new Date(point.dateTime).toLocaleDateString(),
      value: point.value,
      isPersonalRecord: point.isPersonalRecord,
    }))
    .reverse();

  return (
    <section className="progression-chart">
      <div className="progression-chart__controls">
        <label className="logging-screen__field-label">
          <span>Metric</span>
          <select
            className="logging-field-input"
            value={metric}
            onChange={(event) =>
              onMetricChange(event.target.value as ProgressionMetric)
            }
          >
            {series.availableMetrics.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="logging-screen__field-label">
          <span>Range</span>
          <select
            className="logging-field-input"
            value={range}
            onChange={(event) =>
              onRangeChange(event.target.value as ProgressionRange)
            }
          >
            {(Object.keys(RANGE_LABELS) as ProgressionRange[]).map((r) => (
              <option key={r} value={r}>
                {RANGE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!series.availableMetrics.includes('e1rm') && (
        <p className="progression-chart__unavailable-reason">
          {E1RM_UNAVAILABLE_REASON}
        </p>
      )}

      {series.metricAvailable && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              connectNulls={false}
              dot={(props: {
                cx?: number;
                cy?: number;
                payload?: { isPersonalRecord?: boolean };
              }) => {
                const { cx, cy, payload } = props;
                if (cx === undefined || cy === undefined) return <g />;
                return (
                  <circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={payload?.isPersonalRecord ? 6 : 3}
                    className={
                      payload?.isPersonalRecord
                        ? 'progression-chart__pr-dot'
                        : 'progression-chart__dot'
                    }
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
