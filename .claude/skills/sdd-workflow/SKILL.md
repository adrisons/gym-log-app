---
name: "sdd-workflow"
description: "Index of this project's spec-driven development process: what order to move in, which spec-kit command or agent to invoke at each phase, and what artifact must exist before the next phase starts. Use at the start of any feature work, or when unsure what step comes next. This skill does not reimplement spec-kit — it routes to the speckit-* skills and project subagents already installed."
argument-hint: "The feature or change you're about to work on"
user-invocable: true
disable-model-invocation: false
---

## Purpose

This project uses GitHub's spec-kit (the `speckit-*` skills already
installed under `.claude/skills/`) for spec-driven development, per
`docs/agent-brief.md` and ADR-0002 (`docs/decisions/`) and the project
constitution's Development Workflow section. This skill does not replace any
of that — it is a map so the right command gets invoked at the right time,
and so the two project-specific review subagents (`spec-reviewer`,
`schema-guardian`) get used where they add value that spec-kit's own
commands don't cover.

Always prefer the actual `speckit-*` skill for the step it owns. Do not
hand-roll a spec, plan, or task list here — this skill only sequences.

## The phases

1. **Specify** — `/speckit-specify`. Produces `specs/<NNN-slug>/spec.md`
   from a feature description, using this project's spec template
   (`.specify/templates/spec-template.md`, which requires a Context and a
   Non-Goals section on top of spec-kit's defaults). Generates and
   validates `specs/<NNN-slug>/checklists/requirements.md` in the same
   pass.

2. **Review the spec** — invoke the `spec-reviewer` subagent
   (`.claude/agents/spec-reviewer.md`) against the new or changed spec.
   This is a static, adversarial read for ambiguity, uncovered edge cases,
   and contradictions with other specs or with `docs/requirements.md` — a
   different job than the next two steps, which are interactive or
   cross-artifact rather than cross-spec.
   - If the spec introduces or changes a domain entity, a value object
     (Load/Volume/Effort), or anything persisted, also invoke the
     `schema-guardian` subagent (`.claude/agents/schema-guardian.md`) to
     check it against `docs/requirements.md` §3/§6 and flag whether a
     future migration would be required.

3. **Clarify** — `/speckit-clarify`, if the spec-reviewer findings (or the
   spec's own `[NEEDS CLARIFICATION]` markers) warrant it. This is
   spec-kit's own interactive ambiguity-resolution loop against the
   *current* spec — use it to close what step 2 found, not instead of
   step 2.

4. **Plan** — `/speckit-plan`. This is where concrete technology gets
   chosen for the first time in this project (see `AGENTS.md` — everything
   before this point is deliberately technology-free). Confirm any
   technology choice with the project owner before it lands, per the
   constitution's Escalation section.

5. **Tasks** — `/speckit-tasks`, then optionally `/speckit-analyze` for
   cross-artifact (spec/plan/tasks) consistency within the same feature —
   this is spec-kit's own check and is narrower than `spec-reviewer`,
   which looks across features.

6. **Implement** — `/speckit-implement`. Follow the definition-of-done
   checklist in the constitution's Development Workflow section for every
   change (and the build phase order in `docs/agent-brief.md` §3). Commit and PR conventions are in the
   `commit-and-pr-conventions` skill — apply them from the first commit of
   the feature, not just at the end.

7. **Converge** — `/speckit-converge`, if work resumes after a gap, to
   catch up `tasks.md` with what the codebase actually contains before
   continuing `/speckit-implement`.

## Rule of thumb

If a `speckit-*` skill already does the thing, use it. Only fall back to a
project subagent (`spec-reviewer`, `schema-guardian`) for the two checks
spec-kit doesn't cover: adversarial cross-spec review, and domain-model/
schema-migration impact.

## Keeping `spec.md`'s **Status** field current

spec-kit's own commands never touch the `**Status**:` line the template
puts near the top of `spec.md` — it stays whatever `/speckit-specify` set
it to unless someone updates it by hand. This project keeps it meaningful
by updating it manually at each phase boundary, using these values:

| Status | Set when |
|---|---|
| `Draft` | Just created by `/speckit-specify`, not yet through review (phase 2 above). |
| `Reviewed` | Passed `spec-reviewer` (and `schema-guardian` where it applies) and any `/speckit-clarify` follow-up — no `plan.md`/`tasks.md` yet. |
| `Planned` | `/speckit-plan` and `/speckit-tasks` have run — `plan.md`/`tasks.md` exist, implementation hasn't merged yet. |
| `Implemented` | The feature's work has merged to the default branch — note the merging PR number(s) after the status, e.g. `Implemented — merged to main via PR #3`. |

Update the line as part of the commit that completes each phase (the
review-findings commit sets `Reviewed`, the plan/tasks commit sets
`Planned`, the merge-worthy final commit or the merge itself sets
`Implemented`) — don't let it silently lag, and don't leave a spec's own
header contradicting what `specs/<NNN-slug>/tasks.md`'s status notes (if
present) already say happened.
