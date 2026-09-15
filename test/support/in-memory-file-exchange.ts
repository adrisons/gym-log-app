/**
 * Re-exports the canonical in-memory `FileExchangePort` fake under a
 * test-facing name, mirroring `in-memory-storage.ts`'s own convention.
 * The class lives in `src/infrastructure/in-memory-file-exchange-adapter.ts`
 * (spec 006) — not under `test/support/` directly, for the same reason
 * `InMemoryStorageAdapter` isn't: `src/` must never import from `test/`.
 */
export {
  InMemoryFileExchangeAdapter as InMemoryFileExchange,
  type SavedFile,
} from '../../src/infrastructure/in-memory-file-exchange-adapter';
