import type {
  InstallOfferKind,
  PwaLifecyclePort,
} from '../application/ports/pwa-lifecycle';
import { registerSW } from 'virtual:pwa-register';

/** Non-standard but universally shipped by Chromium — no `lib.dom.d.ts`
 * declaration exists for it. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_OFFER_DISMISSED_KEY = 'gym-log:install-offer-dismissed';

/** How often an already-open tab re-checks for a new service-worker
 * version (research.md §1) — long enough not to poll needlessly, short
 * enough that a training session open for a while still gets one check. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Real `PwaLifecyclePort` implementation (spec 009). Two independent
 * halves, wired at construction:
 *
 * - **Update lifecycle**: wraps `virtual:pwa-register`'s plain
 *   (non-React) `registerSW`, called with `registerType: 'prompt'`
 *   (`vite.config.ts`) so a new version is downloaded and held, never
 *   auto-applied — `onNeedRefresh` is this port's `onUpdateAvailable`
 *   signal, `applyUpdate()` calls the `updateServiceWorker` function
 *   `registerSW()` returns.
 * - **Install offer**: listens for `beforeinstallprompt` (native flow
 *   available) and `appinstalled` (nothing left to offer); classifies
 *   the platform once via feature detection (`'standalone' in
 *   navigator` for iOS Safari's manual flow) rather than user-agent
 *   sniffing (research.md §4).
 */
export class PwaLifecycleAdapter implements PwaLifecyclePort {
  #updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
  readonly #updateSubscribers = new Set<() => void>();
  readonly #installKindSubscribers = new Set<
    (kind: InstallOfferKind) => void
  >();
  #installOfferKind: InstallOfferKind;
  #deferredPrompt: BeforeInstallPromptEvent | undefined;

  constructor() {
    this.#installOfferKind =
      'standalone' in navigator ? 'manual' : 'unavailable';

    this.#updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        for (const callback of this.#updateSubscribers) callback();
      },
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        setInterval(() => {
          void registration.update();
        }, UPDATE_CHECK_INTERVAL_MS);
      },
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.#deferredPrompt = event as BeforeInstallPromptEvent;
      this.#setInstallOfferKind('native');
    });
    window.addEventListener('appinstalled', () => {
      this.#deferredPrompt = undefined;
      this.#setInstallOfferKind('unavailable');
    });
  }

  #setInstallOfferKind(kind: InstallOfferKind): void {
    this.#installOfferKind = kind;
    for (const callback of this.#installKindSubscribers) callback(kind);
  }

  isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  onUpdateAvailable(callback: () => void): () => void {
    this.#updateSubscribers.add(callback);
    return () => this.#updateSubscribers.delete(callback);
  }

  async applyUpdate(): Promise<void> {
    await this.#updateServiceWorker?.(true);
  }

  installOfferKind(): InstallOfferKind {
    return this.#installOfferKind;
  }

  onInstallOfferKindChange(
    callback: (kind: InstallOfferKind) => void,
  ): () => void {
    this.#installKindSubscribers.add(callback);
    return () => this.#installKindSubscribers.delete(callback);
  }

  async promptNativeInstall(): Promise<'accepted' | 'dismissed'> {
    const event = this.#deferredPrompt;
    if (!event) return 'dismissed';
    // A captured `beforeinstallprompt` event can only be used once.
    this.#deferredPrompt = undefined;
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  }

  isInstallOfferDismissed(): boolean {
    return localStorage.getItem(INSTALL_OFFER_DISMISSED_KEY) === 'true';
  }

  dismissInstallOfferPermanently(): void {
    localStorage.setItem(INSTALL_OFFER_DISMISSED_KEY, 'true');
  }
}
