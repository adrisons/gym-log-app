/**
 * `Session` — one dated training record (`docs/requirements.md` §3.1;
 * FR-002).
 *
 * No open/closed lifecycle state (revised per D6, §8). A `Session` with
 * zero `Block`s is a valid domain state (FR-017).
 */

import type { Block } from './block';
import type { Effort } from './effort';
import type { SessionId } from './ids';

export interface Session {
  id: SessionId;
  /** ISO 8601 date-time, fixed at creation (spec 001 FR-001). */
  dateTime: string;
  blocks: Block[];
  notes: string;
  overallFeeling?: Effort;
  durationSeconds?: number;
}

/**
 * The only supported way to produce a `Session` value. Accepts an empty
 * `blocks` list (FR-017).
 */
export function createSession(session: Session): Session {
  return session;
}
