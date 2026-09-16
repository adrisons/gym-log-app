# Research: PWA Installability and Update Lifecycle

## 1. Update lifecycle: `registerType: 'prompt'`, not `'autoUpdate'`

**Discovery**: `vite.config.ts`'s `VitePWA({ registerType: 'autoUpdate' })`,
combined with `main.tsx`'s `registerSW({ immediate: true })`, is
`vite-plugin-pwa`'s own "silently activate and reload" mode — there is no
user-facing hook into that decision today.

**Decision**: change `registerType` to `'prompt'` in `vite.config.ts`. This
is `vite-plugin-pwa`'s other first-class mode: the generated `registerSW`
call's `onNeedRefresh` callback fires once a new version has finished
downloading and is waiting, and nothing is applied until the app itself
calls the `updateServiceWorker(reloadPage: boolean)` function `registerSW`
returns. This is a one-line config change to an already-approved tool
(`docs/stack.md`), not a new dependency, and is exactly the switch FR-001/
FR-003/FR-004 need: the notice (FR-001) is `onNeedRefresh` firing; applying
on demand (FR-003) is calling `updateServiceWorker(true)`; never forcing
(FR-004) is simply never calling it automatically.

**Where the call lives**: moved out of `main.tsx` into a new
`infrastructure/pwa-lifecycle-adapter.ts` (§4 below) — the plain,
non-React `virtual:pwa-register` module (not the `/react` hook variant),
so it fits this codebase's existing class-based port/adapter shape
(`PwaLifecyclePort`) instead of requiring a hook to run outside a
component. `registerSW()`'s return value and callbacks are ordinary
functions, so wrapping them in a class is direct.

**Periodic re-check while the app stays open**: `registerSW`'s
`onRegisteredSW(url, registration)` callback receives the live
`ServiceWorkerRegistration`; the adapter starts a 30-minute
`setInterval(() => registration.update(), ...)` there and clears it if the
registration is ever lost. Thirty minutes balances "a session long enough
to matter gets at least one check" against "don't poll needlessly" — the
spec's own Assumption leaves the exact number to this plan since it isn't
a user-facing guarantee.

**Alternatives considered**: keeping `autoUpdate` and adding a "just
reloaded" toast after the fact — rejected, it treats the symptom (no
notice) without fixing the actual Principle II risk (the reload already
happened, possibly mid-set, before any toast could appear). Hand-rolling
service-worker registration instead of `vite-plugin-pwa` — rejected,
`docs/stack.md` already names it for this exact concern and a second tool
for the same concern needs an ADR (`docs/stack.md` "Not without an ADR").

## 2. Deferring the notice: reusing the add/edit-set form's own Confirm state

**Discovery**: the state FR-002/FR-018 need to protect — an add/edit-set
row with at least one field filled but its Confirm control
(`docs/requirements.md` D17/ADR-0010) not yet tapped — lives as local
component state inside `src/presentation/logging/set-row.tsx`
(`canConfirm`), not in any shared store `AppShell` (where the notice
renders, §3 below) could otherwise read.

**Decision**: a new, small, focused Zustand store,
`application/logging/unconfirmed-entry-tracker.ts`, holding a single
ref-count (`count: number`) with `increment()`/`decrement()` and a derived
`hasUnconfirmedEntry(): boolean`. `SetRow` calls `increment()` the moment
its own `canConfirm`-relevant fields go from empty to holding a value, and
`decrement()` on Confirm, Cancel, or unmount while still non-empty. A
count (not a boolean) is used because more than one exercise's add-set row
can plausibly be open at once (different blocks); the update notice only
needs "is at least one unconfirmed row open anywhere," which a count
answers correctly without tracking *which* row.

**Rationale**: keeps `PwaLifecyclePort`/its adapter completely unaware of
the logging screen's component structure (Principle IV/V — a port must not
know about a specific form component), while still letting the
presentation-layer notice component (§3) combine two independent signals
(`update available` from the PWA store, `has unconfirmed entry` from this
tracker) with a plain `&&`.

**Alternatives considered**: putting this flag on `logging-store.ts`
directly — rejected, that store already models the durable pending draft
(FR-024) and its own actions; overloading it with a transient,
per-keystroke UI flag would blur a distinction the spec (Assumptions) is
explicit about keeping separate. Passing a callback prop down from
`AppShell` into the logging route — impossible, `LoggingShell` and
`AppShell` are siblings in the route tree (`main.tsx`), not parent/child.

