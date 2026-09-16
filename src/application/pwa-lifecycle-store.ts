/**
 * The PWA lifecycle view-model store (spec 009 FR-001-018) — Zustand,
 * `configure(port)` pattern mirroring `settings-store.ts`. Combines two
 * concerns from one `PwaLifecyclePort`: the update notice (`updateAvailable`)
 * and the install offer (`installOfferKind`/dismissal state) — both are
 * read by `presentation/pwa/update-notice.tsx`/`install-offer.tsx`.
 */
import { create } from 'zustand';
import type { InstallOfferKind, PwaLifecyclePort } from './ports/pwa-lifecycle';

interface PwaLifecycleState {
  port: PwaLifecyclePort | undefined;
  updateAvailable: boolean;
  installOfferKind: InstallOfferKind;
  isStandalone: boolean;
  /** Persisted (FR-014), read from the port at `configure()` time. */
  installOfferDismissedPermanently: boolean;
  /** In-memory only (spec.md Assumptions: a "visit" is this store's own
   * lifetime — a reload starts a fresh one). */
  installOfferDismissedThisVisit: boolean;
  configure: (port: PwaLifecyclePort) => void;
  applyUpdate: () => Promise<void>;
  promptNativeInstall: () => Promise<'accepted' | 'dismissed'>;
  dismissInstallOfferPermanently: () => void;
  dismissInstallOfferForThisVisit: () => void;
}

export const usePwaLifecycleStore = create<PwaLifecycleState>((set, get) => ({
  port: undefined,
  updateAvailable: false,
  installOfferKind: 'unavailable',
  isStandalone: false,
  installOfferDismissedPermanently: false,
  installOfferDismissedThisVisit: false,

  configure: (port) => {
    set({
      port,
      installOfferKind: port.installOfferKind(),
      isStandalone: port.isStandalone(),
      installOfferDismissedPermanently: port.isInstallOfferDismissed(),
    });
    port.onUpdateAvailable(() => set({ updateAvailable: true }));
    port.onInstallOfferKindChange((kind) => set({ installOfferKind: kind }));
  },

  async applyUpdate() {
    const { port } = get();
    if (!port) return;
    await port.applyUpdate();
    set({ updateAvailable: false });
  },

  async promptNativeInstall() {
    const { port } = get();
    if (!port) return 'dismissed';
    const outcome = await port.promptNativeInstall();
    set({ isStandalone: port.isStandalone() });
    return outcome;
  },

  dismissInstallOfferPermanently() {
    const { port } = get();
    if (!port) return;
    port.dismissInstallOfferPermanently();
    set({ installOfferDismissedPermanently: true });
  },

  dismissInstallOfferForThisVisit() {
    set({ installOfferDismissedThisVisit: true });
  },
}));
