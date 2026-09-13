# Design criteria

The written criteria behind every interface decision in **gym-log**. This
document explains *why* and *what*; the *how* (concrete values, components,
implementation) belongs to a later technical phase and its own design-token
artifact. Nothing here names a framework, a library, or a file format —
those are technical decisions, out of scope for this document.

**Binding for agents.** Read this before proposing any screen, flow, or
visual treatment. Two rules override personal taste:

1. **No hardcoded values.** Colors, radii, durations, easings and spacing
   are decisions, named and centralized as design tokens (see
   `docs/development-principles.md` §5) — never repeated as literals at the
   point of use.
2. **Never say "smooth" or "nice".** Every motion or spacing decision names
   what it is trying to achieve in concrete, reviewable terms — a duration
   category, a specific easing behavior, a specific spacing role — not a
   vague adjective.

---

## 1. Product character

A personal training diary. The interface is a **fast, honest logbook**: it
gets out of the way while the user is mid-set, and it never asks for more
attention than logging a number requires. Not a dashboard, not a coach, not
a social feed.

Five adjectives to resolve arguments: **immediate, sturdy, legible, calm,
honest.**

"Immediate" means every interaction the user performs while training
responds instantly and visibly, with nothing waiting on confirmation.
"Sturdy" means the interface tolerates a rushed, imprecise, one-handed tap
without punishing the user for it — generous targets, forgiving defaults,
nothing that requires precision under fatigue. "Honest" means the app never
dresses up a number: no artificial encouragement, no alarm colors on body
data, no invented confidence in an estimate the data doesn't support (see
`docs/requirements.md` §5.7 on data sufficiency — a chart or insight that
lacks enough data says so plainly instead of guessing).

### 1.1 Brand tone — how the app talks

The app is a **quiet training partner who states facts**, not a coach with
opinions and not a scoreboard with a personality. Every string in the
interface follows these:

- **Second person, present tense, plain words.** "Choose an exercise," not
  "Exercise selection required." "No trend yet — three more sessions to
  see it," not "Insufficient data for analysis."
- **Short.** A label is one to three words; a description is one sentence.
- **Never editorializing.** The app records what happened; it does not
  praise, warn, or judge. A personal record is stated as a fact ("Heaviest
  set yet"), never as congratulation with exclamation marks. **One narrowly
  bounded exception**: returning to the diary immediately after logging a
  session shows a single brief, non-blocking, self-dismissing
  acknowledgement that the session was saved (`docs/requirements.md`
  FR-1) — it exists only there, carries no number, streak, or comparison,
  never blocks or requires dismissal, and does not recur anywhere else in
  the app. It is a save confirmation, not encouragement, and the exception
  is this specific and this small on purpose — it does not open the door
  to praise or streaks elsewhere. This is also the one place §1.2's
  "no imagery" is knowingly relaxed: the acknowledgement may carry a small
  emoji, plus a brief, purely decorative glow/sparkle flourish around it
  (matching the reference canvas's own toast — never on any other toast in
  the app, and always `aria-hidden` since the text is what actually
  confirms the save), as its one visual expression. Motion respects
  reduced-motion (§4.3): with it on, the flourish is hidden outright
  rather than left as a static, permanently-visible glow — the content is
  still what confirms the save either way.
- **Errors state the fact, then the fix**, and never blame the user: "That
  set wasn't saved. Your other sets are safe," followed by what to try next.
  No technical codes in the sentence.
- **Empty and below-threshold states name what's missing and stop** — "Log
  this exercise 3 more times to see its trend," never a blank space that
  looks broken.
- **Sentence case everywhere**, except short structural section labels.

### 1.2 Visual identity

- **Type**: one legible, humanist typeface for everything read at length,
  and one monospaced or tabular-figure treatment reserved for numbers that
  need to align in a column (loads, reps, dates) so they don't visually
  jitter as digits change. No more than two type roles.
- **Icons**: line icons only, consistent stroke weight, on a fixed grid.
  Icons are never the only carrier of meaning — a state communicated by an
  icon is always also stated in a word (`docs/requirements.md` §7.4).
- **Color**: one chromatic accent used for primary actions and current
  selection. Everything else is neutral. Status colors (success, warning,
  danger) are reserved for status and never reused decoratively — no
  chromatic "good/bad" coding of a training number.
- **Imagery**: none. No illustrations, no mascots, no stock photography —
  the interface is entirely typographic and numeric. Nothing competes with
  the number the user is trying to read at a glance.
- **Corners and edges**: every surface — structural (cards, panels) and
  interactive (buttons, the active input) alike — shares one rounded
  identity; "this is interactive" reads from weight, color and position,
  never from being the only rounded thing on an otherwise hard-edged
  screen. A control the user directly taps may round further toward a full
  pill where that reads as more clearly tappable (the confirm-style
  actions, the floating action); structural cards stay at the base radius.
  Superseded: the original identity's opposite convention (square
  structural surfaces, small radius reserved for interactive elements) —
  see the refinement note below.

