/**
 * FR-015/016: delete everything — two sequential confirmations (the
 * second stating plainly that the action is irreversible), then an
 * atomic reset to exactly the seed catalogue and default Settings.
 */
import { useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { buildSeedCatalogue } from '@/application/catalogue/seed-exercises';

type FlowState =
  | 'idle'
  | 'confirm-first'
  | 'confirm-second'
  | 'deleting'
  | 'done'
  | { error: string };

export interface DeleteEverythingFlowProps {
  /** Called once `resetToFreshInstall` has landed — the caller refreshes
   * whatever in-memory state (Settings store, band labels, theme) still
   * holds the pre-reset snapshot (Copilot review, PR #31). */
  onDeleted: () => void | Promise<void>;
}

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong deleting your data.';
}

export function DeleteEverythingFlow({ onDeleted }: DeleteEverythingFlowProps) {
  const [state, setState] = useState<FlowState>('idle');

  async function deleteEverything(): Promise<void> {
    setState('deleting');
    try {
      await requireStorage().resetToFreshInstall(buildSeedCatalogue());
    } catch (error) {
      // Without this catch, a rejection (permission loss, quota, a
      // journal-write failure) leaves the UI stuck on "Deleting…" forever
      // as an unhandled rejection, silently implying success never
      // actually happened (Copilot review, PR #31).
      setState({ error: messageFor(error) });
      return;
    }
    setState('done');
    await onDeleted();
  }

  return (
    <div>
      <button
        type="button"
        className="settings-button settings-button--danger"
        disabled={state === 'deleting'}
        onClick={() => setState('confirm-first')}
      >
        Delete everything
      </button>

      {typeof state === 'object' && (
        <p role="alert" className="settings-message">
          {state.error}
        </p>
      )}

      {state === 'confirm-first' && (
        <div
          className="settings-preview"
          role="alertdialog"
          aria-label="Confirm deletion"
        >
          <p>
            This deletes every session, custom exercise, band label, and
            setting. Are you sure?
          </p>
          <div className="settings-confirm-actions">
            <button
              type="button"
              className="settings-button settings-button--danger"
              onClick={() => setState('confirm-second')}
            >
              Continue
            </button>
            <button
              type="button"
              className="settings-button"
              onClick={() => setState('idle')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === 'confirm-second' && (
        <div
          className="settings-preview"
          role="alertdialog"
          aria-label="Confirm deletion is irreversible"
        >
          <p>
            This cannot be undone. Everything will be permanently deleted and
            the exercise catalogue reset to its starter set.
          </p>
          <div className="settings-confirm-actions">
            <button
              type="button"
              className="settings-button settings-button--danger"
              onClick={() => void deleteEverything()}
            >
              Delete everything
            </button>
            <button
              type="button"
              className="settings-button"
              onClick={() => setState('idle')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === 'deleting' && <p role="status">Deleting…</p>}
      {state === 'done' && (
        <p role="status" className="settings-message settings-message--success">
          Everything has been deleted. The exercise catalogue is back to its
          starter set.
        </p>
      )}
    </div>
  );
}
