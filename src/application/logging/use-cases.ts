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
import { newSessionId, newExerciseId } from '@/application/logging/ids';
import { matchExercise } from '@/shared/fuzzy-match';
import type { Exercise } from '@/domain/exercise';
import type { Session } from '@/domain/session';
import type { ExerciseId } from '@/domain/ids';
import type { Load } from '@/domain/load';

/**
 * Re-exported so `presentation/` can reference `Exercise` without
 * importing `domain/exercise` directly — `docs/architecture.md`'s table
 * does not allow `presentation` → `domain` (same precedent as
 * `application/index.ts` re-exporting `StorageError`: a plain data shape,
 * safe to pass through unlike a persistence type).
 */
export type { Exercise };

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

interface ExerciseUsage {
  count: number;
  lastUsedAt: string | undefined;
}

function computeUsage(sessions: Session[]): Map<ExerciseId, ExerciseUsage> {
  const usage = new Map<ExerciseId, ExerciseUsage>();
  for (const session of sessions) {
    for (const block of session.blocks) {
      for (const entry of block.exercises) {
        const existing = usage.get(entry.exerciseId) ?? {
          count: 0,
          lastUsedAt: undefined,
        };
        const lastUsedAt =
          existing.lastUsedAt === undefined ||
          session.dateTime > existing.lastUsedAt
            ? session.dateTime
            : existing.lastUsedAt;
        usage.set(entry.exerciseId, {
          count: existing.count + entry.sets.length,
          lastUsedAt,
        });
      }
    }
  }
  return usage;
}

/**
 * FR-002, FR-016, SC-004. With an empty query, ranks by most-used then
 * most-recently-used (Acceptance Scenario US1-5), computed from `sessions`
 * — no separate stored usage field on `Exercise`. With a non-empty query,
 * ranks by match quality via `shared/fuzzy-match.ts` (typo/alias-tolerant,
 * FR-016) — usage is not blended into relevance ranking while actively
 * searching.
 */
export function searchExercises(
  query: string,
  catalogue: Exercise[],
  sessions: Session[],
): Exercise[] {
  const trimmed = query.trim();
  if (trimmed === '') {
    const usage = computeUsage(sessions);
    return [...catalogue].sort((a, b) => {
      const ua = usage.get(a.id) ?? { count: 0, lastUsedAt: undefined };
      const ub = usage.get(b.id) ?? { count: 0, lastUsedAt: undefined };
      if (ua.count !== ub.count) return ub.count - ua.count;
      const la = ua.lastUsedAt ?? '';
      const lb = ub.lastUsedAt ?? '';
      if (la !== lb) return lb.localeCompare(la);
      return a.canonicalName.localeCompare(b.canonicalName);
    });
  }
  const candidates = catalogue.map((exercise) => ({
    exercise,
    name: exercise.canonicalName,
    aliases: exercise.aliases,
  }));
  return matchExercise(trimmed, candidates).map((c) => c.exercise);
}

export interface CreateExerciseInput {
  canonicalName: string;
  aliases?: string[];
  movementPattern?: string;
  muscleGroups?: string[];
  defaultLoadType?: Load['kind'];
  unilateral?: boolean;
}

/** FR-002, FR-015: builds and saves a new catalogue Exercise. */
export async function createExercise(
  storage: StoragePort,
  input: CreateExerciseInput,
): Promise<Exercise> {
  const exercise: Exercise = {
    id: newExerciseId(),
    canonicalName: input.canonicalName,
    aliases: input.aliases ?? [],
    ...(input.movementPattern !== undefined
      ? { movementPattern: input.movementPattern }
      : {}),
    ...(input.muscleGroups !== undefined
      ? { muscleGroups: input.muscleGroups }
      : {}),
    defaultLoadType: input.defaultLoadType ?? 'none',
    unilateral: input.unilateral ?? false,
    discipline: 'Strength',
  };
  await storage.saveExercise(exercise);
  return exercise;
}
