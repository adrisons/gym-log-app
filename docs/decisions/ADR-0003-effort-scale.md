# ADR-0003: Effort scale

**Date:** 2026-09-08 (revised 2026-09-09)
**Status:** Accepted

## Context

Sets need an optional effort rating. Common conventions in strength training
include RPE (Rate of Perceived Exertion, 1–10), RIR (Reps in Reserve), and
coarser "how hard did that feel" scales. Two forces pull in opposite
directions:

- Trend detection across sessions (`docs/requirements.md` §5.4) operates on
  daily e1RM values, not on effort — so effort resolution does not feed the
  progression maths.
- Effort is entered one-handed, mid-set, and is optional on every set. A
  scale the user has to think about is a scale they will skip.

An earlier revision of this decision stored RPE 1–10 in half-point steps and
offered RIR as an input mode converted on entry. In practice that is more
precision than a personal diary needs for an optional, self-reported field,
and the RIR↔RPE conversion added a second mental model for no downstream
benefit.

## Decision

Store effort as a single **integer level from 1 to 5**, as the canonical
value. There is no half-point resolution and no separate RIR input mode.

The scale's meaning is always shown in words alongside the number, never the
bare digit (`docs/requirements.md` §7.4, FR-4). The 1–5 labels are an
application/presentation concern, not a domain value, and can be reworded
without a schema migration.

## Consequences

**Positive**

- One number, one mental model. Nothing to convert, nothing to reconcile.
- A 1–5 scale is fast to enter with a single tap and is forgiving of the
  imprecision inherent in a self-reported, mid-workout rating.
- Effort stays fully optional and its absence never invalidates a set's load
  computations (§3.2).

**Negative**

- Coarser than RPE 1–10: two sets that felt "an 8" and "a 9" on the RPE
  scale may both land on the same 1–5 level. Acceptable, because effort does
  not drive any progression or insight computation in v1 — it is context for
  the user reading their own history, not an input to §5.
- Users who habitually think in RPE or RIR must map to the 1–5 level
  themselves; the app does not do that conversion.

**Neutral**

- The word labels for levels 1–5 live in the application layer and can
  change without touching persisted data.
- If a future version needs finer effort resolution for a new computation,
  widening the stored range is a schema change under §6 (version bump, ADR,
  migration) — the same bar as any other persisted-shape change.
