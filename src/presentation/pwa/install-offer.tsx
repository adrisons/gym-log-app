/**
 * FR-010-018: an offer to install the app, native on Chromium
 * (`beforeinstallprompt`) and instructional on iOS Safari (no such event
 * exists there). Rendered once inside `AppShell` — never `LoggingShell`
 * (research.md §3). Never shown once already standalone (FR-013), once
 * permanently dismissed (FR-014), or when the platform offers no install
 * path at all (`installOfferKind() === 'unavailable'`).
 */
import { usePwaLifecycleStore } from '@/application/pwa-lifecycle-store';
import './pwa.css';

export function InstallOffer() {
  const isStandalone = usePwaLifecycleStore((s) => s.isStandalone);
  const installOfferKind = usePwaLifecycleStore((s) => s.installOfferKind);
  const dismissedPermanently = usePwaLifecycleStore(
    (s) => s.installOfferDismissedPermanently,
  );
  const dismissedThisVisit = usePwaLifecycleStore(
    (s) => s.installOfferDismissedThisVisit,
  );
  const promptNativeInstall = usePwaLifecycleStore(
    (s) => s.promptNativeInstall,
  );
  const dismissPermanently = usePwaLifecycleStore(
    (s) => s.dismissInstallOfferPermanently,
  );
  const dismissForThisVisit = usePwaLifecycleStore(
    (s) => s.dismissInstallOfferForThisVisit,
  );

  if (
    isStandalone ||
    installOfferKind === 'unavailable' ||
    dismissedPermanently ||
    dismissedThisVisit
  ) {
    return null;
  }

  return (
    <div className="pwa-banner" role="status" aria-label="Install this app">
      <p className="pwa-banner__message">
        {installOfferKind === 'native'
          ? 'Install this app for offline, one-tap access.'
          : 'Add this app to your Home Screen: tap Share, then "Add to Home Screen".'}
      </p>
      <div className="pwa-banner__actions">
        {installOfferKind === 'native' && (
          <button
            type="button"
            className="pwa-button pwa-button--primary"
            onClick={() => void promptNativeInstall()}
          >
            Install
          </button>
        )}
        <button
          type="button"
          className="pwa-button pwa-button--quiet"
          onClick={dismissForThisVisit}
        >
          Not now
        </button>
        <button
          type="button"
          className="pwa-button pwa-button--quiet"
          onClick={dismissPermanently}
        >
          Don&rsquo;t show again
        </button>
      </div>
    </div>
  );
}
