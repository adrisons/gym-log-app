/**
 * Hand-rolled, dependency-free fuzzy matching for the exercise catalogue
 * (research.md §3, FR-016). Deliberately not the library `docs/stack.md`
 * defers for FR-7 (diary search) — see research.md §3 for why the two
 * concerns are kept separate.
 *
 * Ranking, best first: exact > prefix > substring > bounded-typo. Exact,
 * prefix, and substring are checked against the whole candidate string
 * only (so a whole-name exact match always outranks a same-tier match
 * found only inside one word of a longer name). Typo tolerance is checked
 * against the whole string *and* each individual word, so a multi-word
 * name/alias still matches a single-word typo'd query (e.g. "squta"
 * against "Barbell squat").
 */

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );
  for (let i = 0; i < rows; i++) dp[i]![0] = i;
  for (let j = 0; j < cols; j++) dp[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[rows - 1]![cols - 1]!;
}

/** Lower is better; used both to rank and to cut off non-matches. */
const TIER_EXACT = 0;
const TIER_PREFIX = 1;
const TIER_SUBSTRING = 2;
const TIER_FUZZY = 3;

interface TierMatch {
  tier: number;
  distance: number;
}

function maxTypoDistance(query: string): number {
  return query.length < 5 ? 1 : 2;
}

function matchWholeString(
  query: string,
  target: string,
): TierMatch | undefined {
  if (query === target) return { tier: TIER_EXACT, distance: 0 };
  if (target.startsWith(query))
    return { tier: TIER_PREFIX, distance: target.length - query.length };
  if (target.includes(query))
    return { tier: TIER_SUBSTRING, distance: target.length - query.length };
  return undefined;
}

function matchFuzzy(query: string, target: string): TierMatch | undefined {
  const threshold = maxTypoDistance(query);
  const candidates = [target, ...target.split(/\s+/).filter(Boolean)];
  let best: TierMatch | undefined;
  for (const candidate of candidates) {
    const distance = levenshtein(query, candidate);
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { tier: TIER_FUZZY, distance };
    }
  }
  return best;
}

function bestMatch(query: string, target: string): TierMatch | undefined {
  return matchWholeString(query, target) ?? matchFuzzy(query, target);
}

function betterOf(
  a: TierMatch | undefined,
  b: TierMatch | undefined,
): TierMatch | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.tier !== b.tier) return a.tier < b.tier ? a : b;
  return a.distance <= b.distance ? a : b;
}

export interface FuzzyCandidate {
  name: string;
  aliases: string[];
}

/**
 * Ranks `candidates` against `query`, best match first, excluding
 * candidates with no match at all. Matches on `name` and every entry in
 * `aliases` (FR-016 — aliases are honoured by search), taking each
 * candidate's single best match across all of them.
 */
export function matchExercise<T extends FuzzyCandidate>(
  query: string,
  candidates: T[],
): T[] {
  const q = normalize(query);
  if (q === '') return [...candidates];

  const scored: { candidate: T; match: TierMatch }[] = [];
  for (const candidate of candidates) {
    let best: TierMatch | undefined;
    for (const text of [candidate.name, ...candidate.aliases]) {
      best = betterOf(best, bestMatch(q, normalize(text)));
    }
    if (best) scored.push({ candidate, match: best });
  }

  scored.sort((a, b) => {
    if (a.match.tier !== b.match.tier) return a.match.tier - b.match.tier;
    if (a.match.distance !== b.match.distance)
      return a.match.distance - b.match.distance;
    return a.candidate.name.localeCompare(b.candidate.name);
  });

  return scored.map((s) => s.candidate);
}
