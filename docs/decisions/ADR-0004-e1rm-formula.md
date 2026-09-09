# ADR-0004: e1RM formula is Epley

**Date:** 2026-09-09
**Status:** Accepted

## Context

D5 (`docs/requirements.md` §8) left the estimated-1RM formula open. Several
formulas exist (Epley, Brzycki, Lombardi, and others), each trading off
simplicity, explainability, and accuracy at different rep ranges.

## Decision

Use the Epley formula: `load × (1 + reps / 30)`, per §5.2 of
`docs/requirements.md`. Restricted to `Weight` loads and `Bodyweight` with a
numeric added load, and only for sets of 1 to 12 reps — outside that range
the estimate is not used.

## Consequences

**Positive**

- Simple, one-line formula a user can verify by hand — matches the "honest,
  explainable" product character (`docs/design.md` §1).
- Well-known in strength training; no unfamiliar methodology to explain.

**Negative**

- Epley's error grows at higher rep counts, which is why the rule caps its
  use at 12 reps rather than trying to correct for it.

**Neutral**

- D5 is closed by this ADR.
- The formula is surfaced in the app whenever the e1RM metric is tapped, per
  §5.2, so the user always sees which computation produced the number.
