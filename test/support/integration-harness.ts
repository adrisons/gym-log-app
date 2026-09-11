import type { StoragePort } from '../../src/application/ports/storage-port';
import { InMemoryStorage } from './in-memory-storage';

/**
 * The standard composition wiring for integration tests, with fakes
 * substituted at the seam a real composition root would fill with a real
 * adapter (spec 000 FR-016). A test that needs "the app, wired up, but with
 * a fake storage" calls this instead of rebuilding the wiring itself.
 *
 * PHASE 0: only the storage port is wired (there is nothing else to wire
 * yet). Later phases extend this as use cases and view-model stores exist.
 */
export interface Harness {
  storage: StoragePort;
}

export function createHarness(): Harness {
  return {
    storage: new InMemoryStorage(),
  };
}
