# gym-log — Handoff to Claude Code

> **Status note (2026-09-08).** The current project phase is functional
> definition only: what the app does and how it should feel, with no
> concrete technology committed yet. This file's platform decision (§1) and
> its specific architecture mandate (§3) — including the named platform and
> storage mechanisms — are **deferred** to a later technical-planning phase
> and are not currently binding; they are kept below as historical context
> for that future decision. `docs/development-principles.md` carries the
> technology-agnostic version of the architecture practice this file
> describes (ports, layering), which does apply now. See `AGENTS.md` for
> the current reading order.

This is the complete context needed to create the repository and start work.
It supersedes the earlier native cross-platform documents in this project: the
app is now a **PWA**, not a native iOS/Android build. Everything else from the
earlier requirements (domain model, functional requirements, computation rules)
still stands.

Give this whole file to the Claude Code agent as its first message, together
with the two attached documents: `requirements.md` and `agent-brief.md`. Tell
the agent to treat this file as the authority on anything where it conflicts
with those two — specifically the platform decision (§1) and the architecture
mandate (§3), which are new since those documents were written.

---

## 0. What changed since `requirements.md` / `agent-brief.md`

Those two documents were written assuming a native cross-platform app (ADR-0002:
"cross-platform, iOS and Android from a shared codebase"). That decision is
**superseded**:

- **New decision:** the app is a **Progressive Web App**, not a native app, to
  avoid Apple/Google publishing costs and review processes.
- Everything else in `requirements.md` — the mission, invariants, non-goals,
  domain model, the twelve functional requirements, the computation rules for
  insights, the accessibility and design requirements — is unchanged and still
  binding.
- The **7-phase build order** in `agent-brief.md` still applies conceptually,
  but Phase 0 changes: this project uses spec-kit / SDD instead of jumping
  straight to ADRs and a stack document (§4 below).

Write this supersession as its own ADR (`ADR-0002-revised` or similar) the
first thing you do: context (why native was reconsidered), decision (PWA),
consequences (no app-store distribution or review, but no File System Access
API on iOS Safari, which drives the storage decision below).

---

## 1. Platform decision: PWA

- Single web codebase, installable as a PWA on both mobile platforms and
  desktop.
- No App Store / Play Store distribution, no native shell, no platform-specific
  binaries.
- Must be fully installable and usable offline after first load (service
  worker precaching the app shell — see private-notes ADR-012 as prior art in
  this same GitHub account, `adrisons/private-notes`, for a working precedent
  of this exact pattern in a sibling project).
- All the accessibility and "works one-handed at the gym" requirements from
  `requirements.md` §7.4 apply to the PWA UI exactly as written.

---

## 2. Storage decision: dual adapter, chosen at runtime

This is the one that drives the architecture mandate in §3.

- **Primary:** File System Access API, when the browser supports it (Chromium
  desktop and Android). Data lives as files the user can locate, inspect, and
  sync with their own tools — same spirit as invariant 1 in `requirements.md`
  ("the data belongs to the user and lives on their device").
- **Fallback:** IndexedDB, used automatically when File System Access API is
  unavailable — critically, **iOS Safari**, which does not implement it. This
  is not an inferior tier for iOS users; it must have full feature parity, just
  without "it's literally a folder of files you can open."
- **The choice is made once per device, at runtime, via feature detection** —
  never a user-facing setting, never a build flag. The user never sees a
  storage picker; the app just works, per the "automatic over ceremonial"
  principle in the application standard.
- Whichever adapter is active, the **schema/versioning rules in
  `requirements.md` §6 apply identically**: schema version stored with the
  data, migrate when older, refuse when newer, derived data (search index,
  insight cache, chart data) rebuildable from canonical records regardless of
  which adapter holds them.
- Export/import (FR-12) must produce and accept the same interchange format
  regardless of which adapter is active on a given device — a user exporting
  from an IndexedDB-backed iPhone and importing into a File-System-Access-backed
  desktop must round-trip cleanly.

---

## 3. Architecture mandate: hexagonal + BDD