**Visual identity, decided**: the concrete values realizing the criteria
above (palette, the two type roles, the corner-radius system) were chosen
through a design exploration and confirmed by the project owner; they live
as tokens in `src/presentation/design/tokens.css`/`tokens.ts`, never here
(§7). Section headings and primary titles use a heavier weight for
hierarchy — through weight, not through repetition or an uppercase
treatment.

**Refinement note (this pass)**: the original "Electric" identity (square
structural surfaces, all-caps headings) was revisited end-to-end through a
Claude Design canvas exploration and confirmed by the project owner as the
new reference to follow. What changed: corners moved from the
square/small-radius split to one rounded system (above); headings dropped
the uppercase treatment in favor of weight alone; the effort control
(FR-4) shows its 1–5 scale as a graduated intensity — 1–2 in the success
role, 3–4 in the warning role, 5 in the danger role — always alongside the
numeral (§3.3's rule that color never stands alone still holds; this is a
new use of the existing status roles, not a new role). The neutral scale itself moved from a cool gray to a warm, slightly
off-white/off-black cast in both themes — still meeting the same contrast
minimums (§3.3) — while the accent and status (danger/warning/success)
hues are unchanged. What did not change: the accent and status hues; the
two type roles; "no imagery, no illustrations" (only the §1.1 bounded
exception above); every rule in §2 through §6 below.

---

## 2. Design principles

**Legibility over density.** A gym is not an office: the reading distance,
the lighting, and the user's attention are all worse than at a desk. Given
a choice between fitting more on a screen and making what's there easier to
read at a glance, choose legibility.

**Defaults over decisions.** Every field that can be pre-filled from the
user's last relevant entry should be (`docs/requirements.md` FR-3) — the
interface's job during logging is to minimize decisions, not to present
options.

**One clear primary action per screen** during logging — the next thing to
tap should never be ambiguous. Secondary actions (edit, delete, reorder)
are present but visually quieter.

**Destructive actions read the same at every level.** Deleting a block, an
exercise entry, or a set is offered through the same affordance (a
secondary, visually quiet menu next to the thing it acts on) at every
level of that hierarchy — a user who has found it once at one level has
found it everywhere, rather than a block getting a menu and a set getting
a bare button.

**Structure can be collapsed without being lost.** A block long enough to
push the next one off-screen can be collapsed to its header (name,
position, summary counts) and expanded again — the goal is a long session
staying scannable, never hiding data the user would otherwise have to
delete to regain legibility.

**No decoration that costs attention.** Motion, color, and imagery exist
only where they communicate state or guide focus. Anything ornamental that
does not serve legibility or feedback is cut.

---

## 3. Color

### 3.1 Token roles

