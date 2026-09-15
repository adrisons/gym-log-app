/**
 * FR-015/016: delete everything — two sequential confirmations (the
 * second stating plainly that the action is irreversible), then an
 * atomic reset to exactly the seed catalogue and default Settings.
 */
import { useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { buildSeedCatalogue } from '@/application/catalogue/seed-exercises';

type FlowState =
  'idle' | 'confirm-first' | 'confirm-second' | 'deleting' | 'done';

export function DeleteEverythingFlow() {
  const [state, setState] = useState<FlowState>('idle');

  async function deleteEverything(): Promise<void> {
    setState('deleting');
    await requireStorage().resetToFreshInstall(buildSeedCatalogue());
    setState('done');
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
