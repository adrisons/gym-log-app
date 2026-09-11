/**
 * Branded-id wrappers over `shared/id.ts`'s unbranded `newId()`
 * (research.md §2). Lives at the application layer, not `shared/`,
 * because it imports `domain/ids.ts`'s branded types — `shared` may
 * import nothing internal (`docs/architecture.md`'s table), so the brand
 * cast has to happen one layer out.
 */

import { newId } from '@/shared/id';
import type { SessionId, ExerciseId } from '@/domain/ids';

export function newSessionId(): SessionId {
  return newId() as SessionId;
}

export function newExerciseId(): ExerciseId {
  return newId() as ExerciseId;
}
