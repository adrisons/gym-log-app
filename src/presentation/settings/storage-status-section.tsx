/**
 * FR-006-009/FR-017: states which storage adapter (ADR-0002) is active on
 * this device and, for the File System Access adapter, the chosen
 * folder's name or a control to reconfirm a lost permission. Read-only
 * except for the reconfirm action — there is no control to pick a
 * different folder (spec.md Non-Goals).
 */
import { useEffect } from 'react';
import { useStorageStatusStore } from '@/application/storage-status-store';

export function StorageStatusSection() {
  const status = useStorageStatusStore((s) => s.status);
  const loaded = useStorageStatusStore((s) => s.loaded);
  const reconfirming = useStorageStatusStore((s) => s.reconfirming);
  const reconfirmError = useStorageStatusStore((s) => s.reconfirmError);
  const load = useStorageStatusStore((s) => s.load);
  const reconfirm = useStorageStatusStore((s) => s.reconfirm);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="settings-section" aria-label="Storage">
      <h2>Storage</h2>
      {!loaded || !status ? null : status.kind === 'indexed-db' ? (
        <p className="settings-field-label">
          Your data is stored in this browser/app&rsquo;s own storage on this
          device.
        </p>
      ) : status.folderName === undefined ? (
        <p className="settings-field-label">
          A folder will be chosen automatically the first time you save
          something.
        </p>
      ) : status.permission === 'granted' ? (
        <p className="settings-field-label">
          Your data is stored in the folder &ldquo;{status.folderName}
          &rdquo; on this device.
        </p>
      ) : (
        <>
          <p className="settings-field-label">
            Access to your data folder (&ldquo;{status.folderName}&rdquo;) needs
            to be reconfirmed.
          </p>
          <button
            type="button"
            className="settings-button settings-button--primary"
            disabled={reconfirming}
            onClick={() => void reconfirm()}
          >
            {reconfirming ? 'Reconnecting…' : 'Reconnect folder access'}
          </button>
          {reconfirmError && (
            <p className="settings-field-label" role="alert">
              {reconfirmError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
