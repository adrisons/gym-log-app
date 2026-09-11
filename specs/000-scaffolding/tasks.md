---

description: "Task list for Phase 0 — Project Scaffolding"
---

# Tasks: Project Scaffolding (Phase 0)

**Input**: Design documents from `specs/000-scaffolding/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/storage-port.md, quickstart.md — all present. Stack approved by
the project owner 2026-09-10.

**Tests**: INCLUDED. Several Phase 0 deliverables *are* tests or test
infrastructure (the smoke test FR-021, the storage-port-fake self-test, the
boundary edge-set check FR-009, the integration-harness test FR-016), so
test tasks are first-class here, not optional.

**Organization**: by user story (US1–US5 from spec.md). Each story is an
independently verifiable slice of the Phase 0 deliverable.

**Status (2026-09-11): Phase 0 DONE — PR #3 merged to `main`** (T001–T046
done, T047 partial, 46.5/47). Every user story (US1–US5) and all of Polish
except the branch-protection half of T047 are complete; the full gate
(typecheck, lint, prettier, no-color-literals, 82 unit tests, e2e/build) is
green — re-verified on `main` post-merge with a clean `npm ci`, not just on
the PR branch. `specs/000-scaffolding/quickstart.md` was run end to end (all
6 sections pass).

**Next**: per `docs/agent-brief.md` §3's build order, Phase 1 is "Domain and
ports" (entities, value objects — Load/Volume/Effort —,
`docs/requirements.md` §3.3/§5 business rules, ports + in-memory fakes; no
real I/O, no UI) — **no spec for this exists yet under `specs/`**.
`specs/001-log-a-session/spec.md` (numbered 001, but functionally
`docs/agent-brief.md`'s **Phase 3** — "Logging", FR-1..FR-5, the MVP
critical path) has already been through its spec-reviewer/clarify cycle,
but per the build order it should not be planned/implemented before a
Phase 1 domain spec and a Phase 2 persistence spec exist and are built —
spec 001 depends on the domain entities and storage adapters those phases
would produce. Decide with the project owner whether to (a) write and run
a Phase 1 (domain/ports) spec next, in build-order sequence, or (b)
deliberately reorder and take spec 001 next regardless, and record that
choice. Do not assume (b) silently.

Once whichever spec is chosen is reached, the user has asked to generate
UI mockups (full form flow: open/draft session, add block+exercise, add
sets, merge duplicate exercise, delete block with undo) as part of that
spec's `/speckit-plan` research/design phase, before `/speckit-tasks` —
this preference was recorded before the build-order question above was
noticed and still applies to spec 001 whenever it is actually planned.

Fixed during PR #3 code review (GitHub Copilot), all re-verified: (1) the
composition-root element misclassification (main.tsx never actually
classified as its own type); (2) `ci-gate` reporting green on a `skipped`
dependency job; (3) `presentation` could import `application-ports`
directly, contradicting the port's own contract; (4) the `application`
barrel re-exported persistence types that leaked the same violation; (5)
`presentation` could import the composition root as an ordinary same-layer
("internal") dependency, bypassing the boundary rule entirely; (6)
`check-no-color-literals.sh`'s `|| true` masked real `grep` failures; (7)
`app-shell.css` lacked a body-margin reset; (8) `in-memory-storage.ts`
compared ISO date strings instead of parsed instants; (9) a test `as never`
cast defeated its own claimed type-exactness check; (10) the PWA manifest
had no icons, so the shell was not actually installable; (11) a quickstart
command routed its argument to the wrong npm script; (12) `plan.md` /
`research.md` still named the pre-upgrade stack majors (React 18/Vite
5/Router 6) instead of what's implemented. See `docs/architecture.md`
"Composition-root classification", `test/boundaries/README.md` cases
9–13, and the individual file diffs for detail on each.

T047's branch-protection verification is UNVERIFIED, not a code defect —
see that task's note: this private repo's GitHub plan returns 403 on the
branch-protection API.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an
  incomplete task)
- **[Story]**: US1–US5; Setup / Foundational / Polish carry no story label

## Path Conventions

Single-project web app. `src/`, `test/`, `docs/`, `.github/workflows/` at
repo root, per plan.md "Project Structure".

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: bring the toolchain from research.md into an installable,
buildable repository.

- [X] T001 Initialize the Node project: `package.json` (name `gym-log`,
      `"type": "module"`, private), `.nvmrc` / `engines` pinning Node 24,
      `.gitignore` already covers `node_modules/` `dist/` — add `coverage/`
      and `playwright-report/`.
- [X] T002 Add and pin dependencies from research.md: `react`, `react-dom`,
      `react-router-dom@6`, `zustand`, `dexie`, `recharts` (runtime);
      `vite@5`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `typescript@5`,
      `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`,
      `@testing-library/user-event`, `@testing-library/jest-dom`,
      `@playwright/test`, `eslint@9`, `@typescript-eslint/*`,
      `eslint-plugin-react`, `eslint-plugin-react-hooks`,
      `eslint-plugin-boundaries`, `prettier`, `eslint-config-prettier`
      (dev). Exact versions committed to the lockfile.
- [X] T003 [P] Create `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`,
      `target` ES2022, `module`/`moduleResolution` bundler, `jsx`
      react-jsx, `paths` for `@/*` → `src/*`, `include` `src` + `test`.
- [X] T004 [P] Create `vite.config.ts`: `@vitejs/plugin-react`,
      `vite-plugin-pwa` with `registerType: 'autoUpdate'` and a manifest
      stub (name, short_name, theme_color from a token, display
      `standalone`), `test` block delegating to Vitest (jsdom env,
      `setupFiles` → `test/support/setup.ts`, coverage provider v8).
- [X] T005 [P] Create `prettier` config (`.prettierrc`: printWidth 80,
      singleQuote true, semi true) and `.prettierignore` (`dist`, `coverage`,
      `playwright-report`, `*.md` left to the editor).
- [X] T006 [P] Create `playwright.config.ts`: `testDir` `test/e2e`,
      `webServer` running `npm run dev` (or `preview`), projects for
      Chromium and WebKit (WebKit covers the iOS Safari path from ADR-0002),
      `reporter` list + html.
- [X] T007 Create the `src/` and `test/` directory skeleton with
      `.gitkeep` in `src/domain/`, `src/infrastructure/`, `src/shared/`,
      matching plan.md "Project Structure".
- [X] T008 Add `package.json` scripts, and make them the single documented
      way to run each check (FR-003): `dev` (`vite`), `build`
      (`tsc --noEmit && vite build`), `preview`, `typecheck`
      (`tsc --noEmit`), `test` (`vitest run && playwright test`), `test:unit`
      (`vitest run`), `test:e2e` (`playwright test`), `lint`
      (`eslint . && prettier --check .`), `lint:fix`.

**Checkpoint**: `npm ci` succeeds; `npm run build` produces a bundle from an
empty entry. No app behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the layer graph, its enforcement, and the composition seam —
everything the five stories build on.

**⚠️ CRITICAL**: no story phase starts until this is done.

- [X] T009 Create `eslint.config.js` (flat): base JS + `@typescript-eslint`
      + `react` + `react-hooks` + `eslint-config-prettier`, then
      `eslint-plugin-boundaries` with `settings['boundaries/elements']`
      matching path patterns for `domain`, `application`,
      `application-ports` (`src/application/ports/*`), `infrastructure`,
      `presentation`, `presentation-design` (`src/presentation/design/*`),
      `shared`, and `composition-root` (`src/presentation/main.tsx`).
- [X] T010 In `eslint.config.js`, add the `boundaries/element-types` rule,
      building its options from the shared `eslint.boundaries.js` module
      (see T024) which encodes the forbidden-edge table from data-model.md
      §3 exactly: `domain` → nothing internal; `application` → `domain`
      only; `infrastructure` → `application` + `domain`; `presentation` →
      `application` + `presentation-design`; `presentation-design` →
      nothing internal; `shared` → nothing internal; `composition-root` →
      all. Default `disallow`.
- [X] T011 Create `src/application/ports/storage-port.ts` — the `StoragePort`
      interface from contracts/storage-port.md: `saveSession`, `getSession`,
      `listSessions`, `deleteSession`, `saveExercise`, `getExercise`,
      `listExercises`, `getSchemaVersion`, `setSchemaVersion`, all
      `Promise`-returning, all in domain vocabulary (no storage terms).
      Placeholder types (`SessionId = string`, `SessionRecord = { id:
      SessionId } & Record<string, unknown>`, `DateRange`, etc.) with a
      comment that Phase 1 owns and may reshape this.
- [X] T012 Create `src/application/index.ts` — a barrel that re-exports
      `StoragePort` and the placeholder types. This exists specifically so
      T024 can prove the boundary rule catches a barrel-routed illegal
      import (FR-006).
- [X] T013 [P] Create `src/application/errors.ts` — a `StorageError` stub
      (application-layer error type the port rejects with; policy finalized
      in Phase 1).
- [X] T014 Create `test/support/setup.ts` — Vitest setup:
      `@testing-library/jest-dom` matchers, `afterEach(cleanup)`.
- [X] T015 Create `.github/workflows/ci.yml` — one workflow, triggers
      `pull_request` and `push` to the default branch. Jobs/steps: checkout,
      setup-node 24 with cache, `npm ci`, then `npm run typecheck`,
      `npm run lint`, `npm run test:unit`, `npx playwright install --with-deps`
      + `npm run test:e2e`. Fail the job if any step fails. Do NOT use
      `continue-on-error`. Run Vitest with `--passWithNoTests=false` (its
      real flag — a zero-test collection then fails the step) to satisfy
      FR-004's zero-test case; set it in the `test:unit` script or
      `vite.config.ts` test config. (A1 from /speckit-analyze)
- [X] T016 Document the checks in `README.md`: a "Development" section
      listing the exact commands from T008 and stating CI runs the same
      ones (FR-003). Note Node 24, `npm ci`, `npm run dev`.

**Checkpoint**: `npm run lint` runs the boundary rule; CI workflow is
present; the port interface and barrel exist. Enforcement is not yet
*verified* (that is US2).

---

## Phase 3: User Story 4 — The stack is decided and bounded (Priority: P1)

**Goal**: `docs/stack.md` records one tool per concern + the "not without an
ADR" boundary, consistent with ADR-0002.

**Independent Test**: every concern in FR-010 names exactly one tool (or an
explicit "none" / "deferred to Phase N"); the "not without an ADR" list is
present; the storage section matches ADR-0002. Verifiable by reading the
file.

> US4 is sequenced first among the stories because `docs/stack.md` is the
> record the owner approved and every other doc/config references it.

- [X] T017 [US4] Create `docs/stack.md` — a table of one tool per concern
      from research.md: PWA framework (React 18 + TS), build (Vite 5), state
      (Zustand), service worker (`vite-plugin-pwa`/Workbox), IndexedDB
      helper (Dexie 4), File System Access helper ("none, hand-written
      adapter"), charts (Recharts — note: unused until Phase 4/5),
      navigation (React Router 6), test runner (Vitest), component testing
      (Testing Library), E2E/smoke (Playwright), lint (ESLint 9 flat +
      `eslint-plugin-boundaries` + `@typescript-eslint`), formatting
      (Prettier), design tokens (CSS custom properties). No concern blank.
- [X] T018 [US4] In `docs/stack.md`, add the "deferred" rows: date/time
      ("deferred to the Phase 1 spec; platform `Date`/`Intl` expected") and
      fuzzy search ("deferred to the Phase 4 spec"). (FR-010)
- [X] T019 [US4] In `docs/stack.md`, add the "Not without an ADR" section:
      any second library for a covered concern; any outbound-network
      dependency; any CSS-in-JS or utility-CSS framework; any state library
      beyond Zustand; a build tool other than Vite; a test runner other
      than Vitest. Cross-reference the constitution's Escalation list.
      (FR-011)
- [X] T020 [US4] In `docs/stack.md`, add a "Storage" subsection stating: one
      port (`application/ports/storage-port.ts`), two Phase 2 adapters
      (`FileSystemStorageAdapter`, `IndexedDbStorageAdapter`), helper
      libraries named here are Dexie (IndexedDB) and none (File System
      Access); the adapter code itself is Phase 2, not Phase 0. Confirm no
      contradiction with ADR-0002. (FR-012)
- [X] T021 [US4] Record the owner sign-off: a line in `docs/stack.md`
      ("Stack approved by the project owner on 2026-09-10, see
      `specs/000-scaffolding/plan.md` and `research.md`").

**Checkpoint**: `docs/stack.md` complete, bounded, ADR-0002-consistent
(SC-004).

---

## Phase 4: User Story 2 — Layer violations break the build (Priority: P1)

**Goal**: the dependency-inward rule is documented and mechanically
enforced; a forbidden import fails the build, direct or via a barrel,
including for `shared`.

**Independent Test**: add a deliberate illegal import for each forbidden
edge, once direct and once via barrel; the build fails each time naming the
import; remove them and the build passes; the edge-set check reports zero
drift between doc and config.

- [X] T022 [US2] Create `docs/architecture.md` — the layer map (`domain` /
      `application` / `infrastructure` / `presentation` with
      `presentation/design/` sub-layer, plus `shared`), the
      dependency-inward rule in prose (constitution Principle V;
      `docs/development-principles.md` §3), and the composition-root
      single-wiring-point rule. (FR-009)
- [X] T023 [US2] In `docs/architecture.md`, add the **forbidden-edge table**
      verbatim from data-model.md §3 (source layer → MUST NOT import), as
      the enumerable form the enforcement is checked against. (FR-009)
- [X] T024 [P] [US2] Extract the layer matrix into a shared module
      `eslint.boundaries.js` (exports the allowed-import map / forbidden-edge
      list as plain data); `eslint.config.js` (T010) imports it to build the
      `boundaries/element-types` options, so config and doc-check read one
      source. Then create `test/boundaries/edge-set.test.ts` — a Vitest test
      that imports `eslint.boundaries.js` and asserts its forbidden-edge set
      equals a fixture mirroring `docs/architecture.md`'s table exactly;
      fail on any difference. (FR-009, SC-003; U1 from /speckit-analyze)
- [X] T025 [US2] Create `test/boundaries/README.md` (or
      `illegal-import.md`) — the manual procedure for FR-008: for each
      forbidden edge, the exact illegal `import` line to add (direct form
      and barrel form via `@/application`), the expected `eslint` failure,
      and the `shared`-from-`domain` case direct + barrel.
- [X] T026 [US2] Execute the FR-008 verification: temporarily add each
      illegal import from T025, run `npm run lint`, confirm it fails and
      names the import, remove it. Do the barrel-routed variant through
      `src/application/index.ts`. Do the `shared` variant. Record the
      observed failure messages in `test/boundaries/README.md`. Leave the
      tree clean. (FR-006, FR-007, FR-008, SC-002)

**Checkpoint**: illegal imports fail `npm run lint` in every forbidden
direction, direct and via barrel; `test/boundaries/edge-set.test.ts` green;
doc and config agree (SC-002, SC-003).

---

## Phase 5: User Story 3 — Build on the shared test doubles (Priority: P1)

**Goal**: the in-memory fake of the `StoragePort` and the integration
harness exist in one documented location and work with no real storage API.

**Independent Test**: a test round-trips a value through the in-memory fake
with no browser storage API; a second test drives save-then-read through the
integration harness; both green under Vitest; both imported from
`test/support/`.

- [X] T027 [P] [US3] Create `test/support/in-memory-storage.ts` — a
      `Map`-backed `class InMemoryStorage implements StoragePort` covering
      every method from T011, fully deterministic, with a `reset()` for test
      isolation, importing only `StoragePort` + types from
      `@/application/ports/storage-port` (data-model.md §1; contracts rule
      6).
- [X] T028 [P] [US3] Create `test/support/integration-harness.ts` — a
      `createHarness()` that builds the composition wiring with
      `InMemoryStorage` substituted for the `StoragePort` at the seam and
      returns the wired pieces a test needs, so a test does not rebuild the
      composition (FR-016).
- [X] T029 [US3] Create `test/support/index.ts` — the single documented
      re-export point for `InMemoryStorage`, `createHarness`, and future
      doubles (FR-015).
- [X] T030 [P] [US3] Create `test/unit/storage-port-fake.test.ts` — for
      every `StoragePort` method: save→get round-trips; save→list includes
      it; delete→get returns undefined; `setSchemaVersion`→`getSchemaVersion`
      round-trips; `reset()` clears. No jsdom storage, no browser API
      (data-model.md §1; contracts "Verification").
- [X] T031 [US3] Create `test/integration/harness.test.ts` — use
      `createHarness()`, drive a save-then-read of a placeholder session
      through the wired `StoragePort`, assert the value comes back. Proves
      the harness supplies the standard composition (FR-016).

**Checkpoint**: `npm run test:unit` runs both files green; doubles are
imported from `test/support/` only (SC-005).

---

## Phase 6: User Story 5 — The empty app launches (Priority: P2)

**Goal**: an installable PWA shell that launches to a placeholder drawing
only on design tokens, with a Playwright smoke test.

**Independent Test**: from a clean clone, the documented start command
serves a placeholder; the smoke test passes; the placeholder holds no
domain entity / persistence call / screen; it themes correctly light and
dark from tokens only.

- [X] T032 [P] [US5] Create `src/presentation/design/tokens.css` — every
      colour role from data-model.md §2 (`--color-canvas`, `--color-surface`,
      `--color-surface-raised`, `--color-foreground`,
      `--color-foreground-muted`, `--color-foreground-subtle`,
      `--color-border`, `--color-border-strong`, `--color-accent`,
      `--color-accent-foreground`, `--color-focus-ring`, `--color-danger`,
      `--color-warning`, `--color-success`) under `:root` (light) and under
      both `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`
      (dark), plus `--radius-{sm,md,lg}`, `--duration-{instant,short,medium}`,
      `--easing-{standard,decelerate,accelerate}`, `--space-1..6`. Provisional
      values allowed; no token absent (FR-018, FR-019).
- [X] T033 [P] [US5] Create `src/presentation/design/tokens.ts` — export a
      typed union `TokenName` listing every custom-property name from
      T032, and a `token(name: TokenName)` helper returning
      `var(--…)`. This is the enumerated expected set FR-019 is checked
      against.
- [X] T034 [P] [US5] Create `src/presentation/design/index.ts` — re-export
      `tokens.ts`; do not re-export the raw CSS.
- [X] T035 [P] [US5] Create `test/unit/tokens.test.ts` — assert every
      role/category name in a fixture mirroring data-model.md §2 is present
      in `TokenName`, and (parse `tokens.css`) that each appears under both
      a light and a dark selector. Fail on a missing token (FR-019).
- [X] T036 [US5] Create `src/presentation/app-shell.tsx` — a placeholder
      component: an app title and one line of text, all colours/spacing via
      `token(...)` or CSS classes bound to custom properties. No domain
      import, no `StoragePort` import, no route beyond `/` (FR-020, FR-022).
- [X] T037 [US5] Create `src/presentation/main.tsx` — the composition root:
      mount `<AppShell/>` into `#root`, register the PWA service worker
      (via `virtual:pwa-register`), set `<html data-theme>` from
      `prefers-color-scheme` with a listener. This is the single wiring
      point (Principle V); it is the only file allowed to import across all
      layers.
- [X] T038 [US5] Create `index.html` at repo root — `#root` div, link
      `tokens.css`, `<script type="module" src="/src/presentation/main.tsx">`,
      manifest link (from `vite-plugin-pwa`), `theme-color` meta bound to a
      token value.
- [X] T039 [US5] Create `test/e2e/shell-smoke.spec.ts` — Playwright: load
      the app, assert the placeholder title is visible, assert the service
      worker registers (`navigator.serviceWorker.ready`), run once in
      Chromium and once in WebKit. This is the FR-021 smoke test and part of
      `npm run test:e2e` → CI.
- [X] T040 [US5] The binding check for "no literal colours outside the
      token module" (SC-007) is a grep, wired into CI as its own step (or a
      Vitest test): `grep -RInE '#[0-9a-fA-F]{3,8}|rgb\(|hsl\('
      src/ --exclude-dir=design` MUST return nothing (non-zero exit fails
      the step). Additionally add a best-effort ESLint
      `no-restricted-syntax` rule flagging obvious hex/`rgb(`/`hsl(` string
      literals in `src/` outside `src/presentation/design/`. (U2 from
      /speckit-analyze)

**Checkpoint**: `npm run dev` serves the placeholder; `npm run test:e2e`
smoke passes in both browsers; tokens-only rendering verified (SC-006,
SC-007).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T041 Create `docs/testing.md` — the test pyramid (many Vitest unit,
      fewer integration via the harness, few Playwright E2E/smoke), the
      shared doubles and their location (`test/support/`, re-exported from
      `test/support/index.ts`), and "how a test is written here" (arrange
      with plain values / `createHarness()`, assert on results, query DOM by
      accessible role). (FR-017)
- [X] T042 In `docs/testing.md`, add the **interactive-element state
      convention** (FR-024): every interactive element ships rest, hover,
      pressed, focus-visible, disabled-with-a-stated-reason, loading
      (constitution Definition of Done); note `--color-focus-ring` exists to
      serve focus-visible; state Phase 0 builds no interactive element.
- [X] T043 [P] Add `docs/architecture.md` a closing note (FR-023): any
      later change to the layer map updates both this doc's forbidden-edge
      table and `eslint.config.js` in the same change, and
      `test/boundaries/edge-set.test.ts` guards the two staying equal.
- [X] T044 [P] Update `AGENTS.md` reading order and `docs/agent-brief.md`
      §1: the three scaffolding docs (`docs/stack.md`,
      `docs/architecture.md`, `docs/testing.md`) now exist; strike them from
      the "still missing" list.
- [X] T045 [P] Update `README.md`: project one-liner, the Development
      section (from T016), a "Docs" index linking requirements / design /
      development-principles / agent-brief / stack / architecture / testing /
      the ADRs.
- [X] T046 Run the full `specs/000-scaffolding/quickstart.md` end to end;
      fix anything that does not hold; record the run outcome in the PR
      description.
- [~] T047 Open the Phase 0 PR into the default branch; confirm the CI gate
      is green and the branch-protection required checks block a red gate
      (create a throwaway red commit on a scratch branch to confirm FR-002,
      then discard it). PR #3 opened, `ci-gate` green (all 5 jobs). The
      branch-protection half of FR-002 is UNVERIFIED: this repo is private
      on a GitHub plan that returns 403 on the branch-protection API
      ("Upgrade to GitHub Pro or make this repository public"), so a
      required-status-check rule cannot currently be configured or tested.
      Not a code defect — re-run this verification once the repo is public
      or the plan is upgraded.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: needs Setup. **Blocks US1–US5.**
- **US4 / US2 / US3 / US5**: need Foundational. US4, US2, US3 are mutually
  independent and can run in parallel. US5 depends on the design-token
  tasks it contains but not on US2/US3/US4 — though in practice US5's
  `main.tsx` composition root is what T028's harness mirrors, so doing US3
  before or alongside US5 is smoother.
- **Polish (P7)**: needs US2, US3, US4, US5 done.

### Story dependencies

- **US4** (stack doc): independent. Sequenced first by convention — other
  docs reference it.
- **US2** (boundary): independent. Needs T009/T010 (Foundational) done.
- **US3** (doubles): independent. Needs T011/T012 (port interface + barrel)
  done.
- **US5** (shell): independent of US2/US4; shares the composition-root idea
  with US3's harness (T028 mirrors T037).

### Within a story

- Docs before their verification tests (T022/T023 before T024).
- Interface + barrel (T011/T012) before the fake (T027).
- Tokens (T032/T033) before the shell that consumes them (T036) and before
  the token test (T035).

### Parallel opportunities

- Setup: T003, T004, T005, T006 in parallel after T002.
- Foundational: T013 parallel with T011/T012; T014 parallel with T015/T016.
- US2 vs US3 vs US4: fully parallel once Foundational is done.
- Within US5: T032, T033, T034, T035 in parallel; then T036→T037→T038→T039.
- Polish: T043, T044, T045 in parallel.

---

## Parallel Example: after Foundational

```bash
# Three P1 stories in parallel (different files, no shared deps):
#  Dev A → US4: T017..T021  (docs/stack.md)
#  Dev B → US2: T022..T026  (docs/architecture.md + boundary verification)
#  Dev C → US3: T027..T031  (test/support/* + fake/harness tests)
# Then one dev → US5: T032..T040  (the PWA shell)
```

---

## Implementation Strategy

### MVP-equivalent for Phase 0

There is no partial "ship" here — Phase 0's value is the whole floor. But
the natural order to reach a green, useful checkpoint:

1. Setup (T001–T008) → repo installs and builds.
2. Foundational (T009–T016) → layer rule + CI + port interface exist.
3. US2 (T022–T026) → the boundary rule is *proven*, not just present. This
   is the single most load-bearing checkpoint (`docs/agent-brief.md` §1:
   "the layer-boundary rule genuinely fails on an illegal import").
4. US3 (T027–T031) → the doubles Phases 1–3 are written against exist.
5. US4 (T017–T021) → the stack is recorded.
6. US5 (T032–T040) → the app launches.
7. Polish (T041–T047) → docs finished, quickstart run, PR green.

### Definition of done for the phase

`specs/000-scaffolding/quickstart.md` passes all six sections ⇒ the
`docs/agent-brief.md` §3 Phase 0 deliverable ("an empty app that launches,
with a smoke test and a red build on a layer violation") is met ⇒ Phase 1
(domain and ports) can begin.

---

## Notes

- Commit after each task or logical group; Conventional Commits, English
  (`commit-and-pr-conventions` skill).
- Every task names its file path(s).
- Tests here are deliverables, not optional — verify each fails/passes as
  stated before moving on (T026 in particular: observe the red).
- No domain entity, no real storage adapter, no screen beyond the
  placeholder — those are Phases 1–3 (spec Non-Goals).
