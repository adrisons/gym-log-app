# Agent instructions

Read, in order:

1. `docs/requirements.md` — what the app does. The domain model, the twelve
   functional requirements, and the computation rules in here are binding.
2. `docs/design.md` — visual and interaction design criteria. Binding for
   any screen, flow, or visual treatment.
3. `docs/development-principles.md` — general engineering practices
   (domain/implementation separation, ports for external dependencies,
   layering, derived-data rebuildability). Binding for any code structure,
   independent of whatever technology is eventually chosen.
4. `docs/agent-brief.md` — build phase order and the definition-of-done
   checklist for every change.
5. `docs/handoff.md` — background on the project's process (spec-kit,
   BDD). Its concrete platform and architecture mandates are currently
   deferred to a later technical-planning phase — see the note at the top
   of that file — so do not treat them as binding yet.
6. `docs/decisions/` — read before revisiting any settled decision.

Note: no separate "application standard" document has been supplied to this
project yet. Until one exists, `docs/agent-brief.md` and
`docs/development-principles.md` are the process authority. If a standards
document is added later, it overrides everything above on process and
quality questions, per `.specify/memory/constitution.md`.

**Current phase: functional definition only.** This repository currently
describes *what* the application does and *how it should feel to use* — not
which platform, framework, storage mechanism, or library implements it. Do
not introduce a concrete technology name into `docs/requirements.md`,
`docs/design.md`, feature specs under `specs/`, or the project constitution.
Technology and architecture-adapter choices are made explicitly in a later
`/speckit-plan` step, confirmed with the project owner first, and recorded
in their own ADR under `docs/decisions/`.

This project uses spec-kit. Do not write implementation code for a use case
before it has a `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
`/speckit-tasks` cycle behind it.
