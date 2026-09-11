import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage } from '../../../support';
import { openLoggingForm, discardDraft } from '@/application/logging/use-cases';
import { createDraft } from '@/application/logging/draft';

// Foundational: openLoggingForm/discardDraft only. Every other use case in
// this file is added by later phases (US1/US3/US2/US4) — see tasks.md.

describe('openLoggingForm (FR-001, FR-024; research.md §4)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a new draft when no draft is stored, and does not save a Session (Acceptance Scenario 1)', async () => {
    vi.setSystemTime(new Date('2026-09-11T09:00:00.000Z'));
    const draft = await openLoggingForm(storage);
    expect(draft.blocks).toEqual([]);
    expect(await storage.getDraft()).toEqual(draft);
    expect(
      await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
    ).toEqual([]);
  });

  it('restores the stored draft unchanged when its lastEditedAt is today (Acceptance Scenario 2)', async () => {
    vi.setSystemTime(new Date('2026-09-11T09:00:00.000Z'));
    const existing = createDraft('2026-09-11T08:00:00.000Z');
    await storage.saveDraft(existing);

    const draft = await openLoggingForm(storage);

    expect(draft).toEqual(existing);
    expect(
      await storage.listSessions({ from: '2000-01-01', to: '2100-01-01' }),
    ).toEqual([]);
  });

  it('promotes a draft from an earlier local calendar day to a Session, then returns a brand-new draft (Acceptance Scenario 4)', async () => {
    const yesterday = createDraft('2026-09-10T20:00:00.000Z');
    await storage.saveDraft({ ...yesterday, lastEditedAt: yesterday.dateTime });

    vi.setSystemTime(new Date('2026-09-11T09:00:00.000Z'));
    const draft = await openLoggingForm(storage);

    expect(draft.id).not.toBe(yesterday.id);
    expect(draft.blocks).toEqual([]);
    expect(await storage.getDraft()).toEqual(draft);

    const sessions = await storage.listSessions({
      from: '2000-01-01',
      to: '2100-01-01',
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.dateTime).toBe(yesterday.dateTime);
  });
});

describe('discardDraft (FR-024, Acceptance Scenario 3)', () => {
  it('clears the stored draft; a subsequent openLoggingForm returns a new one, not the discarded one', async () => {
    const storage = new InMemoryStorage();
    const original = await openLoggingForm(storage);

    await discardDraft(storage);
    expect(await storage.getDraft()).toBeUndefined();

    const next = await openLoggingForm(storage);
    expect(next.id).not.toBe(original.id);
  });
});
