# Phase 0 Research: Log a Session

Resolves every `NEEDS CLARIFICATION` this plan would otherwise carry, plus
the technical choices spec.md's own Assumptions explicitly defer to "a
later `/speckit-plan`" (Platform and storage mechanics, Non-Goals). Format:
Decision / Rationale / Alternatives considered, per `/speckit-plan`'s
Phase 0 instructions.

## 1. Scope boundary: this plan builds against the `StoragePort` fake, not a real adapter

**Decision**: This plan's build scope is the `application` and
`presentation` layers of the logging feature (FR-001..FR-026), wired
against the existing `StoragePort` interface (`specs/002-domain-and-ports`)
and tested entirely against `InMemoryStorage`
(`InMemoryStorageAdapter`) — no *durable* `infrastructure/` adapter
(`IndexedDbStorageAdapter`/`FileSystemStorageAdapter`) is written here.
**Discovered during implementation**: `InMemoryStorageAdapter` itself does
have to live under `src/infrastructure/`, not `test/support/` as first
assumed — `src/presentation/main.tsx` (the composition root) needs a real,
in-`src/`-layer `StoragePort` implementation to wire, since `src/` may
never import from `test/`. It is still explicitly non-durable (its own doc
comment says so) and still the same scope boundary as originally decided
here: this plan proves the feature's behavior against an in-memory
implementation, not a real on-device one. `test/support/in-memory-storage.ts`
now just re-exports the same class under its historical test-facing name,
so every existing test keeps importing it unchanged. `LoggingDraft`'s real nested shape (owned by this spec per
`contracts/storage-port.md`'s own note) **is** designed and implemented
here, and `InMemoryStorage`'s flat-placeholder repoint/prune logic **is**
replaced to walk that real shape — that limitation was explicitly assigned
to spec 001 by spec 002's contract, so it is in scope even though the
adapters are not.

**Rationale**:

- `docs/agent-brief.md` §3 orders "Phase 2 — Persistence" (real adapters,
  schema version, migration) before "Phase 3 — Logging", but the project's
  actual spec sequence has already departed from strict phase order once:
  `specs/002-domain-and-ports` ("Phase 1" content) was carved out of the
  "Log a Session" effort into its own spec/plan/tasks/PR specifically
  because `/speckit-plan` for 001 would otherwise have had to design the
  domain model inline. The same reasoning applies to persistence: it is a
  large, independently testable, independently reviewable unit of work
  (two adapters, a shared contract test suite, schema-version read/write,
  migrate/refuse logic) that deserves its own spec rather than being
  smuggled into this one as an unstated side effect.
- Every prior spec in this repo stayed to one coherent deliverable per PR
  (000: scaffolding; 002: domain + ports). Folding two full storage
  adapters into the plan for five FR groups' worth of UI and application
  logic would break that discipline and produce a plan too large to review
  or implement as one unit.
- The `StoragePort` boundary (ADR-0002, constitution Principle IV) exists
  precisely so the application/presentation layers can be built and fully
  behaviorally verified — including FR-005's "no data lost" and FR-024's
  "draft survives an app close" as *port-level contracts* — without a real
  adapter existing yet. `docs/testing.md` confirms this is the established
  pattern: unit/integration tests use the fake exclusively; only
  `test/e2e/` touches a real browser, and even that is for shell/service-worker
  concerns, not storage.
- `src/domain/ids.ts`'s own comment already draws this exact line: ID
  generation strategy is "Phase 2 (Persistence)'s concern, not this
  layer's" — this plan resolves that one narrow piece (§2 below) because
  the application layer needs *an* ID scheme to construct entities at all,
  without deciding the rest of Phase 2.

**Consequence, stated plainly, not left implicit**: after this plan is
implemented, `docs/requirements.md` FR-3/FR-5 (SC-003 "no data lost... in
100% of tested interruption points", SC-007 "draft intact" after a real app
close) are proven true against the port's contract and the in-memory fake,
but are **not yet true in a shipped build** — closing the actual installed
app still loses data until a real adapter is wired at the composition root.
This plan recommends a follow-up spec (`003-persistence`, or the next free
number), scoped exactly to `docs/agent-brief.md`'s Phase 2 content
(`IndexedDbStorageAdapter` via Dexie — already an installed dependency —
`FileSystemStorageAdapter` hand-written, the shared contract test suite
ADR-0002 requires, schema-version migrate/refuse logic), landing before
this feature is considered production-ready. The composition root
(`src/presentation/main.tsx`) is structured in this plan (§6 below) so that
spec's only change there is swapping `InMemoryStorage` for the real
feature-detected choice — no application or presentation code changes.

