# Data Model: PWA Installability and Update Lifecycle

No canonical entity (`docs/requirements.md` §3.1) is added, changed, or
touched by this feature (Non-Goals; `schema-guardian` confirmed, see
spec.md checklist). Everything below is either fully derived/transient
(nothing to model as "data" beyond a TypeScript type) or one small,
non-canonical, device-local preference — the same category Settings, band
labels, and the logging draft already occupy (D14).

## StorageStatus (derived, not persisted)

```ts
// src/application/ports/storage-status.ts
export type StorageStatus =
  | { kind: 'indexed-db' }
  | {
      kind: 'file-system';
      /** Undefined = no folder chosen yet (nothing saved since install). */
      folderName: string | undefined;
      permission: 'granted' | 'needs-reconfirmation';
    };
```

- **Produced by**: `StoragePort.getStorageStatus()` (contracts/
  storage-port-additions.md), computed fresh on every call from whichever
  adapter is active — never written to disk/IndexedDB/localStorage by this
  feature.
- **Consumed by**: `application/storage-status-store.ts` →
  `presentation/settings/storage-status-section.tsx` (FR-006-009).
- **Validation rules**: `folderName`/`permission` are only meaningful when
  `kind === 'file-system'`; a `kind: 'indexed-db'` value never carries
  either (enforced by the discriminated union itself, not a runtime check).

## UpdateAvailability (transient, in-memory only)

Not a named type of its own — modeled as a single boolean field,
`updateAvailable`, on `application/pwa-lifecycle-store.ts`'s Zustand state,
flipped `true` by `PwaLifecyclePort`'s `onUpdateAvailable` callback firing
(FR-001) and reset to `false` the moment `applyUpdate()` (FR-003) is
called (the page reloads immediately after, so the reset is only
observable in the brief window before that reload actually happens).
Never persisted: a reload or reopen starts a fresh service-worker
registration cycle, which is itself FR-005's "already current at launch"
case.

## InstallOffer state (mostly transient; one persisted bit)

```ts
// application/pwa-lifecycle-store.ts's own state shape (not a port type —
// the port only exposes the primitives below)
interface InstallOfferState {
  /** 'unavailable' once already standalone (FR-013), regardless of kind. */
  kind: 'native' | 'manual' | 'unavailable';
  /** True once dismissed permanently (FR-014) — read via
   *  PwaLifecyclePort.isInstallOfferDismissed() at store-configure time. */
  dismissedPermanently: boolean;
  /** Resets to false on every fresh load/reload — "one visit"
   *  (spec.md Assumptions) is exactly this store's own lifetime. */
  dismissedThisVisit: boolean;
}
```

- **The one persisted field**: `dismissedPermanently`, stored by
  `infrastructure/pwa-lifecycle-adapter.ts` directly in a single
  `localStorage` key (`gym-log:install-offer-dismissed`, boolean-as-string)
  — deliberately never routed through `StoragePort`, which is what makes
  FR-016 ("MUST NOT be included in the export/import interchange file")
  true by construction: nothing in `application/data-transfer/` (spec
  006) ever reads `localStorage`, so there is no code path by which this
  bit could end up in an export, and no device's import can overwrite
  another device's copy of it.
- **Default**: `false` (not dismissed) — the same "defaults silently when
  absent" shape D14 already establishes for every other Settings-adjacent
  field.
- **No migration, no schema version**: a boolean in `localStorage`, read
  once at startup; there is nothing to migrate between app versions
  (a future version simply keeps reading the same key, defaulting to
  `false` if never set — including for every user who never saw this
  feature before it shipped).

## Relationship to existing entities

- **`docs/requirements.md` D17/ADR-0010's `SetConfirmControl` state**
  (referenced by FR-002/FR-018, tracked by the new
  `application/logging/unconfirmed-entry-tracker.ts`, research.md §2) is
  not owned by this feature — this feature only reads a ref-count derived
  from it. No change to `Set`, `ExerciseEntry`, or any logging-screen
  component's own validation rules (FR-019, `specs/001-log-a-session`).
- **`specs/003-persistence` FR-012a's `StorageError` with cause
  `'permission-lost'`** is reused as-is by `reconfirmFileSystemAccess()`'s
  failure path (research.md §5) — no new error type, no new `StorageError`
  cause.