This is **non-negotiable** and is the reason the storage decision above is safe
to make at all.

### 3.1 Hexagonal architecture (ports and adapters)

This is the same dependency-inward discipline as the application standard's
layering (`domain` → `application` → `infrastructure` → `presentation`), applied
explicitly through ports:

- The **application layer defines a storage port** — an interface expressing
  what the domain needs from persistence (save a session, load sessions in a
  range, etc.) in terms of domain concepts, not files or database records.
- **Two infrastructure adapters implement that one port:**
  - `FileSystemStorageAdapter` (File System Access API)
  - `IndexedDbStorageAdapter` (IndexedDB)
- **Feature detection and adapter selection happen in exactly one place** — the
  composition root — never inside domain or application code, and never
  duplicated at multiple call sites.
- Domain and application code must be **completely unaware** which adapter is
  active. If a use case, a view model, or a domain rule needs an `if
  (supportsFileSystemAccess)` anywhere outside the composition root, that is a
  boundary violation — it means the port leaked its implementation detail
  upward.
- Both adapters are tested against **one shared contract test suite** written
  against the port's interface, so "does this adapter satisfy the port" is
  asked once and answered for both. In-memory fakes of the port (for testing
  everything above the storage layer) are a third, test-only implementation
  of the same port.

### 3.2 BDD (behavior-driven development)

- Each functional requirement in `requirements.md` (FR-1 through FR-12) starts
  life as one or more Given/When/Then scenarios, written in the ubiquitous
  language of the domain model (§3 of `requirements.md`: Session, Block,
  Exercise entry, Set, Load, Volume, Effort) — not in storage or UI terms.
- Scenarios are written and agreed **before** the implementing code, as part of
  the spec-kit flow in §4, not retrofitted afterward.
- A scenario exercises the application layer through its ports, using the
  in-memory fake — this is what makes the scenario adapter-agnostic. The same
  scenarios should be runnable, unmodified, against either real adapter as
  confidence that both satisfy the same behavior.
- This gives the storage-adapter split a real payoff: a scenario like "logging
  a set persists it and it survives a reload" is written once and proves true
  for both a File-System-Access user and an iOS IndexedDB user.

---

## 4. Process: SDD with spec-kit

Use GitHub's spec-kit workflow (`specify` CLI / slash commands: `/constitution`,
`/specify`, `/clarify`, `/plan`, `/tasks`, `/implement`) to define and refine the
main use cases before writing implementation code. Concretely:

1. **`/constitution`** — seed it from the application standard (already in this
   project) plus §0–§3 of this document: PWA, dual storage adapters behind one
   port, hexagonal architecture, BDD scenarios before code, the three
   invariants from `requirements.md` §1.2.
2. **`/specify`**, one per functional requirement (or a tightly related small
   group) — start with FR-1 through FR-5 (the logging critical path), since
   that is the phase order in `agent-brief.md`. Each spec should absorb the
   relevant acceptance criteria already written in `requirements.md` rather
   than re-deriving them from scratch.
3. **`/clarify`** — resolve ambiguity *before* `/plan`, especially anywhere the
   spec touches the storage port (which adapter is assumed by a scenario, if
   any) or the still-open decisions D4–D7 in `requirements.md` §8 (default
   unit, e1RM formula, multiple sessions per day, templates scope). Close those
   four before planning the phases that depend on them.
4. **`/plan`** — the technical plan is where the concrete PWA framework,
   build tool, and IndexedDB/File-System-Access libraries get chosen and
   written into the stack document, per the application standard's "one tool
   per concern" rule. This is also deliberately deferred, same as before — do
   not let this handoff document imply a framework choice already made.
5. **`/tasks`** then **`/implement`** per the phase order already defined in
   `agent-brief.md` §3, starting from Phase 0 (scaffolding: CI gate, layer
   boundary lint rule, design tokens, shared test doubles including the
   in-memory storage-port fake).

Keep the existing `agent-brief.md` definition-of-done checklist (§4 of that
document) as the checklist for every task, unchanged.

---

## 5. Repository creation

