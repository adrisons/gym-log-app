/**
 * FR-012: a fixed, versioned keyword mapping from free-text
 * `movementPattern` to "push," "pull," or "unclassified" — an
 * application-code constant, not a persisted field (spec.md
 * Assumptions). Whole-word match only, not a raw substring match (e.g.
 * "press" matches "close-grip bench press" but not "compression").
 */
import { normalize } from '@/shared/fuzzy-match';

export type PushPullClassification = 'push' | 'pull' | 'unclassified';

export const PUSH_KEYWORDS = [
  'push',
  'press',
  'horizontal push',
  'vertical push',
];
export const PULL_KEYWORDS = [
  'pull',
  'row',
  'horizontal pull',
  'vertical pull',
];

const NORMALIZED_PUSH = new Set(PUSH_KEYWORDS.map(normalize));
const NORMALIZED_PULL = new Set(PULL_KEYWORDS.map(normalize));

export function classifyMovementPattern(
  movementPattern: string | undefined,
): PushPullClassification {
  if (!movementPattern) return 'unclassified';

  const words = normalize(movementPattern).split(/\s+/).filter(Boolean);
  const normalizedWhole = normalize(movementPattern);

  // Multi-word keywords (e.g. "horizontal push") must match the whole
  // normalized pattern, not just one of its words, so a movementPattern
  // like "horizontal push" itself is checked against the full string too.
  if (
    NORMALIZED_PUSH.has(normalizedWhole) ||
    words.some((w) => NORMALIZED_PUSH.has(w))
  ) {
    return 'push';
  }
  if (
    NORMALIZED_PULL.has(normalizedWhole) ||
    words.some((w) => NORMALIZED_PULL.has(w))
  ) {
    return 'pull';
  }
  return 'unclassified';
}
