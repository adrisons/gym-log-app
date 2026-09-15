# ADR-0014: Set-row status text removed, session-detail exercise move restored, "Bodyweight" abbreviates to "BW", and session detail gets a navbar back arrow

## Status

Accepted.

## Context

Four related refinements from the same design-review pass, gathered here
rather than as four separate ADRs, following the precedent ADR-0010/
ADR-0012/ADR-0013 already set for a single multi-item pass:

1. **The set-row status line was clutter.** Since ADR-0010 restored an
   explicit Confirm/Save button, disabled until every field the exercise's
   template asks for is filled, a `role="status"` paragraph beneath the
   row spelled out exactly which fields were still missing ("Enter a
   weight and a rep count to record this set."). The row's own empty
   inputs already show what's missing; the sentence repeated it in words
   without adding anything a user couldn't already see.
2. **`SessionDetailScreen` silently dropped exercise reordering.**
   `ExerciseEntryCard` already supports Move up/Move down/Move-to-block
   (`docs/design.md` §5, `specs/001-log-a-session/contracts/
   logging-screen-components.md`), and `LoggingScreen` wires all three to
   real handlers. `SessionDetailScreen` — the screen that edits an
   already-logged session — passed the same card `canMoveUp={false}
   canMoveDown={false} otherBlocks={[]}` and no-op handlers, so the
   controls rendered but did nothing. Nothing in any spec or ADR ever
   intended this gap; it was a contract the component's own row in
   `logging-screen-components.md` already claimed both screens honored.
3. **"Bodyweight" wrapped the compact set-summary row.** ADR-0013's
   compact "x"-joined summary line (e.g. "8 x 70kg") fits comfortably at
   phone width for every load kind except Bodyweight, whose full label
   ("Bodyweight +10kg") is long enough to force the row onto two lines —
   exactly the density ADR-0013 introduced the compact line to avoid.
4. **`SessionDetailScreen`'s close button floated over the layout.** A
   `×` button positioned in its own header row sat awkwardly on narrow
   phones, disconnected from the rest of the chrome (screenshot from a
   design-review pass on the deployed build). Every other screen already
   has a consistent header — `HeaderNav`, carrying the screen's title
   since ADR-0012 — so a drill-in screen's "leave" affordance belongs
   there too, not in a floating control of its own.

## Decision

### 1. The set-row status text is removed

`set-row.tsx`'s `<p role="status">{requirementMessage}</p>` is deleted,
along with `requirementMessage`'s computation, `VOLUME_KIND_WORDS`,
`editRequirementMessage()`, and `missingFieldsMessage()`. `canConfirm`
(and the `LOAD_KIND_WORDS` it still reads) is unchanged — the Confirm/
Save button stays `disabled` exactly as before; only the sentence
explaining why is gone. This is a `docs/design.md` §5 Interaction States
row ("Disabled | Reduced visual weight, and a stated reason wherever the
reason isn't obvious") judged compliant without a stated reason here: the
still-empty input the button sits below is itself the reason, and is
already visible.

### 2. `SessionDetailScreen` wires up real move handlers

Two local helpers, `moveExerciseWithinBlock(blockId, fromIndex, toIndex)`
and `moveExerciseAcrossBlocks(fromBlockId, entryId, toBlockId)`, are added
next to the screen's existing `moveBlock` helper, operating on the same
`EditableSession`/`persist()` local-copy pattern the rest of the screen
already uses (this screen edits its own local copy, not the
`useLoggingSession` store `LoggingScreen` uses — restoring the feature
here needed screen-local logic mirroring the store's, not a shared call
into the store itself). `otherBlocks` is computed per block exactly as
`LoggingScreen` already computes it, and `ExerciseEntryCard`'s
previously-hardcoded no-op props are replaced with these real values.

### 3. `formatLoadCompact` abbreviates Bodyweight to "BW"

`application/logging/view-models.ts`'s `formatLoadCompact` gains a
`case 'bodyweight':` branch returning `'BW'` (bare) or `` `BW ${sign}${kg}kg` ``
(with a signed add/assist), instead of falling through to `formatLoad`'s
full "Bodyweight…" text. Every other load kind's compact formatting is
unchanged.

### 4. `SessionDetailScreen` gets a navbar back arrow, replacing its close button

`screen-title.tsx`'s context gains a second value, `backTo: string |
undefined`, alongside the existing `title`; `useSetScreenTitle(title,
backTo?)` sets both in the same layout effect, and a new
`useScreenBackTo()` is `HeaderNav`'s read side for it. Every screen still
calls `useSetScreenTitle` unconditionally on every mount, so a screen
with no `backTo` of its own (the common case) always clears whatever the
previous screen left behind rather than leaking a stale arrow. `HeaderNav`
renders the arrow — `chevron-right` rotated 180°, the same glyph
`LoggingScreen`'s own "‹ Diary" link already established as this app's
"back" convention — as a `<Link>` to the left of the title, only while a
`backTo` is registered. `SessionDetailScreen` registers `'/diary'` and
drops its own floating header/close button entirely.

## Consequences

- `set-row.test.tsx`'s disabled-button tests now assert `queryByRole('status')`
  is absent rather than asserting specific wording — the tests document
  *that* the button stays disabled and silent, not what it used to say.
- `session-detail-screen.test.tsx` gains a test asserting the back arrow
  renders and links to `/diary`, replacing the old close-button assertion.
- `header-nav.test.tsx` gains two tests: no back arrow when nothing
  registers one, and a back arrow linking to the registered route when a
  screen calls `useSetScreenTitle`'s second argument.
- `view-models.test.ts` gains a Bodyweight-abbreviation test alongside
  the existing compact-formatting coverage.
- `diary.css`'s `.session-detail-screen__header`/`.session-detail-screen__close`
  rules are deleted (dead code once the close button is gone);
  `header-nav.css` gains `.header-nav__back` (a 44×44 hit area matching
  the menu button's own).
- `docs/requirements.md` FR-3's ADR-0010 bullet and ADR-0013 set-summary
  bullet each gain a parenthetical noting this ADR's amendment (status-
  line removal; BW abbreviation, respectively).
  `specs/001-log-a-session/contracts/logging-screen-components.md`'s
  `SetConfirmControl` row drops its "with a status line naming exactly
  what…" language, and its `ExerciseEntryCard` row now states Move up/
  down/move-to-block are wired identically on both screens that render
  it. `docs/design.md` §6 gains a sentence on the back-arrow convention
  for drill-in screens, alongside its existing ADR-0012 note on the
  header's title placement.
