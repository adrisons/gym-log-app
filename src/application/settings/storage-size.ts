/**
 * FR-001-004: a whole-number KB/MB readout of everything the device's
 * `StoragePort` currently holds — Sessions, the Exercise catalogue,
 * Settings, and the pending logging draft if any, the same scope
 * `StoragePort.resetToFreshInstall`'s own doc comment describes for 006's
 * "delete everything" (spec.md Key Entities, Assumptions).
 *
 * Purely a read: no new `StoragePort` method (research.md §1) — every
 * record this figure covers is already reachable through the port's
 * existing `list*`/`get*` methods, computed fresh on every call rather
 * than cached (FR-004, Non-Goals: not a live byte counter).
 */
import type { StoragePort } from '../ports/storage-port';
import { allStoredDataRange } from '../date-range';

/**
 * Exact UTF-8 byte length of the JSON form of everything `storage` holds.
 * `TextEncoder` (not `JSON.stringify(x).length`, a UTF-16 code-unit count
 * that undercounts multi-byte characters — accented exercise names, emoji
 * in notes) gives the real byte count (research.md §1).
 */
export async function computeStorageSizeBytes(
  storage: StoragePort,
): Promise<number> {
  const [sessions, exercises, settings, draft] = await Promise.all([
    storage.listSessions(allStoredDataRange()),
    storage.listExercises(),
    storage.getSettings(),
    storage.getDraft(),
  ]);
  const snapshot = { sessions, exercises, settings, draft };
  return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}

/**
 * FR-002/FR-003: picks KB vs. MB from the exact (unrounded) byte count,
 * then rounds within that unit — never from an already-rounded integer,
 * so a value never displays as "1024 KB" (research.md §2). Never "0 KB"
 * for any `bytes > 0`.
 */
export function formatStorageSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${Math.round(kb / 1024)} MB`;
  }
  const kbRounded = Math.round(kb);
  if (kbRounded >= 1024) {
    // The one boundary FR-002 names explicitly: a value just under 1024 KB
    // (e.g. 1023.6) picks the KB unit above, but rounds up to 1024 — shown
    // as 1 MB instead of the forbidden "1024 KB".
    return '1 MB';
  }
  const displayValue = kbRounded === 0 && bytes > 0 ? 1 : kbRounded;
  return `${displayValue} KB`;
}

/** Convenience wrapper combining both steps for callers that just want
 * the final label (the presentation layer's only need). */
export async function computeStorageSizeLabel(
  storage: StoragePort,
): Promise<string> {
  return formatStorageSize(await computeStorageSizeBytes(storage));
}
