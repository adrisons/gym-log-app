/**
 * `Exercise entry` — one instance of a catalogue `Exercise` being trained
 * within a `Block` (`docs/requirements.md` §3.1; FR-004).
 *
 * References the catalogue `Exercise` by identifier, never by name
 * (FR-011) — renaming a catalogue exercise never breaks this reference.
 * Order within the block, and order of `Set`s within this entry, is list
 * position alone — no separate stored "order" field (FR-018).
 */

import type { ExerciseId } from './ids';
import type { Set } from './set';

export interface ExerciseEntry {
  exerciseId: ExerciseId;
  notes: string;
  sets: Set[];
}
