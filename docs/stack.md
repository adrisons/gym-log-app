# Stack

One tool per concern. Chosen in `specs/000-scaffolding/plan.md` /
`research.md` and approved by the project owner on 2026-09-10 (see
`specs/000-scaffolding/plan.md` "Owner sign-off"). Adding a second tool for
a concern already listed here, or a tool for a concern not listed, requires
an ADR first — see "Not without an ADR" below.

Rationale and rejected alternatives for every row: `specs/000-scaffolding/research.md`.

## Application

| Concern | Tool |
|---|---|
| PWA framework | React 19 + TypeScript |
| Build tool / bundler | Vite 8 |
| State management | Zustand |
| Service worker / offline precache | `vite-plugin-pwa` (Workbox) — precaches the app shell (ADR-0002) |
| Charts | Recharts — named now, unused until Phase 4/5 (progression, insights) |
| Navigation | React Router 7 |

## Storage (ADR-0002: one port, two adapters)

One `application`-layer storage port (`src/application/ports/storage-port.ts`);
two `infrastructure` adapters implement it, chosen at runtime via feature
detection. These rows name **helper libraries only** — the adapter code
itself is Phase 2, not Phase 0.

| Concern | Tool |
|---|---|
| IndexedDB helper | Dexie 4 |
| File System Access helper | none, hand-written adapter (the API surface needed is small and stable) |

## Testing

| Concern | Tool |
|---|---|
| Test runner | Vitest |
| Component/DOM testing | `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` |
| End-to-end / smoke (browser) | Playwright — Chromium + WebKit projects (WebKit covers the iOS Safari / IndexedDB path) |

## Code quality

| Concern | Tool |
|---|---|
| Lint | ESLint 9 (flat config) + `typescript-eslint` |
| Layer-boundary rule | `eslint-plugin-boundaries`, configured from `eslint.boundaries.js` (the single source of truth for the layer graph — see `docs/architecture.md`) |
| Import resolution for the boundary rule | `eslint-plugin-import` + `eslint-import-resolver-typescript` — companions the boundary rule needs to resolve extensionless TS imports and the `@/*` alias; not an independent concern |
| Formatting | Prettier |

## Design

| Concern | Tool |
|---|---|
| Design tokens | CSS custom properties (`src/presentation/design/tokens.css`) + a typed name accessor (`tokens.ts`) — no CSS-in-JS, no utility framework |

## Deferred (named now, decided later)

These concerns exist and are known to matter, but choosing a tool for them
now would be uninformed — they are decided when the phase that needs them is
specified.

| Concern | Status |
|---|---|
| Date/time handling | Deferred to the Phase 1 spec/plan. The platform `Date` + `Intl.DateTimeFormat` are expected to suffice for spec 001's date-time-at-form-open logic; a library (e.g. `date-fns`) is an ADR if one proves necessary. |
| Fuzzy search | Deferred to the Phase 4 (diary/search) spec, where the matching semantics and the < 100 ms performance target (`docs/requirements.md` FR-7) are specified. Candidates: Fuse.js, `uFuzzy`, or a hand-rolled pass. |

## Not without an ADR

Per the constitution's Escalation section and "one dependency per concern"
(`docs/development-principles.md` §6):

- A second library for any concern already listed above.
- Any state-management library other than Zustand.
- Any build tool other than Vite, or any test runner other than Vitest.
- Any CSS-in-JS library or utility-CSS framework (Tailwind, etc.) — design
  tokens are CSS custom properties, full stop.
- Any outbound network call, telemetry, or analytics library — the app has
  none (constitution Principle I, invariant 1).
- Any change to the storage architecture (ADR-0002: one port, two adapters).
- Any second UI framework or a server framework (Next.js, Remix, etc.) —
  this is a client-only PWA with no server.

## Versions

Exact pinned versions live in `package.json` / `package-lock.json`, kept at
each library's latest stable at the time Phase 0 was implemented — with one
deliberate exception: TypeScript is held at 5.x rather than the newer 7.x
line (the Go-based rewrite), judged too new to build the project's
foundation on. ESLint is held at the latest 9.x rather than 10.x because
`eslint-plugin-react` does not yet support ESLint 10's peer range.
