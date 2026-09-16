/**
 * `PwaLifecyclePort` — what the browser knows about this app's own
 * installed/installable state (`docs/requirements.md` FR-16;
 * `specs/009-pwa-installability-and-updates` contracts/pwa-lifecycle-port.md).
 * Covers both the service-worker update lifecycle and the install offer —
 * one port, not two, since both are the same underlying concern (Principle
 * IV: platform capabilities behind a port, never called directly from
 * `application`/`presentation`).
 *
 * Implemented for real by `infrastructure/pwa-lifecycle-adapter.ts`; a
 * test-only in-memory fake is `test/support/fakes/pwa-lifecycle-fake.ts`.
 */

export type InstallOfferKind = 'native' | 'manual' | 'unavailable';

export interface PwaLifecyclePort {
  /** True if this window is already running as the installed, standalone
   * app (FR-013). */
  isStandalone(): boolean;

  /** Registers a callback fired when a new service-worker version has
   * finished downloading and is waiting (FR-001). Returns an unsubscribe
   * function. Never fires for the version already running at launch
   * (FR-005) — only for one that becomes available afterward. */
  onUpdateAvailable(callback: () => void): () => void;

  /** Applies the pending update and reloads to it (FR-003). Only ever
   * called on explicit user action — never automatically (FR-002/FR-004). */
  applyUpdate(): Promise<void>;

  /** `'native' | 'manual' | 'unavailable'` (research.md §4) — decided by
   * feature detection, not by branching on the running platform. */
  installOfferKind(): InstallOfferKind;

  /** Registers a callback fired when `installOfferKind()`'s answer changes
   * (e.g. a `beforeinstallprompt` event arrives after initial load).
   * Returns an unsubscribe function. */
  onInstallOfferKindChange(
    callback: (kind: InstallOfferKind) => void,
  ): () => void;

  /** Triggers the native install flow (`installOfferKind() === 'native'`
   * only) from the caller's own user gesture (FR-011,
   * `docs/requirements.md` §7.5). Never called when `installOfferKind()`
   * is `'manual'` or `'unavailable'` — the manual case has no flow to
   * trigger; the caller shows static instructions instead (FR-012). */
  promptNativeInstall(): Promise<'accepted' | 'dismissed'>;

  /** Whether the user has permanently dismissed the install offer
   * (FR-014) — backed by a single `localStorage` key, deliberately
   * outside `StoragePort` (FR-016). */
  isInstallOfferDismissed(): boolean;

  /** Persists a permanent dismissal (FR-014). */
  dismissInstallOfferPermanently(): void;
}
