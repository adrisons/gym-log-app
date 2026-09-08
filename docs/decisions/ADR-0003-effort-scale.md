# ADR-0003: Effort scale

**Date:** 2026-09-08
**Status:** Accepted

## Context

Sets need an optional effort rating. Two common conventions exist in
strength training: RPE (Rate of Perceived Exertion, 1–10) and RIR (Reps in
Reserve). Trend detection across sessions (`docs/requirements.md` §5.4)
needs enough resolution to distinguish real change from noise, and storing
one fact in two places risks the two disagreeing.

## Decision

Store RPE on a 1–10 scale in half-point steps as the single canonical
value. RIR is offered as an input mode in settings (FR-4, FR-11); a value
entered as RIR is converted to RPE on entry and only the RPE value is
persisted.

## Consequences

**Positive**

- One source of truth per set; no risk of RPE/RIR disagreeing in storage.
- Half-point resolution is fine enough for the median-based trend
  comparison in §5.4 to be meaningful.
- Users who think in RIR are not forced to think in RPE; the conversion is
  transparent and one-directional at entry time.

**Negative**

- A user who prefers RIR sees their input immediately converted and cannot
  recover the exact RIR value later if the conversion mapping ever changes
  (no RIR history is kept, by design).

**Neutral**

- The RPE↔RIR conversion table is an application-layer concern, not a
  domain value; it can change without a schema migration since only RPE is
  persisted.
