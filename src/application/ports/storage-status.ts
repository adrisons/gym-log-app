/**
 * `StorageStatus` — read-only, derived description of which of
 * `ADR-0002`'s two storage adapters is active on this device
 * (`docs/requirements.md` FR-16; `specs/009-pwa-installability-and-updates`
 * data-model.md). Never persisted — recomputed by `StoragePort
 * .getStorageStatus()` from whichever adapter is already wired at the
 * composition root.
 */
export type StorageStatus =
  | { kind: 'indexed-db' }
  | {
      kind: 'file-system';
      /** `undefined` = no folder chosen yet (nothing saved since install). */
      folderName: string | undefined;
      permission: 'granted' | 'needs-reconfirmation';
    };
