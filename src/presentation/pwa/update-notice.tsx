/**
 * FR-001-005/FR-018: a non-blocking notice that a new version has
 * downloaded and is ready to apply. Rendered once inside `AppShell` —
 * never `LoggingShell` — which is what keeps it off the logging screen
 * (`/log`) structurally (research.md §3). Never applies anything on its
 * own: `applyUpdate()` only ever runs from the user's own tap (FR-002/
 * FR-004, Principle II).
 */
import { useState } from 'react';
import { usePwaLifecycleStore } from '@/application/pwa-lifecycle-store';
import { useUnconfirmedEntryTracker } from '@/application/logging/unconfirmed-entry-tracker';
import './pwa.css';

export function UpdateNotice() {
  const updateAvailable = usePwaLifecycleStore((s) => s.updateAvailable);
  const applyUpdate = usePwaLifecycleStore((s) => s.applyUpdate);
  const hasUnconfirmedEntry = useUnconfirmedEntryTracker((s) => s.count > 0);
  // Local, not persisted (FR-004: declining never forces anything) — the
  // notice can reappear on the next screen visit; there is at most one
  // real update per running session anyway.
  const [laterTapped, setLaterTapped] = useState(false);

  if (!updateAvailable || hasUnconfirmedEntry || laterTapped) return null;

  return (
    <div className="pwa-banner" role="status" aria-label="Update available">
      <p className="pwa-banner__message">A new version is ready.</p>
      <div className="pwa-banner__actions">
        <button
          type="button"
          className="pwa-button pwa-button--primary"
          onClick={() => void applyUpdate()}
        >
          Update
        </button>
        <button
          type="button"
          className="pwa-button pwa-button--quiet"
          onClick={() => setLaterTapped(true)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
