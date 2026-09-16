import type {
  InstallOfferKind,
  PwaLifecyclePort,
} from '../application/ports/pwa-lifecycle';

/**
 * Deterministic, inspectable `PwaLifecyclePort` fake (constitution
 * Principle IV: every port has an in-memory fake usable in tests — mirrors
 * `InMemoryFileExchangeAdapter`'s shape). Lives in `infrastructure/`, not
 * `test/support/`, for the same reason `InMemoryStorageAdapter` does:
 * `src/` must never import from `test/`.
 */
export class InMemoryPwaLifecycleAdapter implements PwaLifecyclePort {
  #standalone = false;
  #installOfferKind: InstallOfferKind = 'unavailable';
  #dismissedPermanently = false;
  #nextInstallChoice: 'accepted' | 'dismissed' = 'dismissed';
  readonly #updateSubscribers = new Set<() => void>();
  readonly #installKindSubscribers = new Set<
    (kind: InstallOfferKind) => void
  >();

  /** Number of times `applyUpdate()` has been called — tests assert on
   * this rather than a boolean so a spurious second call is visible. */
  applyUpdateCallCount = 0;
  /** Number of times `promptNativeInstall()` has been called. */
  promptNativeInstallCallCount = 0;

  isStandalone(): boolean {
    return this.#standalone;
  }

  /** Test control: simulates the app becoming/ceasing to be the installed,
   * standalone copy (e.g. after `promptNativeInstall()` resolves
   * `'accepted'`). */
  setStandalone(standalone: boolean): void {
    this.#standalone = standalone;
  }

  onUpdateAvailable(callback: () => void): () => void {
    this.#updateSubscribers.add(callback);
    return () => this.#updateSubscribers.delete(callback);
  }

  /** Test control: simulates a new service-worker version finishing its
   * download (FR-001). */
  triggerUpdateAvailable(): void {
    for (const callback of this.#updateSubscribers) callback();
  }

  async applyUpdate(): Promise<void> {
    this.applyUpdateCallCount += 1;
  }

  installOfferKind(): InstallOfferKind {
    return this.#installOfferKind;
  }

  /** Test control: simulates `beforeinstallprompt` arriving, the app
   * already being standalone at construction, or neither
   * (research.md §4). */
  setInstallOfferKind(kind: InstallOfferKind): void {
    this.#installOfferKind = kind;
    for (const callback of this.#installKindSubscribers) callback(kind);
  }

  onInstallOfferKindChange(
    callback: (kind: InstallOfferKind) => void,
  ): () => void {
    this.#installKindSubscribers.add(callback);
    return () => this.#installKindSubscribers.delete(callback);
  }

  /** Configures what the next `promptNativeInstall()` call resolves to. */
  setNextInstallChoice(choice: 'accepted' | 'dismissed'): void {
    this.#nextInstallChoice = choice;
  }

  async promptNativeInstall(): Promise<'accepted' | 'dismissed'> {
    this.promptNativeInstallCallCount += 1;
    return this.#nextInstallChoice;
  }

  isInstallOfferDismissed(): boolean {
    return this.#dismissedPermanently;
  }

  dismissInstallOfferPermanently(): void {
    this.#dismissedPermanently = true;
  }

  /** Test isolation: clears all state between tests. */
  reset(): void {
    this.#standalone = false;
    this.#installOfferKind = 'unavailable';
    this.#dismissedPermanently = false;
    this.#nextInstallChoice = 'dismissed';
    this.applyUpdateCallCount = 0;
    this.promptNativeInstallCallCount = 0;
    this.#updateSubscribers.clear();
    this.#installKindSubscribers.clear();
  }
}
