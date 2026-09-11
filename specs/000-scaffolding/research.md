# Phase 0 Research: Stack proposal

**Status**: proposed — awaiting project-owner approval before any task runs
(spec [Assumptions](./spec.md); constitution, Escalation).

Each concern below: **Decision**, **Rationale**, **Alternatives rejected**.
Constraints every choice had to satisfy: PWA installable + fully offline
after first load (ADR-0002); no outbound network call from the app
(constitution Escalation; `docs/requirements.md` §7.3); layered per
Principle V with a mechanically enforced boundary; design tokens as the only
visual-value source, light + dark from day one; one dependency per concern;
TypeScript strict throughout; small personal-tool scope (no build
complexity that a solo maintainer would not want to own).

---

## 1. Language — TypeScript 5.x, strict

**Decision**: TypeScript, `strict: true`, `noUncheckedIndexedAccess`,
targeting ES2022. Node 24 LTS for tooling and CI only.

**Rationale**: the domain rules in `docs/requirements.md` §3/§5 are
sum-types and invariants (Load, Volume, Effort) that a structural type
system checks well; strict mode is the "typing escape hatches are local,
loud, commented" rule from the constitution made default. Everything below
assumes TS.

**Alternatives rejected**: plain JS + JSDoc (loses exhaustiveness checks on
the Load/Volume unions the domain leans on); ReScript / Elm (smaller
ecosystems, worse PWA/tooling story, higher ramp for a solo project).

## 2. UI framework — React 19

**Decision**: React (function components and hooks). Proposed and approved
as React 18 on 2026-09-10; updated to React 19 on the owner's later
instruction to adopt each dependency's latest stable major except
TypeScript (`docs/stack.md` "Versions") — the rationale below is unchanged
by that version bump; it was never version-specific.

**Rationale**: largest ecosystem for the specific things later phases need —
Testing Library, Playwright component testing, charts, accessible primitives
— which matters more than raw runtime size for a diary app whose screens are
simple. `presentation/` stays a thin view layer consuming view models
(Principle V), so framework lock-in is limited to that layer.

**Alternatives rejected**:
- **Svelte / SvelteKit** — smaller output, genuinely attractive, but the
  boundary-lint story (`eslint-plugin-boundaries`) and Testing Library
  ergonomics are weaker, and SvelteKit pulls in an app framework and a
  server concept this local-first PWA does not want.
- **Solid** — excellent runtime, much smaller ecosystem for a11y primitives
  and charts; risk of needing an ADR-level dependency later that React
  already has covered.
- **Vue** — viable; React chosen on ecosystem depth for testing + charts and
  on the reviewer's familiarity, not on technical superiority.
- **No framework / Web Components** — hand-rolling state + a11y for the
  logging screen (undo, optimistic updates, focus management) is exactly the
  work a framework removes; rejected as false economy.

## 3. Build tool — Vite 8

**Decision**: Vite as bundler and dev server. Proposed and approved as
Vite 5 on 2026-09-10; updated to Vite 8 under the same later
latest-stable-major instruction as §2.

**Rationale**: near-zero-config for a React+TS PWA, fast HMR, first-class
`vite-plugin-pwa`, native test runner (Vitest) sharing the same config and
transform pipeline — one toolchain, not three. ADR-0002 explicitly left the
build tool to this phase.

**Alternatives rejected**: Webpack (heavier config surface, slower, no
benefit here); Parcel (less active, thinner PWA plugin ecosystem); esbuild
/ Rollup directly (Vite already wraps Rollup and adds the dev server + PWA
+ test integration we would otherwise assemble by hand); Next.js / Remix
(server frameworks; this app has no server and must not grow one).

## 4. State management — Zustand

**Decision**: Zustand for cross-component application state (session in
progress, undo timers, the single logging draft from spec 001 FR-024).

**Rationale**: a tiny (~1 KB) store with no provider tree, no boilerplate,
and a plain-function API that lives naturally in the `application` layer as
a view-model/session-state holder without dragging React into that layer
(the store is framework-agnostic; `presentation` subscribes). Testable with
plain calls, satisfying Principle IV's "verifiable without the framework".

