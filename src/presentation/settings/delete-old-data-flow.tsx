/**
 * FR-005-012: "Delete old data" — a scoped, repeatable alternative to
 * `DeleteEverythingFlow`'s all-or-nothing reset. Follows that component's
 * own inline-confirmation shape (`role="alertdialog"`, `.settings-preview`/
 * `.settings-confirm-actions`), not a new dialog primitive
 * (research.md §5). Kept to one screen, no nested confirm step — FR-012's
 * "minimal text" is a single cutoff chooser, a live count, and two
 * actions.
 */
import { useEffect, useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { allStoredDataRange } from '@/application/date-range';
import {
  cutoffMonthsAgo,
  startOfDay,
} from '@/application/settings/retention-cutoff';
import type { Session } from '@/application/logging/use-cases';

type QuickOption = '1y' | '6m' | '3m';
type Choice = QuickOption | 'explicit' | undefined;

const QUICK_OPTIONS: { value: QuickOption; months: number; label: string }[] = [
  { value: '1y', months: 12, label: 'Older than 1 year' },
  { value: '6m', months: 6, label: 'Older than 6 months' },
  { value: '3m', months: 3, label: 'Older than 3 months' },
];

export interface DeleteOldDataFlowProps {
  /** Called once a deletion has landed, so the caller can refresh
   * whatever in-memory state still holds the pre-deletion snapshot
   * (mirrors `DeleteEverythingFlow`/`ImportFlow`'s own `onDataChanged`-style
   * callback). */
  onDeleted: () => void | Promise<void>;
}

function explicitDateCutoff(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : startOfDay(date);
}

export function DeleteOldDataFlow({ onDeleted }: DeleteOldDataFlowProps) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>(undefined);
  const [explicitDate, setExplicitDate] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [deletedCount, setDeletedCount] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!open) return;
    void requireStorage().listSessions(allStoredDataRange()).then(setSessions);
  }, [open]);

  const cutoff: Date | undefined =
    choice === 'explicit'
      ? explicitDateCutoff(explicitDate)
      : choice === undefined
        ? undefined
        : startOfDay(
            cutoffMonthsAgo(
              new Date(),
              QUICK_OPTIONS.find((o) => o.value === choice)?.months ?? 0,
            ),
          );

  const count =
    cutoff === undefined
      ? undefined
      : sessions.filter((s) => Date.parse(s.dateTime) < cutoff.getTime())
          .length;

  function openFlow() {
    setOpen(true);
    setChoice(undefined);
    setExplicitDate('');
    setError(undefined);
    setDeletedCount(undefined);
  }

  function cancel() {
    setOpen(false);
  }

  async function confirmDelete() {
    if (cutoff === undefined || !count) return;
    setDeleting(true);
    setError(undefined);
    try {
      const removed = await requireStorage().deleteSessionsBefore(
        cutoff.toISOString(),
      );
      setOpen(false);
      setDeletedCount(removed);
      await onDeleted();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong deleting old data.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="settings-button settings-button--danger"
        disabled={open}
        onClick={openFlow}
      >
        Delete old data…
      </button>

      {deletedCount !== undefined && (
        <p role="status" className="settings-message settings-message--success">
          Deleted {deletedCount} {deletedCount === 1 ? 'session' : 'sessions'}.
        </p>
      )}

      {open && (
        <div
          className="settings-preview"
          role="alertdialog"
          aria-label="Delete old data"
        >
          <fieldset className="settings-radio-group">
            <legend className="settings-field-label">Delete entries</legend>
            {QUICK_OPTIONS.map((option) => (
              <label key={option.value} className="settings-radio">
                <input
                  type="radio"
                  name="delete-old-data-cutoff"
                  checked={choice === option.value}
                  onChange={() => setChoice(option.value)}
                />
                {option.label}
              </label>
            ))}
            <label className="settings-radio">
              <input
                type="radio"
                name="delete-old-data-cutoff"
                checked={choice === 'explicit'}
                onChange={() => setChoice('explicit')}
              />
              Before date…
            </label>
          </fieldset>

          {choice === 'explicit' && (
            <input
              type="date"
              className="settings-field-input"
              aria-label="Cutoff date"
              value={explicitDate}
              onChange={(event) => setExplicitDate(event.target.value)}
            />
          )}

          {count !== undefined && (
            <p className="settings-field-label">
              {count} {count === 1 ? 'session' : 'sessions'} will be deleted.
            </p>
          )}

          {error && (
            <p role="alert" className="settings-message">
              {error}
            </p>
          )}

          <div className="settings-confirm-actions">
            <button
              type="button"
              className="settings-button settings-button--danger"
              disabled={!count || deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </button>
            <button
              type="button"
              className="settings-button"
              disabled={deleting}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
