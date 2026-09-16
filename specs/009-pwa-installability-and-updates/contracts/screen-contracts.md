# Contract: screens and components

## `presentation/settings/storage-status-section.tsx` (new, FR-006-009)

A new Settings section, added to `settings-screen.tsx` alongside the
existing five sections, reading `application/storage-status-store.ts`.

- **IndexedDB active**: renders a single line stating data is stored in
  the browser/app's own storage on this device (FR-008's "expected, not
  missing" framing — no error styling, no warning icon).
- **File System Access active, folder chosen, permission granted**:
  renders the folder name (FR-007).
- **File System Access active, no folder chosen yet**: renders that a
  folder will be chosen automatically the first time something is saved
  (User Story 2, Acceptance Scenario 4) — same visual weight as the
  IndexedDB case, not an error state.
- **File System Access active, permission needs reconfirmation**: renders
  the "access needs to be reconfirmed" message (FR-009) plus a button,
  "Reconnect folder access" (or equivalent copy), calling the store's
  `reconfirm()` action (→ `StoragePort.reconfirmFileSystemAccess()`,
  FR-017) — ships all six interaction states (`docs/design.md` §5): rest,
  hover, active/pressed, focus-visible, disabled (while the reconfirm call
  is in flight), and a stated reason if reconfirmation itself fails again.
- No control anywhere in this section lets the user pick a different
  folder (Non-Goals) — only reconfirm the existing one.

## `presentation/pwa/update-notice.tsx` (new, FR-001-005/FR-018)

Rendered once inside `AppShell` (research.md §3), never inside
`LoggingShell`.

- Renders nothing when `pwa-lifecycle-store`'s `updateAvailable` is false.
- When `updateAvailable` is true: renders a small, non-blocking, dismissible-
  by-scrolling-past (not a modal — `docs/design.md`'s interaction
  discipline) banner with an "Update" control calling `applyUpdate()` and
  a plain-language "later" affordance that just leaves the banner up
  (declining does nothing destructive, FR-004).
- Never renders while `application/logging/unconfirmed-entry-tracker.ts`'s
  `hasUnconfirmedEntry()` is true, even if `updateAvailable` is also true
  (FR-002) — re-evaluated reactively, so the banner appears the moment the
  in-progress entry resolves (Confirm or Cancel), without requiring another
  update event.

## `presentation/pwa/install-offer.tsx` (new, FR-010-018)

Rendered once inside `AppShell`, never inside `LoggingShell`.

- Renders nothing when `isStandalone()` is true, when
  `installOfferKind()` is `'unavailable'`, when
  `isInstallOfferDismissed()` is true, or when already dismissed for this
  visit (`dismissForThisVisit`, in-memory only).
- `installOfferKind() === 'native'`: renders an "Install" control calling
  `promptNativeInstall()`; on `'accepted'` or `'appinstalled'` firing, the
  offer disappears (via `isStandalone()` becoming true); on `'dismissed'`,
  behaves like any other decline (Edge Cases).
- `installOfferKind() === 'manual'`: renders static, plain-language
  instructions for that browser's own "Add to Home Screen" flow — no
  button that triggers anything, since there is nothing to trigger.
- Both kinds render a "Don't show again" control calling
  `dismissInstallOfferPermanently()` (FR-014) and an implicit "not now"
  (any navigation away, or a lighter dismiss control) that only sets
  `dismissForThisVisit` — never persisted (spec.md Assumptions).
- Ships all six interaction states for every control (`docs/design.md`
  §5).

## `settings-screen.tsx` (edit)

Adds `<StorageStatusSection />` after the existing `<BandLabelsSection
/>`/`<DataSection />` pair (or wherever `/speckit-implement` finds the most
coherent grouping — Settings, Data, and now Storage read naturally as
adjacent "about my data" sections). No change to the screen's existing
load/`dataVersion` remount mechanics — storage status is read-only and has
no import/delete-everything interaction to invalidate it.

## `app-shell.tsx` (edit)

Adds `<UpdateNotice />` and `<InstallOffer />` inside `AppShell`'s render
(e.g. between `HeaderNav` and `app-shell__content`, or wherever
`docs/design.md`'s layout guidance for a transient banner places it) —
`LoggingShell` is untouched (research.md §3).

## `main.tsx` (edit)

- Constructs `new PwaLifecycleAdapter()` in place of the current bare
  `registerSW({ immediate: true })` call at the bottom of the file;
  configures `usePwaLifecycleStore`/`useStorageStatusStore` alongside the
  existing `useStorageAccess`/`useSettingsStore`/`useFileExchangeAccess`
  `configure()` calls in `mount()`.
- No change to route definitions, `seedCatalogueIfEmpty`, or the
  logging-critical-path wiring.

## `vite.config.ts` (edit)

`registerType: 'autoUpdate'` → `registerType: 'prompt'` (research.md §1) —
the only change to this file.
