# ADR-0006: Exercise set-entry template, and why changing it never touches history

**Date:** 2026-09-12
**Status:** Accepted

## Context

The logging screen's set-entry form originally showed every possible
control at once: a five-way load-type picker (Weight/Band/Bodyweight/Free
text/None), a three-way volume-kind picker (Reps/Duration/Distance), and an
always-visible effort control — regardless of what a given exercise
actually needs. Design review feedback asked for the common case (weight +
reps) to be the whole form by default, with the rest reachable only when an
exercise actually needs them.

This requires each catalogue `Exercise` to remember more than just
`defaultLoadType` (already persisted, schema v1): which volume kind it
uses, and whether effort is tracked at all. Adding persisted fields to a
domain entity is a schema change under `docs/requirements.md` §6 (version
bump, ADR, migration) — this document is that ADR.

The open design question was what happens to a exercise's **history** when
its template changes — e.g. switching an exercise from Reps to Duration.
The alternatives considered:

1. **Reconcile**: attempt to convert or re-tag every past `Set` to match
   the new template.
2. **Deprecate**: flag past sets recorded under the old template as
   stale/deprecated.
3. **Forward-only, no reconciliation**: the template only decides what a
   *new* set defaults to; every already-recorded `Set` keeps exactly what
   it was given.

## Decision

**Forward-only (option 3).** Extend `Exercise` with two fields:

- `defaultVolumeKind: Volume['kind']` — mirrors the existing
  `defaultLoadType: Load['kind']` exactly.
- `trackEffort: boolean` — whether the effort control appears at all for
  this exercise's sets.

Changing either (or `defaultLoadType`) through the exercise's own "edit
template" action only changes what a *new* set of that exercise pre-selects
and which controls are offered. It never rewrites, reconciles, or flags any
already-recorded `Set`.

This isn't a compromise — it's already how the domain works. `Set` stores
its own `load` and `volume` independently or every set
(`docs/requirements.md` §3.2), and FR-3 already allowed a load type to be
"overridden per set" — meaning the domain has never guaranteed that every
set of an exercise shares one shape. Progression and insights already
degrade honestly per set/metric when load kinds don't match what a
computation needs (FR-8: "for band or free-text loads the app shows no
estimated 1RM ... and explains ... why"). A template change is just a new
UI entry point onto a rule that already existed: "units are stored exactly
as entered" (§3.3) already meant nothing about a past `Set` was ever going
to change because of a later catalogue edit — the same as renaming an
exercise never rewrites its history's exercise name in place, only the
live catalogue entry.

Reconciling or deprecating past sets was rejected: there is nothing to
reconcile (each `Set` is already self-describing), and a "deprecated" flag
would be new domain state invented solely to describe data that was never
actually invalid — it just used a different template than the exercise
happens to use now.

The UI still warns before changing a template: not because data is at
risk, but because the change affects every future set of that exercise
until changed again, which is worth a beat of confirmation.

## Consequences

**Positive**

- No migration risk to historical data — a template change is a pure
  forward-looking write to one `Exercise` record.
- Consistent with existing invariants (§3.3 "units stored exactly as
  entered", FR-3's per-set override) rather than adding a new one.
- The migration this ADR does need (backfilling the two new fields onto
  already-stored exercises) is trivial and additive: safe defaults
  (`defaultVolumeKind: 'reps'`, `trackEffort: false`) for every pre-existing
  exercise, matching what the set-entry form already showed by default
  before this change.

**Negative**

- A user who wants to see effort trends across an exercise's *entire*
  history, having only just turned tracking on, gets no historical effort
  data to look back on — because none was ever recorded (effort was
  always optional; turning `trackEffort` on doesn't retroactively invent
  values). This is the same limitation as any optional field always had.
- Two sets of the same exercise, recorded under different templates
  (e.g. one Weight+Reps, a later one Weight+Duration), can coexist in
  history. Progression already has to handle this — same honest-degradation
  path as mixed load kinds.

**Neutral**

- `defaultVolumeKind`/`trackEffort` follow `defaultLoadType`'s own
  precedent exactly: a live, mutable field on the catalogue entry, not a
  versioned or historized value.
- Schema version bumps from 1 to 2. The migration backfills every stored
  `Exercise` missing the two new fields; no other stored shape changes.
