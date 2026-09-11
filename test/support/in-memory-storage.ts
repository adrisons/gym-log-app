/**
 * Re-exports the canonical in-memory `StoragePort` implementation under
 * its historical test-facing name. The class itself lives in
 * `src/infrastructure/in-memory-storage-adapter.ts` (spec 001) — moved out
 * of `test/support/` because `src/presentation/main.tsx` (the composition
 * root) needs a real, in-`src/`-layer adapter to wire, and `src/` must
 * never import from `test/`. Import from `test/support/` as before
 * (`test/support/index.ts` — the one documented location for shared test
 * doubles, FR-015); this file only re-points the name.
 */
export { InMemoryStorageAdapter as InMemoryStorage } from '../../src/infrastructure/in-memory-storage-adapter';
