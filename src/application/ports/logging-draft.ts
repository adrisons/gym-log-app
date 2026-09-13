/**
 * `LoggingDraft`'s real shape (spec 001 Key Entities; data-model.md
 * "LoggingDraft"). Lives under `application/ports/`, not
 * `application/logging/`, purely so `storage-port.ts` can reference it
 * without an `application-ports` → `application` import, which the layer
 * rule forbids (`docs/architecture.md`'s table: `application-ports` may
 * import only `domain`) — `application/logging/draft.ts` imports this
 * type back (`application` → `application-ports` is allowed) and adds the
 * construction functions (`createDraft`/`draftToSession`) that belong at
 * the application layer, not the port.
 *
 * Mirrors `Session`/`Block`/`ExerciseEntry`/`Set` field-for-field plus one
 * addition per level: a draft-local `id`, needed for stable list keys and
 * for the undo stack to target one item unambiguously.
 */

import type { Volume } from '../../domain/volume';
import type { Load } from '../../domain/load';
import type { Effort } from '../../domain/effort';
import type { ExerciseId } from '../../domain/ids';

export interface DraftSet {
  id: string;
  volume?: Volume;
  load: Load;
  effort?: Effort;
  setKind: 'warmUp' | 'working' | 'toFailure';
  completed: boolean;
}

export interface DraftExerciseEntry {
  id: string;
  exerciseId: ExerciseId;
  notes: string;
  sets: DraftSet[];
}

export interface DraftBlock {
  id: string;
  name?: string;
  type: 'straightSets' | 'superset' | 'circuit';
  /** A target round count for the whole block (ADR-0008) — mirrors
   * `domain/block.ts`'s `Block.rounds` exactly, including its "unset
   * means not specified" semantics. */
  rounds?: number;
  exercises: DraftExerciseEntry[];
}

export interface LoggingDraft {
  id: string;
  /** ISO 8601, user-editable (FR-001). */
  dateTime: string;
  blocks: DraftBlock[];
  notes: string;
  overallFeeling?: Effort;
  durationSeconds?: number;
  /** ISO 8601, updated on every mutation — research.md §4. */
  lastEditedAt: string;
}
