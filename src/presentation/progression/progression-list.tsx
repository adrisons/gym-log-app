/**
 * FR-014/020: one row per session, reverse chronological, with a
 * personal-record visual mark.
 */
import {
  formatEffort,
  formatLoad,
  formatVolume,
} from '@/application/logging/view-models';
import type { ProgressionListRow } from '@/application/progression/progression-series';
import './progression.css';

export interface ProgressionListProps {
  rows: ProgressionListRow[];
}

export function ProgressionList({ rows }: ProgressionListProps) {
  return (
    <ul className="progression-list">
      {rows.map((row) => (
        <li
          key={row.sessionId}
          className="progression-list__row"
          data-personal-record={row.isPersonalRecord || undefined}
        >
          <span>{new Date(row.dateTime).toLocaleDateString()}</span>
          <span>{row.bestSet ? formatLoad(row.bestSet.load) : '—'}</span>
          <span>{row.bestSet ? formatVolume(row.bestSet.volume) : '—'}</span>
          <span>
            {row.bestSet ? (formatEffort(row.bestSet.effort) ?? '—') : '—'}
          </span>
          <span>{row.setCount} sets</span>
          {row.isPersonalRecord && (
            <span
              className="progression-list__pr-badge"
              aria-label="Personal record"
            >
              PR
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
