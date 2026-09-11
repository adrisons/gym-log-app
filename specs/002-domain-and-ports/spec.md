# Feature Specification: Domain Model and Ports

**Feature Branch**: `002-domain-and-ports`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Domain model and ports (Phase 1). Entities,
value objects, domain rules (docs/requirements.md §3.3), and the finalized
storage port + in-memory fake — scoped down from docs/agent-brief.md §3's
full Phase 1 text to exclude §5 computation rules, per an explicit owner
decision."

## Context *(mandatory)*

Phase 0 (`specs/000-scaffolding/`) shipped the stack, the layer-boundary
rule, and a placeholder `StoragePort` whose own JSDoc says "Phase 1 owns
this interface." `specs/001-log-a-session/spec.md` ("Log a Session") is
already written and has been through its own spec-reviewer/clarify cycle,
but it references domain entities (Session, Block, Exercise entry, Set)
and value objects (Load, Volume, Effort) that today exist only as prose in
`docs/requirements.md` §3 — there is no real domain code yet. Planning or
implementing spec 001 without this spec done first would mean inventing
the domain model ad hoc inside that work, without the dedicated
spec-reviewer/schema-guardian scrutiny this spec gets, and would very
likely need reshaping once real entities exist.

`docs/agent-brief.md` §3 defines Phase 1 as "entities, value objects (Load,
Volume, Effort), the rules in `docs/requirements.md` §3.3 **and every
computation in §5**, with exhaustive unit tests. Ports defined and
in-memory fakes working." **This spec deliberately narrows that scope**:
it covers entities, value objects, and the domain rules of §3.3, plus the
storage port and its in-memory fake — but explicitly excludes all of §5
(e1RM, tonnage, exercise/aggregate trend, insight wording, data-sufficiency
thresholds). §5's rules exist to serve Insights (`docs/agent-brief.md`'s
Phase 5), not Logging (spec 001) or Persistence (Phase 2); specifying them
now would be speculative work ahead of the screens that actually need
them. This is a project-owner decision made 2026-09-11, not a silent
deviation — `docs/agent-brief.md` §3 itself should eventually be updated
to reflect the split into this spec and a future §5/Insights spec (see
Assumptions).

This spec's deliverable, scoped per the above, is
`docs/agent-brief.md`'s own Phase 1 target: "complete business rules
[for entities, value objects, and §3.3], tested without touching disk."

## User Scenarios & Testing *(mandatory)*

This spec has no end user and no UI — its "users" are the developers and
agents building `specs/001-log-a-session` and Phase 2 (Persistence) on top
of it, and its acceptance criteria are verifiable properties of the domain
code, not screens.

### User Story 1 - The domain model exists and is technology-free (Priority: P1)

A developer building spec 001 (Logging) can import `Session`, `Block`,
`Exercise entry`, `Set`, `Load`, `Volume`, and `Effort` types from
`src/domain/` and use them to represent a real training session, with no
storage, UI, or framework concept anywhere in their shape.

**Why this priority**: every later phase (Logging, Persistence, Diary,
Insights) is built on these types. Nothing else in this spec matters if
the model itself is wrong or leaks a non-domain concern.

**Independent Test**: write a unit test that constructs a `Session`
containing a `Block` containing an `Exercise entry` containing `Set`s with
each `Load` variant and each `Volume` variant, with no import from
`application/`, `infrastructure/`, or `presentation/` — the boundary rule
(spec 000) already fails the build if one sneaks in.

**Acceptance Scenarios**:

1. **Given** the domain types, **When** a developer constructs a `Set`
   with a `Weight` load and a `Reps` volume and asserts it equal to an
   independently-constructed value with the same fields, **Then** the
   equality check passes with no persistence concept involved anywhere in
   the type or the test.
2. **Given** the domain types, **When** a developer inspects the `Load`
   type, **Then** exactly five variants are available (`Weight`, `Band`,
   `Bodyweight`, `FreeText`, `None`) and the type system rejects a sixth.
3. **Given** the domain types, **When** a developer inspects `Effort`,
   **Then** it is a single canonical integer 1–5 (ADR-0003), not a pair of
   RPE/RIR values.

---

### User Story 2 - Domain rules are enforced, not just documented (Priority: P1)

