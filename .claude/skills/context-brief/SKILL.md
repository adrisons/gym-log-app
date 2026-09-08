---
name: "context-brief"
description: "Produce a short, task-scoped summary of this project's governing docs (constitution, requirements, design, development-principles) instead of re-reading them in full. Use before starting a /speckit-specify, /speckit-plan, or /speckit-implement pass, or whenever a task only needs a slice of this project's context."
argument-hint: "What you're about to work on (e.g. 'FR-8 progression chart', 'the settings screen')"
user-invocable: true
disable-model-invocation: false
---

## Purpose

This repository's governing documents (`docs/requirements.md`,
`.specify/memory/constitution.md`, `docs/design.md`,
`docs/development-principles.md`, `docs/agent-brief.md`) are deliberately
thorough. Re-reading all of them in full for every task burns context and
tokens on sections that are irrelevant to the task at hand. This skill
produces a compact brief scoped to what the task actually needs, instead.

## Instructions

Given the task description in `$ARGUMENTS`:

1. Identify which functional requirements (FR-N in `docs/requirements.md`
   §4), which computation rules (§5, if any), and which domain entities
   (§3) the task actually touches. Skip everything else in that document.
2. Pull only the constitution principles from
   `.specify/memory/constitution.md` that materially constrain this task
   (e.g. Principle II only matters for logging-path work; Principle IV only
   matters where an external dependency is involved) — not the full text of
   every principle.
3. Pull only the `docs/design.md` sections relevant to what's being built
   (e.g. §5 Interaction states and §6 Layout for a new screen; skip §3
   Color and §4 Motion for a pure data-model task).
4. Pull only the `docs/development-principles.md` sections relevant to the
   kind of code being written (e.g. §2 Ports for anything touching an
   external dependency; §3 Layering for anything crossing a boundary).
5. Note any open decision (`docs/requirements.md` §8) or unresolved
   `[NEEDS CLARIFICATION]` marker in a relevant spec under `specs/` that
   bears on this task.
6. Output a brief — a few bullet points per source, cite the section
   numbers so the full text can be pulled later if needed, and explicitly
   state what was excluded as out of scope for this task. Do not
   paraphrase requirements loosely; quote or closely restate binding rules
   (MUST/MUST NOT language) verbatim enough to stay accurate.

Keep the brief itself short — its entire purpose is token efficiency. If a
task turns out to need most of a document anyway, say so and read that
document in full instead of forcing a compressed summary that would lose
information.

## When not to use this

Do not use this to avoid reading a document that must be read in full —
particularly `AGENTS.md`'s reading order at the start of a fresh session,
or a spec file you are about to implement directly. This skill is for
narrowing a large body of *governing* context to what one task needs, not a
substitute for reading the artifact you are actually working from.
