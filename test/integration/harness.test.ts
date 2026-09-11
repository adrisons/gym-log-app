import { describe, expect, it } from 'vitest';
import { createHarness } from '../support';
import type { SessionRecord } from '../../src/application/ports/storage-port';

// Spec 000 FR-016: proves the integration harness supplies the standard
// composition wiring (fakes substituted) without the test rebuilding it —
// a save-then-read through the harness's wired StoragePort.

describe('integration harness', () => {
  it('drives a save-then-read through the wired StoragePort', async () => {
    const { storage } = createHarness();

    const session: SessionRecord = {
      id: 's1',
      dateTime: '2026-09-10T18:00:00Z',
    };
    await storage.saveSession(session);

    await expect(storage.getSession('s1')).resolves.toEqual(session);
  });

  it('each harness instance is independent', async () => {
    const a = createHarness();
    const b = createHarness();

    await a.storage.saveSession({ id: 's1', dateTime: '2026-09-10T18:00:00Z' });

    await expect(b.storage.getSession('s1')).resolves.toBeUndefined();
  });
});
