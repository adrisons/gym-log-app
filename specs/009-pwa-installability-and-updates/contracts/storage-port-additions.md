# Contract: `StoragePort` additions

Two new methods on the existing `application/ports/storage-port.ts`
interface (mirrors how `specs/006-settings-data` added
`getSettings`/`saveSettings`/`importBulk`/`resetToFreshInstall` to the same
interface — no new port for this).

```ts
export interface StoragePort {
  // ...existing methods unchanged...

  /**
   * Read-only, derived description of which adapter (ADR-0002) is active
   * and, for the File System Access adapter, the chosen folder's display
   * name and whether its permission is still valid (FR-006-009). Never
   * triggers a picker or a permission prompt — mirrors every other read
   * method's FR-004a discipline. Never throws for the "permission lost"
   * case; that state is reported via the return value's `permission`
   * field, not a rejection.
   */
  getStorageStatus(): Promise<StorageStatus>;

  /**
   * Re-requests permission for the File System Access adapter's
   * already-chosen folder (FR-017) — the one deliberate exception to
   * "background code checks permission and never prompts"
   * (`docs/requirements.md` §7.5), since this method is only ever called
   * from a live user gesture (a Settings-screen button tap). Never offers
   * to choose a *different* folder (spec.md Non-Goals). A no-op,
   * resolving immediately, on the IndexedDB and in-memory adapters (there
   * is nothing to reconfirm). Rejects with `StorageError` (existing
   * `'permission-lost'` cause, `specs/003-persistence` FR-012a) if the
   * user declines the re-request.
   */
  reconfirmFileSystemAccess(): Promise<void>;
}
```

`StorageStatus` — new type, `application/ports/storage-status.ts`
(data-model.md):

```ts
export type StorageStatus =
  | { kind: 'indexed-db' }
  | {
      kind: 'file-system';
      folderName: string | undefined;
      permission: 'granted' | 'needs-reconfirmation';
    };
```

## Per-adapter behavior

| Adapter | `getStorageStatus()` | `reconfirmFileSystemAccess()` |
|---|---|---|
| `FileSystemStorageAdapter` | `{ kind: 'file-system', folderName: handle?.name, permission }` — resolves the handle without forcing a picker (existing `#tryDirectoryHandle`-style path); `permission` is `'needs-reconfirmation'` if the cached handle's `queryPermission` is not `'granted'`, `'granted'` otherwise; `folderName: undefined` if no handle has ever been acquired. | Calls the cached handle's `requestPermission({ mode: 'readwrite' })` from the caller's gesture; throws `StorageError('permission-lost')` if still refused. Throws (or is unreachable per the caller's own guard) if no handle was ever acquired — there is nothing to reconfirm access *to*. |
| `IndexedDbStorageAdapter` | `{ kind: 'indexed-db' }` | No-op, `Promise.resolve()`. |
| `InMemoryStorageAdapter` | `{ kind: 'indexed-db' }` (test-only fake; never observed by a real user — mirrors the IndexedDB shape rather than inventing a third user-facing `kind`). | No-op, `Promise.resolve()`. |

## Contract test additions

`test/contract/storage-adapter-contract.ts` (run against all three
adapters):

- `getStorageStatus()` never throws, even when the File System adapter's
  permission has been revoked (simulated the same way the existing
  permission-loss contract case already does).
- On a fresh `FileSystemStorageAdapter` instance with no prior write,
  `getStorageStatus()` returns `folderName: undefined`.
- After any write succeeds (a handle has been acquired),
  `getStorageStatus()` returns the handle's real `folderName` and
  `permission: 'granted'`.
- `reconfirmFileSystemAccess()` on `IndexedDbStorageAdapter`/
  `InMemoryStorageAdapter` resolves without error and changes nothing.