The GitHub connector is available in Claude Code. Create the repository
directly:

- **Name:** `gym-log`
- **Visibility:** private
- **Owner:** the authenticated account (`adrisons`, based on this project's
  prior work)
- Initialize with a `README.md` (content below) and a `.gitignore` appropriate
  to the eventual toolchain (leave generic/Node-shaped for now since the
  framework is not yet chosen in `/plan`).

### 5.1 Initial file structure

Kept deliberately minimal — just enough to start the spec-kit flow. Do not
scaffold `src/` yet; that belongs to Phase 0 of `agent-brief.md`, after
`/plan`.

```
gym-log/
  README.md
  AGENTS.md                     # points here + to requirements.md / agent-brief.md
  docs/
    requirements.md             # copy of the functional requirements
    agent-brief.md              # copy of the agent brief
    standards.md                # copy of the application standard this project follows
    decisions/                  # ADRs start here — first one records PWA + dual-storage-adapter supersession
  .specify/                     # created by `specify init` (spec-kit's own scaffolding)
```

### 5.2 `README.md` content

```markdown
# gym-log

A personal training diary, installable as a PWA on mobile and desktop. Log a
gym session — blocks, exercises, sets, load, effort — in a few taps, and see
your progression and trend-based insights over time.

## Principles

- **Your data stays on your device.** No account, no backend, nothing sent
  anywhere. Data lives as local files via the File System Access API where the
  browser supports it, or in IndexedDB otherwise (notably iOS Safari) — the
  app picks automatically and both are full-featured.
- **Logging always works, instantly, offline.** No Save button, no waiting.
- **Insights are computed, not generated.** Every trend shown is a
  deterministic calculation over your own data, documented in
  `docs/requirements.md`.

## Status

Early. Requirements and architecture are defined; implementation follows a
spec-driven workflow (see `.specify/`) starting from the logging critical path.

## Documentation

- [`docs/requirements.md`](docs/requirements.md) — what the app does
- [`docs/agent-brief.md`](docs/agent-brief.md) — build order and definition of done
- [`docs/standards.md`](docs/standards.md) — the application standard this project follows
- `docs/decisions/` — architecture decision records
```

### 5.3 `AGENTS.md` content

```markdown
# Agent instructions

Read, in order:

1. `docs/standards.md` — how anything in this repo gets built. Overrides
   everything below on process and quality questions.
2. `docs/requirements.md` — what the app does. The domain model, the twelve
   functional requirements, and the computation rules in here are binding.
3. `docs/agent-brief.md` — build phase order and the definition-of-done
   checklist for every change.
4. `docs/decisions/` — read before revisiting any settled decision.

Two decisions in `docs/decisions/` override anything `docs/requirements.md`
or `docs/agent-brief.md` say about the platform: this is a PWA, not a native
app, and local storage is a hexagonal port with two adapters (File System
Access API, IndexedDB) selected once per device via feature detection at the
composition root — never inside domain or application code.

This project uses spec-kit. Do not write implementation code for a use case
before it has a `/specify` → `/clarify` → `/plan` → `/tasks` cycle behind it.
```

---

## 6. What to do first, in order

1. Create the private repo `gym-log` via the GitHub connector.
2. Add the file structure in §5.1, with `README.md` and `AGENTS.md` as written
   above, and copies of `requirements.md`, `agent-brief.md`, and the
   application standard into `docs/`.
3. Write the first ADR under `docs/decisions/`: the PWA-over-native
   supersession and the dual-storage-adapter decision, both from this
   document's §1–§2, in the standard's ADR format (context, decision,
   consequences).
4. Run `specify init` (or equivalent) to scaffold `.specify/`.
5. Run `/constitution` seeded per §4.1 above.
6. Run `/specify` for FR-1 (log a session) first — it is the start of the
   logging critical path and the smallest complete slice through the hexagonal
   storage port.
7. Stop after `/specify` and `/clarify` for FR-1 and report back before
   running `/plan` — the framework choice in `/plan` is a decision to confirm,
   not to make silently.
