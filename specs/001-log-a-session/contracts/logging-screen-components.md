# Contract: Logging screen components (`src/presentation/`)

This is the first spec with interactive elements (`docs/testing.md`: "Phase
3 is the first"). Every component below MUST ship all six states from
`docs/testing.md` — rest, hover, pressed, focus-visible, disabled-with-reason,
loading — before it is done (constitution Definition of Done), using design
tokens only (no literal colour/spacing/duration — `docs/development-principles.md`
§5) and verified in both themes and at a narrow (one-handed phone) width
(`docs/design.md` §6). This document enumerates the components and their
FR/state obligations; it does not restate `docs/design.md`/`docs/testing.md`
in full.

Every component consumes only the view models from `data-model.md` and the
use-case functions from `application/logging/` — never a `StoragePort`
type, never a raw `Load`/`Volume` union (`docs/architecture.md`'s
`presentation` row).

| Component | FRs | Notes on state obligations |
|---|---|---|
| `LoggingScreen` (root) | FR-001, FR-024 | Calls `openLoggingForm` on mount. No loading spinner while it resolves (constitution Principle II, `docs/design.md` §4.4) — the draft, once loaded, is what renders; there is nothing meaningfully "loading" from the user's perspective since the in-memory fake/real adapter both resolve fast enough to not need a spinner state here (contrast with e.g. an eventual large import, which does get one, per §4.4). |
| `SessionDateTimeField` | FR-001 | `<input type="datetime-local">` composed with tokens. Disabled state not applicable (always editable). |
| `BlockList` / `BlockCard` | FR-006, FR-007, FR-004, FR-023 | Unnamed block renders its position label (FR-007) — computed by `view-models.ts`, never hardcoded per-component. Delete action shows the 5-second undo (shared `UndoToast`, below). |
| `ExerciseEntryCard` | FR-002, FR-004 | Reorder handles need a keyboard-operable equivalent (`docs/design.md` §5 — "nothing essential revealed by hover/pointer only"), not just drag. |
| `ExerciseSearchField` | FR-002, FR-015, FR-016 | Debounced input calling `searchExercises`; shows most-used/most-recent first with no query (FR-002); "create new exercise" affordance always visible as the last result, never hidden behind a separate mode. |
| `LoadTypePicker` | FR-009 | One control choosing among Weight / Band / Bodyweight / Free text / None; remembers the exercise's default (FR-009). _(Amended by ADR-0006: per-set override is retired — this control edits the exercise's template directly, from the exercise's own menu, not per set; see `docs/requirements.md` FR-3.)_ |
| `WeightLoadInput` | FR-010, FR-026 | Numeric keypad by default; quick-increment buttons (research.md §9) that clamp at 0, never go negative (FR-010) — clamping is itself a visible state (the down-increment button shows disabled-with-reason at 0, not a silent no-op). _(Amended by ADR-0006: the quick-increment buttons are retired — numeric keypad entry only.)_ |
| `BandLoadInput` | FR-011 | Picks from the user's reorderable band-label list; a "manage labels" entry point (add/reorder/remove) is part of this component's contract, not a separate screen, since FR-011 doesn't specify a dedicated settings location and one doesn't exist yet (Non-Goals: Settings/FR-11 out of scope). |
| `BodyweightLoadInput` | FR-014, FR-026 | Signed added/assisted numeric field, −300..+300 clamp (matches domain `createLoad`'s own bound — this component clamps in the UI *and* the domain constructor still rejects out-of-range as defense in depth, per FR-014's own text). |
| `FreeTextLoadInput` | FR-012 | 40-char cap enforced in the input itself (not just on submit — a visible counter or hard stop, so the user isn't surprised at confirm time); autocomplete sourced from `suggestFreeTextLoads`. |
| `VolumeInput` (reps / duration / distance) | FR-008, FR-026 | Reps: integer-only keypad. Volume must be > 0 — same clamp-and-disabled-reason pattern as load. |
| `EffortPicker` | FR-013 | One-tap 1–5 control; every level always shows its word label next to the number (ADR-0003) — never a bare numeral in any state, including rest. |
| `SetConfirmControl` | FR-003, FR-019, FR-025 | Disabled-with-reason (not merely a silent no-op — spec.md's clarification allows either, this plan picks disabled-with-reason since `docs/testing.md`'s state convention already requires a stated reason for every disabled control, and "confirm" being visibly inert only when nothing is enterable is more legible than a tap that does nothing) until the pending set has a volume or a non-`none` load (FR-019). No visible "Save" anywhere (FR-003) — this control's label is about confirming/adding the set, never "Save". |
| `UndoToast` | FR-004, FR-023 | Shared by block/entry/set deletion. 5-second visible countdown or equivalent (reduced-motion-safe per `docs/design.md` §4.3 — the countdown's *information*, not just its animation, must survive reduced motion, e.g. a numeral alongside any shrinking bar). |
| `ExerciseCataloguePanel` (rename/merge/delete) | FR-017, FR-018, FR-020, FR-022 | Merge confirmation explicitly states "not undoable" in its copy (FR-017/SC-005) — this is the one destructive action on this screen's periphery with no `UndoToast`. Delete-with-history confirmation offers merge as the alternative in the same dialog (FR-018), not a separate flow. |

## Accessibility obligations carried from `docs/requirements.md` §7.4

- Every one of the above is reachable and operable via keyboard alone, not
  only touch/pointer.
- Effort, and any "personal record" style state introduced later, is never
  colour-only — words/icons accompany it (EffortPicker already satisfies
  this by design; no component in this table currently needs a
  colour-only state, but a component review checks this explicitly before
  merge, per `docs/design.md` §8's review checklist).
- Hit targets sized for one-handed, sweaty-hands use, especially
  `SetConfirmControl`, the quick-increment buttons, and `UndoToast`'s undo
  action.

## Verification

- Each component ships with a Testing-Library test querying by role/label
  (`docs/testing.md` "How a test is written here"), not by class or test id.
- A shared `test/support/` addition (if one proves necessary — e.g. a
  render-with-providers helper wiring the Zustand store + a fake
  `StoragePort`) goes in `test/support/` per the existing single-location
  rule, not duplicated per test file.
- `test/e2e/shell-smoke.spec.ts` gains (or a new `test/e2e/logging.spec.ts`
  adds) a browser-level smoke path: open the app, log a set, reload, see it
  restored from the draft — proving the optimistic-UI/no-spinner behavior
  and the draft round-trip against the in-memory-fake-backed dev build end
  to end, within this plan's stated scope (research.md §1 — this is still
  against the fake, not a real adapter; the smoke test proves the
  application wiring, not on-device durability).