## 3. Where the two notices render: inside `AppShell`, never `LoggingShell`

**Discovery**: `src/presentation/app-shell.tsx` already defines two
separate shells: `AppShell` (every non-logging route, with `HeaderNav`) and
`LoggingShell` (`/log` only, no `HeaderNav`) — established by ADR-0009,
unchanged since.

**Decision**: both new presentation components —
`presentation/pwa/update-notice.tsx` (FR-001-005) and
`presentation/pwa/install-offer.tsx` (FR-010-015) — are rendered once,
directly inside `AppShell`, never inside `LoggingShell`. This satisfies
FR-018 structurally rather than with a runtime route check: the logging
screen's component tree simply never includes them, so there is no `if
(route === '/log')` to keep in sync as routes change.

**Rationale**: reuses an existing, already-reviewed architectural seam
instead of adding a new one; a route-based conditional inside a single
shared shell would be strictly more code for the same guarantee, and one
more place a future route change could silently break FR-018.

## 4. `PwaLifecyclePort`: a new application-layer port

**Decision**: `application/ports/pwa-lifecycle.ts` defines
`PwaLifecyclePort` (contracts/pwa-lifecycle-port.md), covering both the
update lifecycle and the install offer — one port, not two, because both
are "browser tells this app something about its own installed/installable
state," the same natural grouping `docs/requirements.md` FR-16 itself
already treats as one feature. `infrastructure/pwa-lifecycle-adapter.ts`
implements it for real (`virtual:pwa-register`'s `registerSW`,
`beforeinstallprompt`/`appinstalled` window events, `matchMedia
('(display-mode: standalone)')`/`navigator.standalone` for standalone
detection); an in-memory fake (`test/support/fakes/pwa-lifecycle-fake.ts`)
implements it for tests, per Principle IV. A new
`application/pwa-lifecycle-store.ts` Zustand store (`configure(port)`
pattern, mirroring `settings-store.ts`) is the one thing `update-notice.tsx`/
`install-offer.tsx` actually read.

**Install-offer-dismissed preference (FR-016)**: stored by the
infrastructure adapter directly in `localStorage`, not through
`StoragePort` — deliberately outside every adapter export/import touches,
which is what makes FR-016's "never carried by export/import" true by
construction rather than by a filtering rule someone could forget to keep
in export/import's own code. `PwaLifecyclePort` exposes
`isInstallOfferDismissed(): boolean` / `dismissInstallOfferPermanently():
void` so the store/component never touches `localStorage` directly
(Principle IV).

**Native vs. manual install offer, and "unavailable" (FR-011/012, Edge
Cases)**: the adapter classifies the platform once, at construction, into
`'native' | 'manual' | 'unavailable'`:
- `'native'`: a `beforeinstallprompt` event was captured (Chromium-family
  browsers that support it).
- `'manual'`: no `beforeinstallprompt` support, but `'standalone' in
  navigator` — the actual, narrow feature-detection for "this is Safari on
  iOS/iPadOS," which is also the one platform-family with its own
  documented manual "Add to Home Screen" flow worth writing copy for.
- `'unavailable'`: neither of the above (e.g. desktop Firefox, which has
  no install flow and no home-screen equivalent) — the offer never
  renders, matching the spec's own Edge Case for "a rare or non-standard
  browser."

`isStandalone()` — `matchMedia('(display-mode: standalone)').matches ||
navigator.standalone === true` — gates FR-013 (never shown once already
installed) independently of which of the three kinds above applies.

**Alternatives considered**: a generic user-agent string match to decide
native vs. manual — rejected in favor of feature detection
(`beforeinstallprompt` support, `'standalone' in navigator`), the same
discipline `select-adapter.ts` already uses for the storage adapter choice
and that `docs/requirements.md` §7.5 implicitly expects (capability
checks, not UA sniffing).

## 5. Storage status (FR-006-009) and the re-permission flow (FR-017)

**Decision**: extend `StoragePort` (mirroring how spec 006 already
extended it for Settings/bulk-write) with two methods,
`getStorageStatus(): Promise<StorageStatus>` and
`reconfirmFileSystemAccess(): Promise<void>` (contracts/
storage-port-additions.md). `StorageStatus` is a new small type
(`application/ports/storage-status.ts`, alongside `settings.ts`/
`logging-draft.ts`):

```ts
export type StorageStatus =
  | { kind: 'indexed-db' }
  | {
      kind: 'file-system';
      folderName: string | undefined; // undefined = no folder chosen yet
      permission: 'granted' | 'needs-reconfirmation';
    };
