# Quickstart: verifying "Log a Session"

How to confirm this phase is done, once implemented. Prerequisites: Node
per `.nvmrc`, `npm install` run at the repo root.

## Automated checks (what CI runs)

```sh
npm run typecheck
npm run test        # Vitest: unit + integration, against InMemoryStorage
npm run lint         # includes the boundary rule
npx playwright test  # e2e smoke, incl. the logging draft round-trip
```

All four green is the baseline bar (constitution Definition of Done). Every
FR-001..FR-026 acceptance scenario in spec.md should be traceable to at
least one test named after it — `docs/testing.md`'s convention.

## Manual scenarios (spec.md's own Acceptance Scenarios, condensed)

Run the dev server (`npm run dev`), open the app on a narrow (phone-width)
viewport first, then a wide one, in both light and dark theme:

1. **Cold start, no draft**: open the app → logging form opens directly to
   a new session dated "now" (editable), no picker, no dialog (US1-1).
2. **Log a set fast**: add an exercise, enter a load + rep count, confirm →
   appears instantly, no Save control anywhere, no spinner (US1-7, SC-001:
   count taps — repeating the previous set should be ≤ 3 taps once one set
   exists).
3. **Leave and return**: enter a set, reload the page (simulates
   close/reopen within the same day) → the draft is restored with that set
   intact, no data lost (US1-2, US1-8, SC-007). *Caveat*: this proves the
   application/port contract, not on-device durability — see
   `research.md` §1; a real reload against a real adapter is the follow-up
   persistence spec's job.
4. **Double-tap guard**: on a pre-filled set, tap confirm twice within
   about a second → only one set recorded (US1-9, FR-025).
5. **Blocks**: create two blocks, name one, leave one unnamed (shows as
   "Block 2", never "Untitled"), add exercises to each, move one exercise
   between blocks (US2-1..3).
6. **Delete + undo**: delete a block with sets in it → 5-second undo
   restores the whole block with its sets (US2-4, FR-023). Let the window
   expire once to confirm it becomes permanent.
7. **Every load type**: for one exercise, record a set as Weight, Band
   (from your own label list), Bodyweight (with a +/− component), Free
   text (autocompleting from a prior value), and None-with-a-Volume — each
   reads back correctly (US3, spec.md Acceptance Scenarios 1–6).
8. **Effort**: record effort on one set as a 1–5 tap, confirm the word
   label always shows next to the number, never a bare digit (US3-8,
   ADR-0003).
9. **Catalogue search**: search by a deliberate typo and by an alias → the
   intended exercise appears in the first 3 results (US4-1, SC-004).
10. **Rename collision → merge offer**: rename an exercise to a name
    already in use → app offers merge, not silent rejection or a
    duplicate; decline once (rename cancels, original name kept) and
    accept once elsewhere (merge applies, survivor keeps its own defaults,
    loser's name becomes an alias, its sets reassign) (US4-2..4, FR-022).
11. **Delete with history**: try deleting a catalogue exercise that has
    logged sets → confirmation dialog offers merge as an alternative;
    confirm the delete anyway → cascade removes its entries/sets too
    (US4-6, FR-018).
12. **Same-day vs. next-day reopen**: log a set, then (in dev tools or by
    manipulating the system clock in a test build) simulate reopening the
    form the next calendar day → the earlier draft is promoted to a
    finished session, and a brand-new draft/session starts (US1-4,
    research.md §4 — this is a plan-level resolution of an ambiguity in
    spec.md, flag any mismatch with product intent back to the spec).

## What "done" does not yet mean

Per `research.md` §1: this phase's automated and manual checks all run
against `InMemoryStorage`. `docs/requirements.md` invariant 2 ("closing the
app at any moment loses nothing") is proven at the `StoragePort` contract
level here, not yet against a real on-device adapter — that lands with the
follow-up persistence spec this plan recommends. Don't report SC-003/SC-007
as verified against a production build until that spec ships and this
quickstart is re-run against it.