**Alternatives rejected**:
- **Redux Toolkit** — more ceremony (slices, actions, store setup) than a
  personal diary needs; its main wins (devtools, middleware, time-travel)
  are not worth the weight here.
- **React Context + useReducer** — fine for one slice, but the app has
  several independent pieces of session state and Context re-render
  granularity becomes a problem exactly on the logging screen where
  Principle II forbids jank.
- **Jotai / Valtio** — comparable size; Zustand's explicit store reads more
  clearly as "application state" outside the component tree, which suits the
  layering rule.
- **XState** — the session/draft model after the 2026-09-09 decisions has
  *no* lifecycle state machine (no open/closed), so a statechart library
  would be solving a problem the domain deliberately removed.

## 5. Service worker / offline precache — vite-plugin-pwa (Workbox)

**Decision**: `vite-plugin-pwa` in `injectManifest` or `generateSW` mode,
precaching the app shell; Workbox under the hood.

**Rationale**: ADR-0002 requires "installable and usable offline after first
load (service worker precaching the app shell)". `vite-plugin-pwa` is the
standard, actively maintained way to do this with Vite; it generates the
manifest + SW and handles precache revisioning. Phase 0 wires it for the
empty shell so offline is real from the first commit, not retrofitted.

**Alternatives rejected**: hand-written service worker (precache
invalidation and update flow are subtle and exactly what Workbox has
solved); `@remix-run/serve` / framework SW (no framework SW in play); no SW
(violates ADR-0002 and `docs/requirements.md` §7.2).

## 6. Storage — one port, Dexie for IndexedDB, hand-written File System Access adapter

**Decision**: the `application` storage port interface is hand-written in
domain terms (FR-013). Phase 2 implements two adapters behind it:
- **IndexedDB adapter** wraps **Dexie 4**.
- **File System Access adapter** is hand-written against the browser API
  directly — **no wrapper library**.

Phase 0 ships only the port interface and its in-memory fake (FR-014).

**Rationale**:
- Dexie turns IndexedDB's callback/transaction ceremony into a small
  promise API with typed tables and a clean migration hook — which maps
  directly onto `docs/requirements.md` §6's versioned-schema /
  auto-migrate rules. It stays *behind* the port; domain/application never
  import it (Principle IV).
- The File System Access API surface the app needs (pick a directory,
  read/write/enumerate files, persist a handle) is small and stable enough
  that a wrapper would be a dependency with more API than value; the "one
  dependency per concern" rule pushes toward hand-writing it.

**Alternatives rejected**:
- **idb (Jake Archibald)** instead of Dexie — lighter, but Dexie's typed
  tables + versioned migrations save real code against §6; the size delta
  is small for a local app.
- **localForage** — abstracts over IndexedDB/localStorage/WebSQL, but hides
  the schema/versioning control §6 needs and the WebSQL path is dead.
- **A wrapper for File System Access** (e.g. `browser-fs-access`) — mostly a
  fallback-to-`<input>` shim we do not want; the real API is enough.
- **One storage library for both** — impossible; the two browser APIs are
  unrelated. The port is what unifies them (ADR-0002), not a library.

## 7. Charts — Recharts

**Decision**: Recharts. Named now, unused until Phase 4/5 (progression
charts, insights), listed in `docs/stack.md` so a later add is not a
surprise escalation ("one dependency per concern").

**Rationale**: declarative React components, SVG output (crisp, themeable
via the design tokens, no canvas), covers line charts with range selectors
and reference lines — exactly `docs/requirements.md` FR-8's needs (e1RM over
time, PR markers, 7-day moving average). Reasonable bundle size, and
tree-shakes to the chart types used.

**Alternatives rejected**:
- **visx** — lower-level (D3 primitives as React components); more control,
  more code to write for standard line charts we do not need to customize
  deeply.
- **Chart.js / react-chartjs-2** — canvas-based, harder to theme from CSS
  custom properties and to make accessible; imperative config object fights
  the component model.
- **D3 directly** — a charting toolkit, not a charting library; too much
  bespoke code for a personal app.
- **Nivo** — nice defaults but heavier and pulls a large dependency tree.

## 8. Navigation — React Router 7

