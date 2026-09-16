/**
 * Re-exports the canonical in-memory `PwaLifecyclePort` fake under a
 * test-facing name, mirroring `in-memory-file-exchange.ts`'s own
 * convention. The class lives in
 * `src/infrastructure/in-memory-pwa-lifecycle-adapter.ts` (spec 009) —
 * not under `test/support/` directly, for the same reason
 * `InMemoryStorageAdapter` isn't: `src/` must never import from `test/`.
 */
export { InMemoryPwaLifecycleAdapter as InMemoryPwaLifecycle } from '../../src/infrastructure/in-memory-pwa-lifecycle-adapter';
