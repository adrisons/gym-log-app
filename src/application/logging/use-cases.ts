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
import { newExerciseId } from '@/application/logging/ids';
import { matchExercise, normalize } from '@/shared/fuzzy-match';
import { renameExercise, deleteExercise } from '@/domain/exercise';
import type { Exercise } from '@/domain/exercise';
import type { Session } from '@/domain/session';
import type { ExerciseId, SessionId } from '@/domain/ids';
import type { Load } from '@/domain/load';
import type { Volume } from '@/domain/volume';
import type { Effort } from '@/domain/effort';

/**
 * Re-exported so `presentation/` can reference `Exercise` without
 * importing `domain/exercise` directly — `docs/architecture.md`'s table
 * does not allow `presentation` → `domain` (same precedent as
 * `application/index.ts` re-exporting `StorageError`: a plain data shape,
 * safe to pass through unlike a persistence type).
 */
export type { Exercise };
/** Re-exported for the same reason as `Exercise` above — `LoadTypePicker` (US3) needs `Load['kind']`. */
export type { Load };
/** Re-exported for the same reason — `ExerciseTemplatePanel` (ADR-0006) needs `Volume['kind']`. */
export type { Volume };
/** Re-exported for the same reason — `SetRow`'s `EditingSet` (ADR-0010) needs `Effort` for an already-recorded set's value. */
export type { Effort };
/** Re-exported for the same reason — `ExerciseCataloguePanel` (US4) needs `ExerciseId` for its `onMerge` callback. */
export type { ExerciseId };
/** Re-exported for the same reason — spec 004's diary/progression screens need `Session`/`SessionId`. */
export type { Session };
export type { SessionId };
/** Re-exported so `ExerciseSearchField` can check for an exact name/alias match the same accent/case-insensitive way `matchExercise` itself does, instead of a narrower ad hoc comparison. */
export { normalize };

/**
 * FR-001, FR-028 (ADR-0009). Opening the logging form never creates or
 * persists anything by itself: `draft` is always a brand-new, in-memory-
 * only `LoggingDraft` — the caller (the logging store) only writes it to
 * storage once the user's own first edit changes it. `pendingDraft` is
 * whatever draft is currently stored, if any — surfaced as the FR-028
 * recovery banner, never auto-loaded into `draft`. There is deliberately
 * no day-rollover auto-promotion any more: a `Session` is only ever
 * created by `registerWorkout`, below.
 */
export interface OpenLoggingFormResult {
  draft: LoggingDraft;
  pendingDraft: LoggingDraft | undefined;
}

export async function openLoggingForm(
  storage: StoragePort,
): Promise<OpenLoggingFormResult> {
  const now = new Date().toISOString();
  const pendingDraft = await storage.getDraft();
  return { draft: createDraft(now), pendingDraft };
}

/** FR-024, FR-028: discards the pending draft and its data. */
export async function discardDraft(storage: StoragePort): Promise<void> {
  await storage.discardDraft();
}

/**
 * FR-027 (ADR-0009): the one and only way a `Session` is created from the
 * logging screen. Converts `draft` to a real `Session` (`draftToSession`),
 * saves it, clears whatever draft is stored (there is at most one), and
 * returns a brand-new, in-memory-only draft for the caller to make its new
 * active one — the same "fresh, unpersisted" contract `openLoggingForm`
 * itself returns, so the screen is immediately ready for the next workout.
 *
 * The Session's id is `draft.id` itself (cast, not a fresh
 * `newSessionId()`) — deliberately, so this call is idempotent under
 * retry: `saveSession` is a plain upsert keyed by id in every adapter
 * (Copilot review, PR #25). If `saveSession` succeeds but the following
 * `discardDraft` fails (a real, if rare, local-storage failure), the
 * draft is left stored and could be recovered and registered again —
 * with a freshly-minted id, that would create a second, duplicate
 * `Session` for the same workout; keyed off the draft's own stable id
 * instead, a retry just re-saves the same `Session` record rather than
 * duplicating it.
 */
export async function registerWorkout(
  storage: StoragePort,
  draft: LoggingDraft,
): Promise<{ session: Session; draft: LoggingDraft }> {
  const session = draftToSession(draft, draft.id as SessionId);
  await storage.saveSession(session);
  await storage.discardDraft();
  return { session, draft: createDraft(new Date().toISOString()) };
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
  defaultVolumeKind?: Volume['kind'];
  trackEffort?: boolean;
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
    defaultLoadType: input.defaultLoadType ?? 'weight',
    defaultVolumeKind: input.defaultVolumeKind ?? 'reps',
    trackEffort: input.trackEffort ?? false,
    unilateral: input.unilateral ?? false,
    discipline: 'Strength',
  };
  await storage.saveExercise(exercise);
  return exercise;
}