**Decision**: React Router in `createBrowserRouter` / data-router mode,
client-side only. Proposed and approved as React Router 6 on 2026-09-10;
updated to 7 under the same later latest-stable-major instruction as §2.

**Rationale**: the app has a handful of routes (log, diary, exercise
detail, body, settings); React Router is the default, well-understood
choice, works offline as pure client routing, and integrates with the PWA
shell. `presentation` owns routing; no other layer sees it.

**Alternatives rejected**: TanStack Router (excellent type-safety, but
newer and heavier than a 5-route app needs); wouter (tiny, but React
Router's data APIs and scroll/focus management are worth the size for an
a11y-serious app per `docs/requirements.md` §7.4); hand-rolled
`history`-based routing (reinventing focus/scroll/restore handling).

## 9. Test runner — Vitest

**Decision**: Vitest for unit and integration tests; one runner, one
config, shared with Vite. jsdom environment for component/DOM tests, node
for pure-logic tests.

**Rationale**: Vite-native (same transforms, no separate Babel/ts-jest
config), Jest-compatible API, fast watch mode, first-class TS and ESM.
Satisfies FR-021's "same test runner named in `docs/stack.md`" for the
smoke test too — except the *browser* smoke test (see 10), which Vitest
runs as a Playwright spec via its runner integration or which we run
directly with Playwright and still report into the same CI test job.

**Alternatives rejected**: Jest (needs ts-jest/babel + separate config,
slower ESM story, no Vite integration); Node's built-in test runner (thin
assertion/mocking story, weak watch/UI, no jsdom integration); ava
(smaller ecosystem for React testing).

## 10. Component/DOM testing — Testing Library; browser smoke — Playwright

**Decision**:
- `@testing-library/react` + `@testing-library/user-event` for
  component-level tests (used heavily from Phase 3).
- **Playwright** for the Phase 0 launch smoke test (FR-021) and later E2E.

**Rationale**: Testing Library's query-by-accessible-role API pushes tests
toward the a11y contract `docs/requirements.md` §7.4 requires. Playwright
gives a real browser to assert "the PWA shell actually renders and the
service worker registers" — something jsdom cannot verify — and is the
strongest cross-browser E2E tool for later (iOS Safari via WebKit).

**Alternatives rejected**: Cypress (heavier, slower, weaker WebKit/Safari
story, its own runner rather than folding into the CI test step);
Playwright Component Testing instead of Testing Library (still experimental
for React, and Testing Library's ecosystem/queries are the a11y-forcing
function we want); Puppeteer (Chromium-only — misses the Safari path
ADR-0002 makes central).

## 11. Lint + layer boundary — ESLint 9 flat config + eslint-plugin-boundaries

**Decision**: ESLint 9 (flat config, `eslint.config.js`) with
`@typescript-eslint`, `eslint-plugin-react` / `react-hooks`, and
**`eslint-plugin-boundaries`** configured with element types for `domain`,
`application`, `infrastructure`, `presentation`, `presentation/design`, and
`shared`, plus an allowed-dependencies matrix that encodes the
forbidden-edge table from `docs/architecture.md` (FR-009). Verified by
FR-008's deliberate illegal imports, including one routed through
`src/application/index.ts` (barrel) to prove FR-006/FR-007 coverage.

**Rationale**: `eslint-plugin-boundaries` matches elements by path pattern
and fails lint (hence the CI gate, FR-001) on a disallowed import — direct
or via a re-export — which is exactly FR-005/006/007. Keeping it in ESLint
(not a separate tool like dependency-cruiser) means the layer rule rides
the lint check the Definition of Done already requires, no extra CI step.

**Alternatives rejected**:
- **dependency-cruiser** — powerful and would work, but it is a second
  tool + second CI step for a rule ESLint can carry; "one dependency per
  concern" favors folding it into lint.
- **import/no-restricted-paths** (eslint-plugin-import) — can express
  some of this but is clumsier for a 6-node layer matrix and barrel
  re-exports; `boundaries` is purpose-built.
- **TS project references / `paths` tricks** — enforce compilation units,
  not import direction; do not fail on a wrong-direction import within one
  package.
- **Nx / module-boundary tags** — brings a monorepo tool for a
  single-project repo.

## 12. Formatting — Prettier