**Alternatives considered**:

- *Build both real adapters as part of this plan*: rejected — see
  Rationale above; also would require deciding IndexedDB schema/indexing
  strategy and File System Access permission-prompt UX, each substantial
  enough to warrant its own spec-level scenarios (a storage adapter has its
  own edge cases — quota exceeded, permission revoked, corrupt file — that
  are not FR-001..FR-026 scenarios and don't belong in this spec's
  acceptance criteria).
- *Build only the IndexedDB adapter now (broadest device coverage) and
  defer File System Access*: rejected — ADR-0002 requires both adapters at
  feature parity from the start ("not a degraded tier"); shipping one
  first would need its own ADR revisiting that decision, which is out of
  this plan's authority.
- *Ship without real persistence at all, silently*: rejected — this is the
  one alternative actually harmful: it would let FR-005/SC-003 be reported
  "done" when they are not yet true on-device. Stating the gap explicitly
  (this section, and again in plan.md's Constitution Check) is the point.

## 2. ID generation

**Decision**: `crypto.randomUUID()` (Web Crypto API), split across two
files discovered necessary during implementation (the boundary rule
forbids `shared/` from importing any internal type, `domain/ids.ts`
included): `src/shared/id.ts` exports a plain, unbranded `newId(): string`;
`src/application/logging/ids.ts` wraps it with `newSessionId(): SessionId`
/ `newExerciseId(): ExerciseId`, casting to the branded type at the one
call site each construction path needs it. `eslint.boundaries.js` and
`docs/architecture.md` gained one new edge for this: `application` →
`shared` (previously `shared` had no consumer at all).

**Rationale**: available, standards-based, and offline in every target
browser (`docs/requirements.md` §7.5 target platforms — Chromium
desktop/Android, iOS Safari 16.4+ — all ship `crypto.randomUUID`). No
dependency added ("one dependency per concern",
`docs/development-principles.md` §6). The unbranded generator belongs in
`shared/` per `docs/architecture.md`'s own description of that layer
("cross-cutting utilities with no business concept") — it is not a domain
rule (the domain layer doesn't care how an id is produced, only that it is
opaque and unique) and not application-specific. The branded cast cannot
live in `shared/` itself, though — `shared` may import nothing internal
(`docs/architecture.md`'s table), including `domain/ids.ts`'s branded
types — so it moves one layer out, to `application`, which is already
allowed to import both `domain` and (as of this addition) `shared`.

**Alternatives considered**: a `uuid` or `nanoid` package — rejected, no
capability gap `crypto.randomUUID()` doesn't already close for this
project's target platforms. A storage-adapter-native key (e.g. IndexedDB
auto-increment) — rejected, this plan explicitly does not build a real
adapter (§1), and a fake-only sequential id would need replacing later
anyway; a UUID is adapter-agnostic and works unchanged once a real adapter
exists (also unblocks File System Access, which needs a stable filename-safe
key `today`).

## 3. Exercise search matching (FR-016)

**Decision**: a small hand-written normalize-and-score matcher in
`src/shared/fuzzy-match.ts` — lowercase, diacritic-strip (`String.prototype.normalize('NFD')`
+ combining-mark strip) both the query and each candidate name/alias, then
rank by (in order) exact match, prefix match, substring match, and a
bounded Levenshtein distance for typo tolerance (distance ≤ 2, or ≤ 1 for
strings under 5 characters). No new dependency.

**Rationale**: `docs/stack.md`'s "Deferred" table names *fuzzy search* as a
concern whose **library choice** (Fuse.js, `uFuzzy`, or hand-rolled) is
deferred to "the Phase 4 (diary/search) spec, where the matching semantics
and the < 100 ms performance target (FR-7) are specified" — that is a
different, later FR (`docs/requirements.md` FR-7, "Exercise search", its
own future spec) with its own performance target across up to 500 diary
records. Spec 001's FR-016 is narrower: typo/partial-match tolerance over
the *exercise catalogue* (name + alias) while picking an exercise during
logging — a much smaller, bounded input (SC-004 caps it at 500 exercises,
same number, but catalogue entries are short strings, not diary records).
A hand-rolled matcher is a reasonable, dependency-free way to satisfy
FR-016/SC-004 now without pre-empting FR-7's own tool decision — if FR-7's
spec later picks a dedicated library, that spec can decide whether to also
replace this matcher (same interface, one call site:
`searchExercises(query, catalogue)` in the application layer) or leave it,
since the two are independent concerns (catalogue lookup while logging vs.
diary search across all recorded history).

**Alternatives considered**: pull in Fuse.js or `uFuzzy` now — rejected,
preempts FR-7's own deferred decision and adds a dependency for a concern
`docs/stack.md` explicitly says isn't ready to be decided; a plain
substring-only filter — rejected, fails FR-016's explicit "tolerant of
typos" requirement (spec.md Acceptance Scenario US4-1).

## 4. Draft → Session promotion (resolves an ambiguity between FR-001 and Key Entities)

spec.md's Key Entities section says the Logging draft "becomes a Session
only on submit," but FR-001..FR-024 describe no explicit "submit" or
"finish session" UI action anywhere, and the constitution (Principle II)
and spec.md Non-Goals both rule one out ("no Save button", "no explicit
end-of-session step"). Raised to the project owner during planning rather
than sent back through `/speckit-clarify`; resolved as follows.

**Decision**: the pending draft is promoted to a real, persisted `Session`
(via `saveSession`, then `discardDraft`) automatically, checked once at the
moment the logging form is opened: if a draft exists and its
`lastEditedAt` timestamp falls on an earlier local calendar day than "now",
it is promoted before the form renders (an ordinary open, not a special
mode) and the just-opened form starts a brand-new draft/session as normal
per FR-001. If the draft's `lastEditedAt` is still today (local time), it
is restored unchanged, exactly as FR-001/Acceptance-Scenario-2 describe.

**Rationale**:

- Matches Acceptance Scenario 4 exactly ("the user already submitted a
  session earlier today... a second, fully independent session is
  created") without inventing a UI element the spec never mentions.
- No background timer needed — web PWAs have no reliable background
  execution (ADR-0002 Consequences, "no true background execution"), so any
  promotion rule has to be evaluated at a point the app is actually
  running; "form open" is the only such point FR-001 already defines.
- Calendar-day boundary (not a rolling N-hour idle timeout) reuses a
  concept spec.md already treats as meaningful ("already submitted a
  session earlier today", D6's "multiple sessions per calendar day") rather
  than inventing an arbitrary duration with no textual anchor.
- Consistent with spec.md's explicit statement that a session's own
  `dateTime` "never rolls over at midnight" — that rule is about what a
  *Session's* recorded time means once created; it does not conflict with
  using the calendar-day boundary as a completely separate trigger for
  when a *draft* graduates to being a Session at all.

**Consequence for data-model.md**: `LoggingDraft` carries a `lastEditedAt`
timestamp field (ISO 8601), updated on every mutation, used only for this
check — not shown in any UI in this slice.

**Flag for the spec owner**: this is a product-behavior decision, not
purely an implementation detail — recorded here, in a plan, rather than in
spec.md itself. If the actual desired behavior differs (e.g., a session
should also close out when the user backgrounds the app for a shorter
period, or there should be a visible "still working on [date]'s session"
indicator), that belongs back in spec.md via `/speckit-clarify` before
`/speckit-tasks` locks in the use-case signature below.

## 5. Session/draft/undo state management

**Decision**: a Zustand store in `src/application/logging/logging-store.ts`
(`useLoggingSession`) holds the in-progress draft (mirrored to
`StoragePort.saveDraft` on every mutation), the 5-second undo stack
(FR-004/FR-023), and the ~1-second confirm debounce guard (FR-025). The
undo stack itself is **not** persisted (matches spec.md's edge case:
closing the app during the undo window does not cancel an already-applied
deletion — there is nothing to restore after a real close, so it doesn't
need to survive one).

**Rationale**: `docs/stack.md` already names Zustand for "state management"
with no concern-boundary restricting it to presentation-only; `docs/architecture.md`'s
layer table lists "session state, view models" as an explicit `application`
concern. Keeping the store in `application/` (not `presentation/`) means
presentation only ever renders from and dispatches to it — consistent with
Principle V ("presentation... consumes view models") — and the store itself
only imports `domain` + `application-ports`, satisfying the boundary rule.

**Alternatives considered**: React `useReducer`/Context in presentation —
rejected, would put session-state logic (undo timers, debounce, draft
mutation rules) in the layer that's supposed to only consume it, and
duplicates the state-management concern `docs/stack.md` already assigns to
Zustand ("one dependency per concern").

## 6. Composition root shape (for the persistence hand-off in §1)

**Decision**: `src/presentation/main.tsx` gains one call —
`createLoggingUseCases(storage: StoragePort)` — that the real Phase 2
composition root work will call with a real adapter instead of
`InMemoryStorage`; every application-layer function in this plan takes its
`StoragePort` as a parameter (or closes over one built this way), never
imports `InMemoryStorage` directly outside `test/`.

**Rationale**: makes §1's stated hand-off literal — the only edit a future
persistence spec needs at the composition root is which `StoragePort`
implementation gets passed in, not any change to application or
presentation code. This is the existing pattern (`test/support/integration-harness.ts`'s
`createHarness()`) extended to product code instead of only tests.

## 7. Band labels (FR-011) — a small storage-port extension

**Decision**: extend `StoragePort` with `listBandLabels(): Promise<string[]>`
and `saveBandLabels(labels: string[]): Promise<void>`, mirroring the
existing `getDraft`/`saveDraft` shape. `InMemoryStorage` gains a
`#bandLabels: string[]` field, defaulting to `[]`.

**Rationale**: "the user's own reorderable list of band labels" (FR-011) is
data the user builds up and expects to persist across sessions, but it is
not a field on any canonical entity in `docs/requirements.md` §3 (Session,
Exercise, Set, Body measurement) — it is closer in kind to `LoggingDraft`:
new, additive, UI/preference-shaped state the storage port needs a narrow
surface for. Per the constitution's Principle III schema-version rule, a
version bump + ADR + migration is required for "any new persisted field on
a canonical entity" — band labels are not a field on a canonical entity,
so this extension does not trigger that rule, the same way `LoggingDraft`
itself didn't. It is still a genuinely new persisted concern, which is why
it's called out here explicitly rather than folded silently into the
`StoragePort` contract update (`contracts/storage-adapters-and-ports.md`
carries the full interface diff for review).

**Alternatives considered**: store band labels as a property of some
synthetic "Settings" record — rejected, invents a Settings entity ahead of
FR-11's own future spec, for a value FR-11 doesn't currently claim; derive
band labels from usage (scan every `Set` with `load.kind === 'band'`) —
rejected, FR-011 says "their own reorderable list," implying explicit order
the user controls, not a derived, unordered set — order can't be recovered
from usage history alone.

## 8. Free-text load autocomplete (FR-012)

**Decision**: derived on read, not persisted separately. The application
layer's `suggestFreeTextLoads(exerciseId, storage)` scans that exercise's
own recorded `Set`s (via the sessions already loaded for the current
context) for `load.kind === 'freeText'` values and returns the distinct
set, most-recent-first.

**Rationale**: satisfies `docs/development-principles.md` §4 ("keep
derived data rebuildable") directly — no new persisted structure, nothing
that can drift from canonical records. Catalogue/session sizes in this
slice's target scale (SC-004's 500-exercise ceiling; a personal training
log) make an on-read scan cheap enough with no measured perf target in
spec 001 to violate.

**Alternatives considered**: a persisted per-exercise autocomplete index —
rejected, an unnecessary derived structure this early, and one more thing
to keep rebuildable/consistent for no stated performance need yet.

## 9. Quick-increment amounts (FR-010)

**Decision**: fixed defaults for this slice — Weight: ±2.5 kg (primary),
±0.5 kg (secondary/fine); Bodyweight added/assisted component: ±2.5 kg;
Reps: ±1; Duration: ±5 s; Distance: ±50 m. Defined as named constants in
`src/application/logging/quick-increments.ts`, not user-editable here.

**Rationale**: FR-010 says "configurable quick-increment controls" but
spec.md's Non-Goals explicitly place Settings (FR-11, where user-level
configuration would live) out of scope for this slice — "configurable" is
satisfied at the architecture level (the amounts are named constants in one
place, not literals scattered through components — `docs/development-principles.md`
§5), not by a user-facing settings UI, which doesn't exist yet.

**Alternatives considered**: hardcode literal numbers at each call site —
rejected outright, violates §5 directly regardless of this slice's scope.

## 10. Date/time handling

**Decision**: platform `Date` + `Intl.DateTimeFormat`, no library. Session
`dateTime` and draft `lastEditedAt` are stored as ISO 8601 strings
(matching spec 002's existing `Session.dateTime` shape); the user-editable
date-time field (FR-001) is a native `<input type="datetime-local">`
composed with design tokens, converted to/from ISO 8601 at the
presentation/application boundary.

**Rationale**: confirms `docs/stack.md`'s prediction ("the platform `Date`
+ `Intl.DateTimeFormat` are expected to suffice for spec 001's
date-time-at-form-open logic") — nothing in this plan's scenarios (editing
a date-time, comparing calendar days for §4's promotion rule, formatting
for display) needs timezone-database features or duration arithmetic
beyond what `Date`/`Intl` already provide.

**Alternatives considered**: `date-fns` — rejected, no capability gap
found; would need its own ADR per `docs/stack.md` "Not without an ADR" and
none of this plan's scenarios justifies one.