Colors are declared as **roles**, never as hues, and consumed by role name
everywhere in the interface (`docs/requirements.md` §7.5: "Colours named by
role, never by hue"). The canonical set of roles, defined once a technical
implementation exists:

| Role | Purpose |
|---|---|
| Canvas | App background, lowest layer |
| Surface / surface-raised | Panels, cards, the active input row |
| Foreground / foreground-muted / foreground-subtle | Three text weights, no more |
| Border / border-strong | Hairline and region dividers |
| Accent / accent-foreground | Primary action pair |
| Focus ring | Focus indication only, never decorative |
| Danger / warning / success | Status only, always paired with an icon or word |

No token exists for "encouragement" or "alarm" — every number in this app is
presented with the same neutral roles, per the "never editorializing"
principle in §1.1.

### 3.2 Light and dark

Both themes are first-class from the start, defined together, never one
derived automatically from the other after the fact. Neutrals stay
perceptually consistent between the two — the same role should read as the
"same idea" in both themes, just inverted in lightness. Every screen is
reviewed in both.

### 3.3 Contrast rules

- Body text and muted text both meet a standard minimum contrast against
  their own surface — "muted" reduces visual weight, never legibility.
- State is never encoded in color alone: effort, personal records, and
  errors always carry an icon or a word alongside any color
  (`docs/requirements.md` §7.4).

---

## 4. Motion

### 4.1 Purpose before polish

Motion exists to answer two questions: *did my tap register*, and *where
did that thing go*. Anything that doesn't answer one of those is
decoration, and decoration is cut on this screen — the logging flow does
not have attention to spend on it.

A small, fixed set of duration and easing categories is defined once
implementation begins (a quick category for press/hover feedback, a
standard category for panels and transitions, a deliberate category for
larger layout shifts) — never an ad hoc value chosen per component.

### 4.2 Feedback is immediate

Every tap gives a visible response within the "quick" category — before
any write is confirmed, per the optimistic-update rule in
`docs/requirements.md` §7.1 ("the UI updates first, the write is confirmed
after"). A control that only reacts once a write completes is a bug, not a
style choice.

### 4.3 Reduced motion

A user's reduced-motion preference is honored everywhere, and honoring it
never removes information — a state that was communicated by movement is
still communicated some other way when motion is reduced
(`docs/requirements.md` §7.4).

### 4.4 No loading spinners on the logging path

Recording a set never shows a blocking loading state — writes are
optimistic (§4.2). Any place that genuinely waits on something slow (e.g. a
large import) shows progress, not an indefinite spinner.

---

## 5. Interaction states

Every interactive element ships all of the following states. An element
shipped with fewer is incomplete:

| State | Expectation |
|---|---|
| Rest | Default appearance |
| Hover | Available on pointer input only; never the sole way to discover an action |
| Active / pressed | Immediate, visible feedback |
| Focus-visible | A clear, consistent focus indicator, reachable by keyboard alone |
| Disabled | Reduced visual weight, and a stated reason wherever the reason isn't obvious |
| Loading | Used only where a wait is genuinely unavoidable (§4.4) |

- The whole app is reachable and operable without a pointer
  (`docs/requirements.md` §7.4).
- Nothing essential is revealed by hover only — every hover-revealed
  affordance has an equivalent that works on touch and keyboard.
- Hit targets are generous everywhere, and especially on the logging
  screen, which must stay usable one-handed and with sweaty hands
  (`docs/requirements.md` §7.4).

---

## 6. Layout and responsiveness

Both a narrow, one-handed phone layout and a wider layout are first-class
targets, reviewed together (`docs/requirements.md` §7.5). The logging
screen in particular is designed for one thumb: primary actions sit within
easy reach, and the layout never requires a two-handed gesture to record a
set.

Charts and lists that carry more information (progression, insights,
history) are allowed more density on a wider layout, but never at the cost
of legibility on the narrow one — content reflows and re-prioritizes rather
than shrinking past a readable size.

The logging form itself is reached from a floating action on the diary,
not a permanent slot in the primary navigation (`docs/requirements.md`
FR-1) — the primary navigation surfaces destinations the user returns to
repeatedly (diary, search, insights, exercises); logging is instead the
thing the user does *from* one of those, one prominent tap away, so the
navigation never carries a tab that sits idle between sessions.

Text wraps; it never scrolls sideways to be read.

---

## 7. From criteria to values

The flow from this document to a working interface is one-directional and
happens in a later technical phase:

```
design principles  →  this document (criteria in prose)  →  design tokens (named values)  →  components
```

- **Adding a new visual role** starts here — describe why it's needed —
  before any concrete value is chosen for it.
- **Changing a value** never changes the meaning of a role without this
  document being updated to match.
- The specific mechanism for defining and switching themes is a technical
  decision made when implementation begins; this document only requires
  that both themes exist from day one and that neither is treated as an
  afterthought.

---

## 8. Review checklist

- [ ] No literal color, spacing, duration, or radius value introduced
      outside a named token.
- [ ] All required interaction states present, including keyboard focus.
- [ ] Verified in both light and dark themes, and at a narrow, one-handed
      width.
- [ ] Reduced-motion path checked and loses no information.
- [ ] Status communicated by icon or word, not color alone.
- [ ] Body-composition figures carry no alarm color, target, or judgement.
- [ ] No loading state blocks the logging path.
- [ ] Copy follows §1.1: second person, present tense, no editorializing.
