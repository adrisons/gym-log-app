import { describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../../../support';
import { useLoggingSession } from '@/application/logging/logging-store';

// Foundational: `initialize` only. Undo-stack behavior is added by US2's
// tasks (T062) once deletion actions exist.

describe('useLoggingSession (research.md §5)', () => {
  it('starts with no draft and an empty undo stack', () => {
    const state = useLoggingSession.getState();
    expect(state.draft).toBeUndefined();
    expect(state.undoStack).toEqual([]);
  });

  it('initialize populates draft from openLoggingForm', async () => {
    const storage = new InMemoryStorage();
    await useLoggingSession.getState().initialize(storage);
    const state = useLoggingSession.getState();
    expect(state.draft).toBeDefined();
    expect(state.draft?.blocks).toEqual([]);
  });
});