A developer relying on the domain layer gets a rule violation rejected at
the domain boundary (a thrown domain error or a smart-constructor
returning failure) rather than discovering the rule was never enforced
only when a later screen misbehaves.

**Why this priority**: `docs/requirements.md` §3.3's rules (renaming never
breaks history, merging reassigns sets, a valueless set isn't stored) are
exactly the kind of business logic the constitution's Principle III (BDD
before code) and Principle VI (deterministic, traceable) exist to protect
— if they live only as comments, they aren't real.

**Independent Test**: for each rule in §3.3, write a test that attempts
the violation and asserts it is rejected, and a companion test that
performs the valid operation and asserts it succeeds — a red/green pair
per rule, the same discipline spec 000 used for the boundary rule.

**Acceptance Scenarios**:

1. **Given** a `Set` under construction, **When** it has neither a
   `Volume` nor a `Load` (both absent/`None`), **Then** construction is
   rejected — no empty set is representable.
2. **Given** two `Exercise` catalogue entries and a history of `Set`s
   against one of them, **When** they are merged, **Then** every `Set`'s
   reference resolves to the survivor's identifier, and the merged name
   becomes an alias of the survivor.
3. **Given** an `Exercise` catalogue entry, **When** it is renamed,
   **Then** every existing reference to it (by identifier) continues to
   resolve correctly — no reference is name-based.
4. **Given** an `Exercise` catalogue entry with logged history, **When** a
   caller attempts to delete it without confirmation, **Then** the
   operation is rejected and a merge is offered as the alternative path.

---

### User Story 3 - The storage port is finalized and the in-memory fake matches it (Priority: P1)

A developer building Phase 2 (Persistence) or spec 001 (Logging) gets a
`StoragePort` interface shaped in real domain terms (not the Phase-0
placeholder `SessionRecord`/`ExerciseRecord`), with a working in-memory
fake that round-trips every method — so Phase 2 has a contract to
implement against and spec 001 has a fake to build and test against today.

**Why this priority**: this is the seam every later phase depends on.
Getting it right now, reviewed by schema-guardian against
`docs/requirements.md` §3/§6, avoids a second reshape once Phase 2 starts.

**Independent Test**: run the existing
`test/unit/storage-port-fake.test.ts` pattern against the finalized
interface — every method round-trips a real domain-shaped value with no
real storage API involved anywhere in the test file (spec 000's FR-014
pattern, extended to the real entities).

**Acceptance Scenarios**:

1. **Given** the finalized `StoragePort`, **When** a `Session` containing
   nested `Block`/`Exercise entry`/`Set` data is saved and then read back
   through the in-memory fake, **Then** the returned value is
   deep-equal to what was saved.
2. **Given** the finalized `StoragePort`, **When** the schema-version
   concern is inspected, **Then** the port exposes a way to read and set a
   schema version (per `docs/requirements.md` §6), even though the actual
   migrate/refuse logic is Phase 2's job, not this spec's.
3. **Given** `test/support/in-memory-storage.ts`, **When** a developer
   imports the fake for a Phase 3 (Logging) unit test, **Then** it is
   available from the single documented shared-doubles location
   (`test/support/`, per spec 000 FR-015) with no separate fake needed.

---

### User Story 4 - The seed-catalogue shape is accommodated, not populated (Priority: P2)

A developer implementing the seed exercise catalogue in a later phase
(ADR-0005) finds the `Exercise` catalogue entity already shaped to hold a
seed entry indistinguishably from a user-created one — no special "is
seed" flag or separate type needed, because ADR-0005 says seed entries
behave as ordinary editable entries from the moment the app launches.

**Why this priority**: lower than the P1s because no later phase is
blocked waiting on this — it is a shape check, not new behavior — but it
is cheap to verify now and expensive to discover missing once seed data is
authored.

**Independent Test**: construct an `Exercise` catalogue entry using only
the fields an ordinary user-created entry would have, and confirm nothing
about the type requires a "seed" or "system-provided" marker to be valid.

**Acceptance Scenarios**:

