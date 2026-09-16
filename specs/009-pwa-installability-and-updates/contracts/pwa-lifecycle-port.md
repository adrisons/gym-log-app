# Contract: `PwaLifecyclePort` (new)

`application/ports/pwa-lifecycle.ts` — a new application-layer port
(Principle IV), covering both the update lifecycle (FR-001-005/FR-018) and
the install offer (FR-010-018), since both are "what the browser knows
about this app's own installed/installable state," one natural concern
(research.md §4). Implemented for real by
`infrastructure/pwa-lifecycle-adapter.ts`; an in-memory fake
(`test/support/fakes/pwa-lifecycle-fake.ts`) is the test-only third
implementation, per Principle IV.

```ts
export type InstallOfferKind = 'native' | 'manual' | 'unavailable';

export interface PwaLifecyclePort {
  /** True if this window is already running as the installed, standalone
   *  app (FR-013). */
  isStandalone(): boolean;

  /** Registers a callback fired when a new service-worker version has
   *  finished downloading and is waiting (FR-001). Returns an
   *  unsubscribe function. Never fires for the version already running at
   *  launch (FR-005) — only for one that becomes available afterward. */
  onUpdateAvailable(callback: () => void): () => void;

  /** Applies the pending update and reloads to it (FR-003). Only ever
   *  called on explicit user action (FR-002/FR-004 — never called
   *  automatically by this port or its adapter). */
  applyUpdate(): Promise<void>;

  /** 'native' | 'manual' | 'unavailable' (research.md §4) — decided once,
   *  by feature detection, not by branching on the running platform. */
  installOfferKind(): InstallOfferKind;

  /** Registers a callback fired when `installOfferKind()`'s answer
   *  changes (e.g. a `beforeinstallprompt` event arrives after initial
   *  load). Returns an unsubscribe function. */
  onInstallOfferKindChange(callback: (kind: InstallOfferKind) => void): () => void;

  /** Triggers the native install flow (`installOfferKind() === 'native'`
   *  only) from the caller's own user gesture (FR-011,
   *  `docs/requirements.md` §7.5). Resolves 'accepted' | 'dismissed'.
   *  Never called when `installOfferKind()` is 'manual' or 'unavailable'
   *  — the manual case has no flow to trigger; the caller shows static
   *  instructions instead (FR-012). */
  promptNativeInstall(): Promise<'accepted' | 'dismissed'>;

  /** Whether the user has permanently dismissed the install offer
   *  (FR-014) — backed by a single `localStorage` key, deliberately
   *  outside `StoragePort` (FR-016, data-model.md). */
  isInstallOfferDismissed(): boolean;

  /** Persists a permanent dismissal (FR-014). */
  dismissInstallOfferPermanently(): void;
}
```

## Adapter behavior (`infrastructure/pwa-lifecycle-adapter.ts`)

- **Update lifecycle**: wraps `virtual:pwa-register`'s plain (non-React)
  `registerSW({ immediate: true, onNeedRefresh, onRegisteredSW })` —
  `onNeedRefresh` invokes every registered `onUpdateAvailable` callback;
  `applyUpdate()` calls the `updateServiceWorker(true)` function
  `registerSW()` returned. `onRegisteredSW` starts the 30-minute periodic
  `registration.update()` interval (research.md §1).
- **Install offer**: listens for `window`'s `beforeinstallprompt` (calls
  `event.preventDefault()` and caches the event, flips
  `installOfferKind()` to `'native'`, notifies
  `onInstallOfferKindChange` subscribers) and `appinstalled` (clears the
  cached event; `isStandalone()` also independently reflects reality via
  `matchMedia`). At construction, if no `beforeinstallprompt` support is
  detected synchronously and `'standalone' in navigator` is true, kind is
  `'manual'`; otherwise `'unavailable'` until/unless a `beforeinstallprompt`
  event actually arrives.
- **`promptNativeInstall()`**: calls the cached event's `.prompt()`, awaits
  `.userChoice`, returns its `outcome`; clears the cached event afterward
  either way (a `beforeinstallprompt` event can only be used once).

## Store: `application/pwa-lifecycle-store.ts`

Zustand, `configure(port: PwaLifecyclePort)` pattern (mirrors
`settings-store.ts`): on `configure`, subscribes to
`onUpdateAvailable`/`onInstallOfferKindChange`, reads
`isInstallOfferDismissed()` once, and exposes the state
`update-notice.tsx`/`install-offer.tsx` read (data-model.md's
`InstallOfferState` shape) plus `applyUpdate`/`promptNativeInstall`/
`dismissInstallOfferPermanently`/`dismissForThisVisit` (the last one is
pure in-store state, not persisted — research.md §4/spec.md Assumptions).

## Test fake

`test/support/fakes/pwa-lifecycle-fake.ts` — an in-memory `PwaLifecyclePort`
implementation whose test helpers (`fake.triggerUpdateAvailable()`,
`fake.triggerInstallOfferKind('native')`, `fake.simulateInstallChoice
('accepted')`) let component/unit tests drive every FR-001-018 scenario
without any real browser API.