```

- **`FileSystemStorageAdapter.getStorageStatus()`**: reuses the existing
  `#tryDirectoryHandle()` path (never forces a picker, per FR-004a's
  established discipline) but must not let a lost-permission
  `StorageError` propagate the way `#assertPermission` normally throws for
  a *write* — a read-only status check catches that specific case and
  reports `permission: 'needs-reconfirmation'` instead. `folderName` is
  `handle.name` (the File System Access API's own display name for the
  handle — no name is invented or user-editable, per the spec's own
  Assumption) when a handle exists, `undefined` when none has been
  acquired yet (nothing saved since install).
- **`FileSystemStorageAdapter.reconfirmFileSystemAccess()`**: the one
  deliberate exception to "background code checks permission and never
  prompts" (`docs/requirements.md` §7.5) — it calls the cached handle's
  `requestPermission({ mode: 'readwrite' })`, which does show the browser's
  native permission dialog, but only because this method is only ever
  called from FR-017's Settings-screen button tap, i.e. from a live user
  gesture. Throws `StorageError` (existing `'permission-lost'` cause) if
  the handle is re-requested and still refused, so the Settings screen can
  say so.
- **`IndexedDbStorageAdapter`/`InMemoryStorageAdapter`**: `getStorageStatus()`
  returns `{ kind: 'indexed-db' }` for both — `InMemoryStorageAdapter` is
  test-only (ADR-0002) and never observed by a real user, so it mirrors
  the IndexedDB shape rather than inventing a third, user-facing-looking
  `kind`. `reconfirmFileSystemAccess()` is a no-op `Promise.resolve()` on
  both — there is nothing to reconfirm, and `StoragePort` already has
  precedent for a method some adapters implement as a trivial no-op.

**A new `application/storage-status-store.ts`** (Zustand,
`configure(storage)`/`load()`/`reconfirm()`, mirroring `settings-store.ts`
exactly) is what the new `storage-status-section.tsx` Settings section
(FR-006-009) actually reads — the section itself never imports a
`StoragePort` type directly (Principle V).

**Alternatives considered**: a brand-new `StorageStatusPort` instead of
extending `StoragePort` — rejected; the status being reported *is*
`StoragePort`'s own adapter identity and the same directory handle its
other methods already manage, so a second port would either duplicate
that handle-management or need to reach into the first port's internals
from outside, both worse than the two-method extension spec 006 already
set precedent for.

## 6. Testing approach

**Decision**: `test/contract/storage-adapter-contract.ts` gains cases for
`getStorageStatus`/`reconfirmFileSystemAccess`, run against all three
adapters (mirrors spec 006's own extension of that suite). The
`PwaLifecyclePort` fake is exercised by Vitest unit tests for
`pwa-lifecycle-store.ts` and the two new presentation components
(`@testing-library/react`) — install offer, update notice, each
component's rest/hover/active/focus/disabled states per
`docs/testing.md`/`docs/design.md` §5. One Playwright addition
(`test/e2e/pwa-lifecycle.contract.spec.ts`, Chromium only — WebKit has no
`beforeinstallprompt` to simulate and no real multi-version service-worker
deploy to test against in CI) drives a real `vite-plugin-pwa`-built
service worker through an update, using Chromium DevTools Protocol to
dispatch a synthetic `beforeinstallprompt` for the install-offer half —
the same "real browser API, jsdom can't do this" rationale spec 003's
storage-harness page and spec 006's file-picker tests already established.

**Manual-only checks**: iOS Safari's manual install-instructions copy
(no CI browser reproduces `'standalone' in navigator`'s real Safari
behavior faithfully) is verified once, manually, on a real device or
Safari Technology Preview, and recorded in quickstart.md — the same
disposition spec 006 gave SC-008's LLM-readability check.
