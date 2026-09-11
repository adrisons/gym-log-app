/**
 * Application use cases for the logging screen (data-model.md "Use
 * cases"). Each takes its `StoragePort` as a parameter (research.md §6)
 * rather than importing a concrete implementation — the composition root
 * is the only place that chooses one. Only `openLoggingForm`/`discardDraft`
 * live here in Foundational scope; every other export is added by a later
 * user-story phase (see this file's own history / tasks.md).
 */

import type {
  StoragePort,
  LoggingDraft,
} from '@/application/ports/storage-port';
import { createDraft, draftToSession } from '@/application/logging/draft';
import { newSessionId } from '@/application/logging/ids';

function isSameLocalDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * FR-001/FR-024; research.md §4. No stored draft → creates and persists a
 * fresh one. A stored draft still on today's local calendar day →
 * restored unchanged. A stored draft from an earlier local calendar day →
 * promoted to a real `Session` (`saveSession` + `discardDraft`), then a
 * brand-new draft is created and returned — this is what makes "opening
 * the logging form" always end in exactly one open draft.
 */
export async function openLoggingForm(
  storage: StoragePort,
): Promise<LoggingDraft> {
  const now = new Date().toISOString();
  const existing = await storage.getDraft();

  if (existing && isSameLocalDay(existing.lastEditedAt, now)) {
    return existing;
  }

  if (existing) {
    const session = draftToSession(existing, newSessionId());
    await storage.saveSession(session);
    await storage.discardDraft();
  }

  const draft = createDraft(now);
  await storage.saveDraft(draft);
  return draft;
}

/** FR-024, Acceptance Scenario 3: discards the draft and its data. */
export async function discardDraft(storage: StoragePort): Promise<void> {
  await storage.discardDraft();
}
