# Agent instructions

Read, in order:

1. `docs/requirements.md` — what the app does. The domain model, the
   functional requirements, and the computation rules in here are binding.
2. `docs/design.md` — visual and interaction design criteria. Binding for
   any screen, flow, or visual treatment.
3. `docs/development-principles.md` — general engineering practices
   (domain/implementation separation, ports for external dependencies,
   layering, derived-data rebuildability). Binding for any code structure,
   independent of whatever concrete technology is eventually chosen within
   the platform decided in ADR-0002.
4. `docs/agent-brief.md` — the build phase order and the documentation
   scaffolding to stand up before product code. Process and
   definition-of-done rules are not here; they are in the constitution.
5. `docs/decisions/` — read before revisiting any settled decision.
   ADR-0002 in particular fixes the platform (a PWA) and the storage
   architecture (one port, two adapters: File System Access API and
   IndexedDB, chosen at runtime) — treat both as binding.

Note: no separate "application standard" document has been supplied to this
project yet. Until one exists, `.specify/memory/constitution.md` and
`docs/development-principles.md` are the process authority. If a standards
document is added later, it overrides everything above on process and
quality questions, per `.specify/memory/constitution.md`.

**Current phase: platform, architecture, and the Phase 0 toolchain are
decided.** ADR-0002 fixes the app as a PWA with a two-adapter storage port.
The concrete PWA framework, build tool, and adapter library are chosen and
recorded in `docs/stack.md` (owner-confirmed, per `/speckit-plan` for
`specs/000-scaffolding/`). Any *later* phase's spec still follows the same
rule for whatever it introduces: no concrete tool/library name lands in
`docs/requirements.md`, `docs/design.md`, a feature spec under `specs/`, or
the project constitution ahead of that phase's own `/speckit-plan` and
owner confirmation.

This project uses spec-kit. Do not write implementation code for a use case
before it has a `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
`/speckit-tasks` cycle behind it. See the `sdd-workflow` skill for the full
sequence, including where the `spec-reviewer` and `schema-guardian`
subagents (`.claude/agents/`) fit in.

Before any commit or pull request, follow the `commit-and-pr-conventions`
skill (Conventional Commits in English, trunk-based development, the PR
template at `.github/pull_request_template.md`).

Prefer an existing, standard, well-maintained tool or convention (spec-kit's
own commands and templates, Conventional Commits, GitHub's native PR
template mechanism) over defining a new project-specific one. The
project-specific subagents and skills under `.claude/` exist only where no
such standard already covers the need.
