/**
 * The single documented location for shared test doubles (spec 000
 * FR-015). Import fakes and harnesses from here, not from their individual
 * files, so there is one place to look and one place to add the next one.
 */
export { InMemoryStorage } from './in-memory-storage';
export {
  InMemoryFileExchange,
  type SavedFile,
} from './in-memory-file-exchange';
export { InMemoryPwaLifecycle } from './in-memory-pwa-lifecycle';
export { createHarness } from './integration-harness';
export type { Harness } from './integration-harness';
