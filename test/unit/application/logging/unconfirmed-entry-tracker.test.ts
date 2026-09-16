import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasUnconfirmedEntry,
  useUnconfirmedEntryTracker,
} from '@/application/logging/unconfirmed-entry-tracker';

describe('unconfirmed-entry-tracker (spec 009 FR-002/FR-018)', () => {
  beforeEach(() => {
    useUnconfirmedEntryTracker.setState({ count: 0 });
  });

  it('starts at zero — no unconfirmed entry', () => {
    expect(hasUnconfirmedEntry()).toBe(false);
  });

  it('increment/decrement is a ref-count, not a boolean', () => {
    const { increment, decrement } = useUnconfirmedEntryTracker.getState();

    increment();
    increment();
    expect(hasUnconfirmedEntry()).toBe(true);

    decrement();
    expect(hasUnconfirmedEntry()).toBe(true); // still one open

    decrement();
    expect(hasUnconfirmedEntry()).toBe(false);
  });

  it('never goes negative on an unbalanced decrement', () => {
    useUnconfirmedEntryTracker.getState().decrement();
    expect(useUnconfirmedEntryTracker.getState().count).toBe(0);
  });
});
