# ADR-0008: Explicit workout confirmation replaces automatic draft promotion

## Status

Accepted.

## Context

Since spec 001, the logging screen kept exactly one `LoggingDraft` (spec
001 Key Entities; `application/logging/draft.ts`) that is saved
continuously as the user edits it (`logging-store.ts`'s every mutating
action calls `storage.saveDraft` right after the optimistic update,
constitution Principle II). That draft was never promoted to a real
`Session` by anything the user did on purpose: `openLoggingForm` (`use-
cases.ts`) silently promoted it (`draftToSession` + `saveSession` +
`discardDraft`) the moment the form was reopened on a *later local
calendar day* than its `lastEditedAt` — and the same function always
loaded whatever draft was stored straight into the active form, with no
way to see it was there before it was already filled in.

The project owner asked for a visible, deliberate "Log workout" action
instead: recording a *set* stays exactly as immediate as ADR-0007 already
made it (no confirm control, no waiting, no dialog — Invariant 2,
`docs/requirements.md` §1.2, is unchanged for that path) but *whether a
whole workout enters the diary as a Session* should be something the user
decides, not a side effect of which day they happened to reopen the app.
Two behaviors followed from that:

- A visit to the logging form that never receives any input must leave no
  trace at all — today, `openLoggingForm` unconditionally calls
  `storage.saveDraft` on a brand-new, still-empty draft, so even an
  immediate close writes a draft record.
- A visit that received input but was never confirmed must still survive
  (close, background, kill, navigate away) as a recoverable draft — but
  recovering it is now something the user opts into from a banner, not
  something that happens silently the instant the form opens.

This is scoped to the single discipline the app has today (`'Strength'`
— swimming is decided by ADR-0006-swimming-discipline but not yet built);
"one draft per training type" collapses to the existing single-draft
model and needs no new field or storage-port method. Revisiting that is
this ADR's own "Neutral" consequence below, not something decided here.

## Decision

1. **A set still commits itself immediately.** `addSet`'s debounce-and-
   commit behavior (ADR-0007) is untouched. What changes is only when the
   *draft holding those sets* becomes a persisted `Session`.

2. **The active draft starts empty and unsaved.** `openLoggingForm` no
   longer creates-and-persists a draft on every call. Opening the form
   always hands the screen a brand-new, in-memory-only `LoggingDraft`
   (`createDraft(now)`, not yet written to storage) — never the stored
   one. It is written to storage for the first time only once it has at
   least one block — the same threshold item 4 below uses to gate "Log
   workout" — not on every mutation indiscriminately: editing only the
   session's date-time never triggers a save on its own, deliberately,
   so that path can never overwrite the single stored-draft slot either
   (see item 3's banner-safety point). A visit where the user adds nothing
   beyond the date never calls `storage.saveDraft` at all, so nothing is
   stored — closing the loop on the "no data ⇒ nothing stored" half of the
   request.

3. **A previously stored draft is offered, never auto-loaded.**
   `openLoggingForm` still reads whatever draft is stored (if any) and
   returns it alongside the fresh active one, as a distinct "pending
   draft" the presentation layer renders as a dismissible banner at the
   top of the logging screen (`docs/design.md`'s existing home for
   screen-level status, not a modal — no dialog is introduced). Two
   explicit actions resolve it:
   - **Recover**: the pending draft *becomes* the active one (same id);
     further edits save under that id as they already do today.
   - **Discard**: `storage.discardDraft()` removes it; the active
     (fresh, empty) draft is untouched.
   Unlike an earlier version of this decision, editing the active draft
   directly does **not** implicitly resolve an unaddressed banner: adding
   a block, exercise, or set is unavailable while a pending draft is still
   showing unresolved (review finding: since there is exactly one stored-
   draft slot, letting an unrelated new edit silently overwrite it would
   destroy a fully-recorded earlier workout with no warning and no undo —
   a real regression against FR-004's undo guarantee elsewhere on this
   screen, not an acceptable cost of "no dialogs"). This still mirrors the
   discard-first rule spec 001's FR-024 already stated ("to start from
   scratch the user first discards the draft") — only the trigger moved
   from "a new calendar day" to an explicit Recover/Discard choice, and
   the choice is now required, not merely available, before new content
   can be added. Editing the session date-time alone stays available
   regardless, since (per item 2) it is never itself persisted.

4. **A new, explicit action promotes the draft to a Session.** A "Log
   workout" control (labelled at the presentation layer; this ADR fixes
   only its effect) calls a new use case, `registerWorkout`: it converts
   the active draft to a `Session` (`draftToSession` + `saveSession`,
   unchanged), clears the stored draft slot (`discardDraft`), and hands
   the screen a brand-new empty active draft exactly like a fresh
   `openLoggingForm` visit — so the "one stored draft per type" property
   holds continuously; there is never a moment with two. This is the one
   and only path that ever calls `saveSession` from the logging screen now
   — `openLoggingForm`'s own day-rollover promotion (old behavior) is
   removed outright, not merely superseded, since nothing else in this
   ADR still calls it.
   On success the screen also navigates back to the diary (`LoggingScreen`,
   presentation-layer concern — this ADR fixes only that it happens, not
   the routing mechanics), carrying forward the save acknowledgement
   spec.md previously showed on any exit after logging a set; it is not
   shown on an ordinary "‹ Diary" exit with an unregistered pending draft
   left behind.
   The control only fires when the active draft has at least one block —
   the same threshold item 2 uses to decide whether the draft is even
   persisted at all, so "worth saving as a draft" and "worth registering
   as a Session" never diverge (mirrors FR-019's "nothing to confirm"
   gating elsewhere in this screen) — an empty draft has no visible "Log
   workout" action at all, the same "unavailable rather than a rejected
   tap" convention ADR-0007 already established for an invalid set.