export interface ExerciseTemplate {
  defaultLoadType: Load['kind'];
  defaultVolumeKind: Volume['kind'];
  trackEffort: boolean;
}

/**
 * Updates an exercise's set-entry template (load type, volume kind,
 * whether effort is tracked). Forward-only: every already-recorded `Set`
 * keeps exactly the load/volume/effort it was given — a `Set` stores
 * those independently of the exercise's template, so there is nothing to
 * reconcile or mark deprecated (ADR-0006). A no-op if the id doesn't
 * resolve.
 */
export async function updateExerciseTemplate(
  storage: StoragePort,
  exerciseId: ExerciseId,
  template: ExerciseTemplate,
): Promise<void> {
  const exercise = await storage.getExercise(exerciseId);
  if (!exercise) return;
  await storage.saveExercise({ ...exercise, ...template });
}

/**
 * FR-012: distinct Free text load values previously recorded for this
 * exercise, most-recent-session-first. Derived on read, not persisted
 * separately (research.md §8, `docs/development-principles.md` §4 —
 * "keep derived data rebuildable").
 */
export function suggestFreeTextLoads(
  exerciseId: ExerciseId,
  sessions: Session[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const byMostRecent = [...sessions].sort((a, b) =>
    a.dateTime < b.dateTime ? 1 : a.dateTime > b.dateTime ? -1 : 0,
  );
  for (const session of byMostRecent) {
    for (const block of session.blocks) {
      for (const entry of block.exercises) {
        if (entry.exerciseId !== exerciseId) continue;
        for (const set of entry.sets) {
          if (set.load.kind === 'freeText' && !seen.has(set.load.text)) {
            seen.add(set.load.text);
            result.push(set.load.text);
          }
        }
      }
    }
  }
  return result;
}

export type RenameExerciseResult =
  | { status: 'renamed'; exercise: Exercise }
  | { status: 'collision'; collidesWith: Exercise };

/**
 * FR-020, FR-022: renames a catalogue exercise. Detects a collision
 * (case/accent-insensitive, against every other exercise's name *and*
 * aliases) rather than rejecting silently or creating a duplicate —
 * returns `{ status: 'collision', collidesWith }` without renaming, so
 * the caller can offer a merge (Acceptance Scenario US4-3). Never
 * auto-merges.
 */
export async function renameExerciseWithCollisionCheck(
  storage: StoragePort,
  exerciseId: ExerciseId,
  newName: string,
): Promise<RenameExerciseResult> {
  const exercise = await storage.getExercise(exerciseId);
  if (!exercise) {
    throw new Error(
      `renameExerciseWithCollisionCheck: no Exercise with id ${exerciseId}.`,
    );
  }

  const normalizedNew = normalize(newName);
  const catalogue = await storage.listExercises();
  const collidesWith = catalogue.find(
    (candidate) =>
      candidate.id !== exerciseId &&
      [candidate.canonicalName, ...candidate.aliases].some(
        (name) => normalize(name) === normalizedNew,
      ),
  );
  if (collidesWith) {
    return { status: 'collision', collidesWith };
  }

  const renamed = renameExercise(exercise, newName);
  await storage.saveExercise(renamed);
  return { status: 'renamed', exercise: renamed };
}

/**
 * FR-017, FR-019: thin wrapper over `StoragePort.mergeExercises` — the
 * domain-local half (`mergeExerciseIdentities`) plus cross-session
 * reassignment already live at the port (spec 002's finalized split).
 */
export async function mergeExercises(
  storage: StoragePort,
  survivorId: ExerciseId,
  loserId: ExerciseId,
): Promise<void> {
  await storage.mergeExercises(survivorId, loserId);
}

/**
 * FR-018: deletes a catalogue exercise, cascading to its historical
 * entries/sets. Calls domain `deleteExercise` first — throws
 * `ExerciseDeleteConfirmationRequiredError` (unconfirmed + history),
 * without touching the port, so the caller can map that to the
 * confirm-or-merge dialog.
 */
export async function deleteExerciseCascade(
  storage: StoragePort,
  exerciseId: ExerciseId,
  hasHistory: boolean,
  confirmed: boolean,
): Promise<void> {
  deleteExercise(hasHistory, confirmed);
  await storage.deleteExerciseCascade(exerciseId);
}
