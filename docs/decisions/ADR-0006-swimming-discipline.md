# ADR-0006: Swimming is the first discipline added beyond Strength

**Date:** 2026-09-12
**Status:** Accepted

## Context

D8 (`docs/requirements.md` §8) left open which exercise disciplines beyond
Strength (§1.4) are in scope, and when. The domain model was deliberately
generalized from the start so a second discipline would be additive: a
Set's `Volume` already distinguishes reps, duration and distance, and its
`Load` already has a `None` variant for work where load doesn't apply —
swimming (distance + time, no load) was named in §1.4 as the first
documented candidate precisely because it fits that shape with no rework.

The project owner was asked to choose a scope for closing D8, with four
options: swimming only; swimming and running together; a lighter
"training goal" tag (strength/speed/endurance) on existing Strength
exercises with no new discipline at all; or leaving D8 open and deferring
the whole question. Swimming and running share almost the same value-object
shape (distance + duration → a derived pace), which made "do both at once"
tempting, but it also means doing both at once is the largest single
change to ship before the extensibility claim in §1.4 has ever been
exercised for real.

## Decision

Close D8: **swimming is the first discipline added beyond Strength**,
targeted at v1.1 per `docs/requirements.md` §9, after Phase 6 (settings,
export/import — `specs/006-settings-data`) and sequenced alongside or
after Phase 7 (templates, FR-13) in `docs/agent-brief.md` §3 — exact
ordering between the two v1.1 items is decided when swimming's own spec is
picked up, not by this ADR.

Running is explicitly **not** decided by this ADR and stays open for its
own future decision. It is expected to be a comparatively small follow-up
once swimming's discipline machinery (the `discipline` field made a real
enum, a distance/duration-based progression metric, its own insight card
type, and the schema migration mechanics) has shipped and been proven —
but "expected to be small" is not the same as "decided," and running gets
its own scoping pass rather than being assumed in under this decision.

This is a persisted-format change (the `discipline` field on `Exercise`
stops being the fixed literal `'Strength'`), so per `docs/requirements.md`
§6 it ships with a schema version bump (1 → 2), its own migration
(existing exercises default to `Strength`), and a dedicated feature spec
(via `/speckit-specify`, per `docs/agent-brief.md` §3 and the constitution's
Development Workflow) before any implementation code — this ADR records
the scope decision, it does not itself specify the feature.

## Consequences

**Positive**

- Proves the extensibility §1.4 designed for, with the one discipline the
  requirements already anticipated and partially designed around —
  no new value-object shapes needed for `Volume`/`Load`.
- Smaller, single-discipline change is easier to review (`spec-reviewer`,
  `schema-guardian`) and to migrate correctly than shipping two disciplines
  in the same schema bump.
- Once shipped, adding running is expected to reuse most of swimming's
  machinery (distance/duration progression, pace-style derived metrics),
  making it a lower-risk follow-up decision later.

**Negative**

- Running support is delayed relative to shipping both at once; a user who
  wants running-specific insights sooner does not get them from this ADR.
- Two discipline-adding schema bumps (swimming now, running later if and
  when decided) instead of one, if running is in fact decided later — more
  total migrations than the combined option would have needed.

**Neutral**

- D8 is closed by this ADR, scoped to swimming only. A future ADR is
  needed to decide running (or any other discipline) — this ADR does not
  pre-approve it.
- The "training goal" (strength/speed/endurance) tagging idea raised
  alongside this decision was not chosen and is not addressed by this
  ADR; it remains an unrecorded idea, not a rejected one, and can be
  proposed again on its own terms.
- Swimming's own computation rule (§5), data-sufficiency threshold (§5.7),
  and insight card type are defined in its feature spec, not here.