**Decision**: Prettier, default config bar a couple of house settings
(print width, single quotes), run as its own `format:check` in CI folded
into the lint check or as a sibling step.

**Rationale**: universal, zero-argument formatter; removes style from
review entirely. ESLint handles correctness, Prettier handles layout — the
standard split, no overlap (so "one dependency per concern" is satisfied:
they cover different concerns).

**Alternatives rejected**: ESLint stylistic rules for formatting
(deprecated split-off into `@stylistic`, and fighting Prettier is a known
anti-pattern); Biome (single fast tool for lint+format — genuinely
tempting, but its React and boundary-rule story is less mature than
ESLint+`boundaries`, and switching later is cheap; revisit at v1); dprint
(niche).

## 13. Design tokens — CSS custom properties + typed accessors

**Decision**: tokens defined as CSS custom properties in
`src/presentation/design/tokens.css` under `:root` (light) and a
`[data-theme="dark"]` / `@media (prefers-color-scheme: dark)` block (dark),
covering every `docs/design.md` §3.1 role (Canvas; Surface / surface-raised;
Foreground / foreground-muted / foreground-subtle; Border / border-strong;
Accent / accent-foreground; Focus ring; Danger / warning / success) plus
radii, durations, easings, and spacing scales. A small `tokens.ts` exports
the token *names* (not values) for typed use and to make "is this token
present" a compile-time question.

**Rationale**: CSS custom properties are the native, zero-runtime way to do
theming that flips light/dark without re-render and without a CSS-in-JS
dependency; they satisfy "colours named by role, never by hue" and "design
tokens the only source of visual values" (Principle V;
`docs/development-principles.md` §5) directly. `tokens.ts` gives FR-019 its
mechanical check (an enumerated expected set) and lets a lint rule ban
literal colours outside the module (SC-007).

**Alternatives rejected**:
- **CSS-in-JS (styled-components / Emotion)** — a runtime dependency and a
  render-path cost for theming that CSS variables do for free; also fights
  the "no literal values at the use site" rule less cleanly.
- **Tailwind** — utility classes put spacing/color decisions back at the
  use site as class strings, the opposite of centralized named tokens;
  `docs/design.md` §3.1's role model is not how Tailwind's palette works
  without heavy config.
- **A design-token build pipeline (Style Dictionary)** — overkill for one
  target (web); revisit only if a second platform ever appears.
- **vanilla-extract** — typed CSS with zero runtime is attractive; deferred
  because plain CSS custom properties + a names file already meet every FR
  and add no dependency.

## 14. Deferred concerns (named, not chosen)

- **Date/time** — spec 001's date-time-at-form-open and "no midnight
  rollover" logic is arithmetic over timestamps; the platform `Date` +
  `Intl.DateTimeFormat` are expected to suffice. Decided in the Phase 1
  spec/plan; an ADR only if a library (e.g. `date-fns`, Temporal polyfill)
  proves necessary.
- **Fuzzy search** — `docs/requirements.md` FR-7 / spec 001 FR-016
  (accent- and typo-tolerant search over ≤ 500 exercises). Candidates:
  Fuse.js, `uFuzzy`, or a hand-rolled normalized-substring + Levenshtein
  pass. Decided in the Phase 4 (diary/search) spec, where the perf target
  (< 100 ms) and matching semantics are specified.

## 15. CI platform — GitHub Actions

**Decision**: GitHub Actions (`.github/workflows/ci.yml`), one workflow:
`typecheck` (`tsc --noEmit`) + `test` (`vitest run` + the Playwright smoke)
+ `lint` (`eslint .` including `boundaries`, plus `prettier --check`).
Triggered on `pull_request` and on `push` to the default branch. Branch
protection on the default branch marks these checks Required (FR-002).

**Rationale**: the repo is already on GitHub (`origin`
github.com/adrisons/gym-log-app); Actions is the native, no-extra-account
option; required-status-checks + branch protection is the standard
mechanism that makes a red gate actually block merge.

**Alternatives rejected**: any external CI (CircleCI, etc. — a second
account and integration for no benefit on a personal repo); pre-commit
hooks *instead of* CI (bypassable, not a gate — fine as an optional local
convenience, not the gate FR-002 needs).
