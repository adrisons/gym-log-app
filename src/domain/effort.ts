/**
 * `Effort` — a value object, a single canonical integer 1–5
 * (ADR-0003; `docs/requirements.md` §3.2; FR-009).
 *
 * A plain integer literal union — never wrapped, never a "none"/absent
 * variant. `Effort` itself has no equivalent to `Load`'s `none` variant;
 * optionality lives one level up, on `Set.effort?: Effort` (FR-022).
 */
export type Effort = 1 | 2 | 3 | 4 | 5;