1. **Given** the `Exercise` catalogue entity shape, **When** a developer
   attempts to model "this entry came from the seed set," **Then** no
   field on the entity itself is required to express that — a seed entry
   and a user-created entry are the same shape (ADR-0005: "seed entries
   behave as ordinary editable catalogue entries").

---

### Edge Cases

- What happens when a `Load` variant's numeric field would need to be
  negative (e.g. `Bodyweight` with an assisted/subtracted load)? Handled:
  `Bodyweight`'s optional component is signed, per spec 001's own
  FR-014 precedent (−300..+300 kg), reused here rather than redefined —
  this spec's `Load` type must accommodate that range, not re-litigate it.
- What happens when an `Exercise entry`'s referenced catalogue exercise no
  longer exists at read time? Deleting an exercise with history requires
  confirmation and cascades (FR-013, FR-024 via `deleteExerciseCascade`);
  deleting one with no history may proceed without confirmation (FR-020) —
  either way, deletion always removes the dependent `Exercise entry`/`Set`
  data via cascade, so a dangling reference should never be produced by
  the domain operations this spec defines. A reference some other path
  left dangling (e.g. data corruption) is a Phase 2 (Persistence) read
  concern — read-repair or refusal — not resolved by the domain type
  itself, which only defines the reference shape.
- What happens when two `Set`s in the same `Exercise entry` have different
  `Volume` variants (one `Reps`, the next `Duration`)? Allowed —
  `docs/requirements.md` §3.2 gives the example of a 45-second plank and
  an 8-rep press both being valid sets; the domain model does not force
  volume-variant consistency within an exercise entry.
- What happens when a `mergeExercises` call names the same identifier as
  both survivor and loser, or an identifier with no matching `Exercise`?
  Rejected (FR-019) — never a silent no-op, since a caller relying on a
  silent no-op could believe a merge happened when it didn't.

## Non-Goals *(mandatory)*

- **All of `docs/requirements.md` §5** (computation rules: e1RM, tonnage,
  exercise trend, aggregate trend, insight wording, data-sufficiency
  thresholds). These exist to serve a future Insights phase
  (`docs/agent-brief.md`'s Phase 5) and are explicitly deferred to that
  phase's own spec — see Context and Assumptions.
- **Real storage adapters** (File System Access API, IndexedDB). Phase 2's
  job; this spec only finalizes the port they will implement.
- **Schema migration logic**. This spec names the schema-version concern
  at the port level (read/set a version number) but does not implement
  migrate/same/refuse behavior — that is Phase 2.
- **Any screen or UI.** Phase 3 (Logging, spec 001) and later phases own
  all presentation work; this spec has no `presentation/` surface.
- **The actual content of the seed exercise catalogue** (which exercises,
  their names, aliases, muscle groups). ADR-0005 already names this as a
  later phase's data-authoring job — this spec only ensures the entity
  shape can hold a seed entry indistinguishably from a user-created one
  (User Story 4).
- **Any change to `docs/design.md`, the approved visual identity
  (`src/presentation/design/tokens.css`), or anything presentation-layer.**
  This spec is domain and application-port work only.

## Requirements *(mandatory)*

### Functional Requirements

**Entities** (`docs/requirements.md` §3.1)

- **FR-001**: The domain layer MUST define an `Exercise` (catalogue) type
  with: canonical name, aliases, movement pattern, muscle groups, default
  load type, a unilateral flag, and a discipline field (fixed to
  `Strength` in v1, but present so a future discipline is additive).
- **FR-002**: The domain layer MUST define a `Session` type with: a
  date-time, an ordered list of `Block`s, free-form notes, an optional
  overall feeling, and an optional duration. A `Session` MUST NOT carry
  any open/closed lifecycle state (`docs/requirements.md` §3.1, revised
  per D6, §8).
- **FR-003**: The domain layer MUST define a `Block` type with: an
  optional name, a type (straight sets / superset / circuit), and an
  ordered list of `Exercise entry` items.
- **FR-004**: The domain layer MUST define an `Exercise entry` type with:
  a reference to a catalogue `Exercise` (by identifier, never by name —
  see FR-010), its order within the block, notes, and an ordered list of
  `Set`s.
- **FR-005**: The domain layer MUST define a `Set` type with: a `Volume`,
  a `Load`, an `Effort` (optional), a kind (warm-up / working / to
  failure), and a completed flag.
- **FR-006**: The domain layer MUST define a `Body measurement` type with:
  a date, a required body weight, an optional fat percentage, an optional
  muscle percentage or mass, and notes.

**Value objects** (`docs/requirements.md` §3.2)

- **FR-007**: The domain layer MUST define `Load` as a sum type with
  exactly five variants: `Weight` (numeric value + unit kg/lb), `Band`
  (label + optional estimated resistance), `Bodyweight` (with an optional
  signed added/assisted component, range −300..+300 kg per spec 001's
  FR-014 precedent, 0 meaning no component), `FreeText` (short string),
  and `None` (load does not apply).
- **FR-008**: The domain layer MUST define `Volume` as a sum type with
  exactly three variants: `Reps` (integer), `Duration` (seconds), and
  `Distance` (metres).
- **FR-009**: The domain layer MUST define `Effort` as a single canonical
  integer in the range 1–5 (ADR-0003) — not a pair of values, not a
  half-point scale.

**Domain rules** (`docs/requirements.md` §3.3)

- **FR-010**: The domain layer MUST reject construction of a `Set` whose
  `Volume` is absent AND whose `Load` is `None` — a set is only
  representable with at least a volume or a load.
- **FR-011**: References from an `Exercise entry` to a catalogue
  `Exercise` MUST be by a stable identifier, never by name — renaming a
  catalogue exercise MUST NOT break any existing reference.
- **FR-012**: Merging two catalogue `Exercise` entries MUST reassign every
  `Set` (via its `Exercise entry`'s reference) that pointed at the
  non-surviving entry to the surviving entry's identifier, and MUST retain
  the non-surviving entry's name as an alias on the survivor.
- **FR-013**: Deleting a catalogue `Exercise` entry that has logged
  history (at least one `Set` referencing it) MUST require explicit
  confirmation and MUST offer merging as an alternative to deletion.
- **FR-014**: The domain layer MUST NOT synthesize or imply an `Exercise
  entry` that the user did not explicitly log — logging is selective, and
  an exercise performed but not logged has no domain representation.
- **FR-015**: Numeric values in `Load` and `Volume` MUST be stored exactly
  as entered (no unit conversion at the domain layer) — any unit
  conversion for display is a presentation-layer concern.

**Seed catalogue accommodation** (ADR-0005)

- **FR-016**: The `Exercise` catalogue entity's shape MUST NOT require any
  field distinguishing a seed-provided entry from a user-created one — a
  seed entry MUST be constructible and behave identically to a
  user-created entry (ADR-0005: "seed entries behave as ordinary editable
  catalogue entries").

**Structural completeness** (closing spec-reviewer findings #7, #8, #9)

- **FR-017**: `Block.exercises` and `Session.blocks` MUST accept an empty
  ordered list as a valid construction — a `Block` with zero `Exercise
  entry` items and a `Session` with zero `Block`s are both valid domain
  states (matching spec 001 FR-023's "a session with zero blocks MUST be a
  valid state," restated here at the domain-type level since this spec is
  the authoritative source other specs build on).
- **FR-018**: Order (`Exercise entry` within a `Block`, `Set` within an
  `Exercise entry`, `Block` within a `Session`) MUST be represented by list
  position alone — no separate stored "order" field/index exists anywhere
  in the domain types. (Resolves an inconsistency between an earlier draft
  of FR-004, which described "order" as if it were its own field, and
  FR-003/FR-002's "ordered list" framing — list position is the single
  source of truth for order throughout this spec.)
- **FR-019**: A `mergeExercises` operation (see FR-024) MUST reject if the
  survivor and loser identifiers are the same, or if either does not
  resolve to an existing `Exercise` — merging an exercise with itself, or
  with a nonexistent exercise, is an error, never a silent no-op.
- **FR-020**: Deleting a catalogue `Exercise` entry that has **no** logged
  history MAY proceed without confirmation (the confirmation-and-offer-merge
  requirement in FR-013 applies only when history exists) — stated here
  explicitly as its own rule, not merely implied by FR-013's "if it has
  history" phrasing, so both the with-history and without-history paths
  are each backed by a stated FR (closing spec-reviewer finding #4).

**Body measurement rule** (closing spec-reviewer finding #6, mirrors FR-010's pattern)

- **FR-021**: The domain layer MUST reject construction of a `Body
  measurement` with no body weight value — weight is the one non-optional
  field of that entity (`docs/requirements.md` §3.1); the fat/muscle
  fields remain optional.

**Effort's optionality is Set-level, not a value-object variant**

- **FR-022**: `Effort` (FR-009) is never itself an "absent" or "None"
  value — it is a plain integer 1–5 whenever it exists. Optionality lives
  on `Set.effort` (FR-005: "an Effort (optional)"), represented as the
  field being absent/undefined on `Set`, never as a sentinel value of
  `Effort` itself. (Closes spec-reviewer finding #5: this distinguishes
  "a Set with no recorded effort" from "an Effort value that means
  none," which `Load`'s `None` variant does model — `Effort` has no
  equivalent variant, deliberately, since docs/requirements.md §3.2 defines
  it as a plain 1–5 integer, not a sum type.)

**Storage port** (finalizing the spec 000 placeholder — full contract in
`contracts/storage-port.md`, resolving spec-reviewer findings #2/#3 that
the Phase-0 placeholder's method set was never concretely re-specified)

- **FR-023**: `src/application/ports/storage-port.ts` MUST be revised to
  match `contracts/storage-port.md` exactly: the Phase-0 placeholder
  `SessionRecord`/`ExerciseRecord` types and `SessionId`/`ExerciseId`
  aliases are replaced with the real entity/value-object types this spec
  defines (FR-001..FR-009), and the method set is the one enumerated in
  that contract — not an unspecified "adjust as needed."
- **FR-024**: The `StoragePort` interface MUST include `mergeExercises`
  and `deleteExerciseCascade` as dedicated atomic operations (not composed
  by a caller from per-record save/get/delete calls) — per
  `contracts/storage-port.md`'s rationale: a single owner of the
  reassignment/cascade logic, and a single `StorageError` failure mode for
  the whole operation.
- **FR-025**: The `StoragePort` interface MUST include `saveDraft`,
  `getDraft`, and `discardDraft` as a narrow, dedicated surface for spec
  001's Logging draft (FR-024 there) — the draft is explicitly NOT
  modeled as a partial/nullable `Session`; its own type is an
  application-layer (spec 001) concern, not a domain entity this spec
  defines, per `contracts/storage-port.md`'s note that the draft's shape
  "evolves independently of" the Session schema version. (Closes
  spec-reviewer finding #1: the draft is acknowledged at the port
  boundary rather than silently absent from this spec.)
- **FR-026**: The `StoragePort` interface MUST expose a way to read and
  set a schema version associated with the stored data
  (`docs/requirements.md` §6), without implementing migrate/same/refuse
  logic — that logic is Phase 2's job; this spec only names the concern at
  the port level (the method(s) already exist as
  `getSchemaVersion`/`setSchemaVersion` from Phase 0 and MUST be retained).
- **FR-027**: `test/support/in-memory-storage.ts` MUST be updated to
  implement the finalized `StoragePort` faithfully — every method
  round-trips a real domain-shaped value, including `mergeExercises` and
  `deleteExerciseCascade`'s reassignment/cascade behavior — remaining the
  single documented shared-doubles location (spec 000 FR-015); no second
  fake is introduced elsewhere.
- **FR-028**: Every domain rule (FR-010..FR-015, FR-019..FR-021) and every
  value object variant (FR-007..FR-009) MUST have an exhaustive unit test —
  a violation-rejected case and a valid-case-accepted companion per rule,
  matching the red/green discipline `test/boundaries/README.md`
  established for spec 000's boundary rule. No real I/O (file system,
  IndexedDB, network) appears anywhere in this spec's test suite.

### Key Entities *(include if feature involves data)*

- **Exercise (catalogue)**: a reusable, user-owned definition of a
  movement (e.g. "Back squat"), referenced by identifier from `Exercise
  entry`. Renaming/merging never breaks history (FR-011/FR-012).
- **Session**: one dated training record, an ordered list of `Block`s, no
  lifecycle state.
- **Block**: an ordered grouping within a `Session` (e.g. "Warm-up", "Main
  lift"), holding an ordered list of `Exercise entry` items.
- **Exercise entry**: one instance of a catalogue `Exercise` being trained
  within a `Block`, holding an ordered list of `Set`s.
- **Set**: one performed set — a `Volume`, a `Load`, an optional `Effort`,
  a kind, and a completed flag. Cannot exist with neither volume nor load.
- **Load**: a value object, one of `Weight` | `Band` | `Bodyweight` |
  `FreeText` | `None`.
- **Volume**: a value object, one of `Reps` | `Duration` | `Distance`.
- **Effort**: a value object, an integer 1–5.
- **Body measurement**: a dated record of body weight and optional
  composition figures, independent of any `Session`. Not constructible
  without a body weight value (FR-021).

**Explicitly not a domain entity this spec defines**: spec 001's
**Logging draft** (its own Key Entities section) is UI/session state, not
a `Session` — this spec does not define its shape. It is acknowledged only
at the storage-port boundary (FR-025, `contracts/storage-port.md`), which
gives it a narrow save/get/discard surface without prescribing its
internal representation, consistent with spec 001's own statement that the
draft's shape evolves independently of the Session schema version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every entity and value object in `docs/requirements.md`
  §3.1/§3.2 has a corresponding domain type, verified by a checklist
  review cross-referencing the spec against that document (mirrors spec
  000's SC-004 pattern for its three docs).
- **SC-002**: Every domain rule in `docs/requirements.md` §3.3 has at
  least one red (violation-rejected) and one green (valid-case-accepted)
  automated test, and both are named traceably to the rule they cover
  (e.g. a test name or comment citing "§3.3: renaming never breaks
  history").
- **SC-003**: `npm run test:unit` passes with zero real I/O anywhere in
  the new test files — verified by the same kind of grep-based binding
  check spec 000 used for color literals (SC-007 there), applied here to
  confirm no `fs`, `indexedDB`, or `fetch` import appears in
  `test/unit/` files covering this spec's scope.
- **SC-004**: A developer starting `specs/001-log-a-session`'s
  `/speckit-plan` can import every entity/value-object type this spec
  defines with no further domain-modeling work required for anything spec
  001 models as a `Session` — verified by a manual cross-check of spec
  001's Key Entities section against this spec's, confirming no gap. The
  one deliberate exception is spec 001's Logging draft, which this spec
  does not define as a domain type (see Key Entities' closing note) — that
  developer still needs to design the draft's own shape at the application
  layer; this spec only guarantees the storage-port surface
  (`saveDraft`/`getDraft`/`discardDraft`, FR-025) exists for it.
- **SC-005**: The finalized `StoragePort` interface and its in-memory fake
  pass the same self-test pattern spec 000 established
  (`test/unit/storage-port-fake.test.ts`), extended to cover every method
  against real domain-shaped values, with 100% of `StoragePort` methods
  covered by at least one round-trip test.

## Assumptions

- **The `docs/agent-brief.md` §3 Phase-1-scope narrowing (excluding §5) is
  a recorded project-owner decision (2026-09-11), not a spec-author
  judgment call.** `docs/agent-brief.md` §3 itself has not yet been edited
  to reflect this split — it still describes Phase 1 as including all of
  §5. The project owner should update that document (or approve doing so
  as part of this spec's Polish/close-out) to describe two phases —
  "Phase 1: Domain and ports" (this spec) and a later "Phase X: Insights
  computation rules" covering §5 — so the brief stays accurate rather than
  silently diverging from what was actually built.
- **Sum types are represented as discriminated unions**, consistent with
  how `Load`/`Volume` are already informally described in
  `docs/requirements.md` §3.2 and with the "sum type" language used
  elsewhere in this project's ADRs — the concrete TypeScript shape
  (discriminant field name, exact type structure) is a `/speckit-plan`
  concern for this spec, not decided here.
- **`Exercise entry` and `Exercise` (catalogue) are two distinct types**
  (an instance-within-a-session vs. a reusable catalogue definition),
  matching `docs/requirements.md` §3.1's own separate bullet points for
  them — this spec does not collapse them into one type.
- **Identifiers (`SessionId`, `ExerciseId`, etc. from the Phase 0
  placeholder) remain opaque string-shaped types** at this layer; the
  exact ID-generation strategy is Phase 2's concern (whatever the chosen
  storage adapter's natural key format is), not this spec's.
- **This spec does not introduce a UI or application-layer use case**
  (e.g. a `LogSetUseCase`) — those belong to spec 001 and later phases,
  which will depend on `application-ports` (this spec's `StoragePort`)
  the same way Phase 0's boundary rule already allows.