5. **The one-shot "Session saved" acknowledgement moves with it.**
   `justLoggedASet` (`logging-store.ts`) was already documented as "the
   one reliable signal that this visit recorded a set" — that meaning
   drifts once recording a set is no longer the same event as a Session
   landing in the diary. The flag (renamed `justRegisteredWorkout` for
   clarity) is now set only by `registerWorkout`'s success, not by every
   `addSet`; `DiaryScreen`'s `SessionSavedToast` wiring is otherwise
   unchanged (still one-shot, still cleared by `initialize()`).

## Consequences

**Positive**

- Matches the owner's request without touching Invariant 2's guarantee
  for the actual gym-floor action (recording a set): still zero taps,
  zero waiting, zero dialogs for that.
- "No data ⇒ nothing stored" and "some data, unconfirmed ⇒ recoverable
  draft" both fall out of *when* the first `saveDraft` happens, not a new
  mechanism — `LoggingDraft`'s shape, the storage port's method set
  (`saveDraft`/`getDraft`/`discardDraft`), and the schema version are all
  unaffected (no `docs/requirements.md` §6 migration).
- Removes a decision (silent day-rollover promotion) nobody could see
  happening; the user now always knows, by construction, whether last
  week's gym session became a diary entry.

**Negative**

- `openLoggingForm`'s day-rollover auto-promotion is gone: a user who
  never presses "Log workout" keeps an unregistered draft indefinitely
  (no time-based fallback save). Accepted as the intended behavior — the
  owner chose deliberate confirmation over an automatic safety net for
  this case.
- The banner is a new piece of screen state spec 001 didn't have (a
  pending draft distinct from the active one); `LoggingScreen`/`logging-
  store.ts` grow a little in surface area (`pendingDraft`,
  `recoverPendingDraft`, `discardPendingDraft`, `registerWorkout`).

**Neutral**

- "One draft per training type" is scoped to today's single type
  (`'Strength'`); nothing here adds a `discipline`/`type` field to
  `LoggingDraft` or a second storage slot. Extending to a real per-
  discipline draft is left to swimming's own future feature spec
  (ADR-0006-swimming-discipline), which will need to decide the storage
  shape for multiple concurrent drafts on its own terms.
- `docs/requirements.md` FR-3 / Invariant 2 text is unchanged — this ADR
  narrows what "logging" covers (recording a set) rather than reinterpreting
  it. FR-1's own prose *does* change directly (not just annotated, unlike
  spec 001 below): it previously described the day-rollover promotion and
  the per-set save-acknowledgement this ADR retires, so leaving it as-is
  would make the requirements document actively wrong, not merely silent.
- `registerWorkout`/`recoverPendingDraft`/`discardPendingDraft` are queued
  through `logging-store.ts`'s existing `enqueueDraftOp` (the same
  mechanism PR #22's Copilot review already built for `persistDraft`),
  rather than a new concurrency primitive: `registerWorkout` re-checks the
  active draft's identity once its queued turn comes up (so a debounced
  commit already in flight can't be resurrected, and a double-tap can't
  register the same content twice); `recoverPendingDraft`/
  `discardPendingDraft` each re-check `pendingDraft`'s identity the same
  way, so whichever the user actually clicked first wins and the other
  is a no-op. The Session's id is `draft.id` itself, not a freshly minted
  one, so a retry after a partial failure (`saveSession` succeeds,
  `discardDraft` doesn't) upserts the same `Session` instead of
  duplicating it (Copilot review, PR #25).
- `specs/001-log-a-session/spec.md`'s User Story 1 Acceptance Scenarios
  1–3 and FR-024 (the automatic-restore, day-rollover-promotion
  behavior) and `data-model.md`'s `openLoggingForm` row are annotated as
  superseded by this ADR, following the precedent ADR-0006/ADR-0007
  already set, rather than rewritten in place.
