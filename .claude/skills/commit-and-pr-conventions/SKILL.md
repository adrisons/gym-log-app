---
name: "commit-and-pr-conventions"
description: "This project's commit message format (Conventional Commits, English), branching model (trunk-based development), and pull request / PR-comment conventions. Use before writing any git commit message or opening a pull request in this repository."
user-invocable: true
disable-model-invocation: false
---

## Commit messages: Conventional Commits, in English

Follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification — a widely adopted, tool-supported standard; do not invent a
project-specific format. Every commit message, in English, per ADR-0001:

```
<type>(<optional scope>): <short imperative summary>

<optional body — why, not what, per docs/agent-brief.md §0 "one concern per commit">

<optional footer(s) — BREAKING CHANGE:, refs, Co-Authored-By:>
```

Types used in this project: `feat`, `fix`, `docs`, `refactor`, `test`,
`chore`, `build`, `ci`. Scope is optional and, when used, names the layer
or feature area (e.g. `feat(domain): ...`, `fix(logging-session): ...`).

- Subject line: imperative mood ("add", not "added"/"adds"), no trailing
  period, under ~72 characters.
- One concern per commit (`docs/agent-brief.md` §0) — do not bundle an
  unrelated fix into a feature commit.
- Reference the spec, requirement, or ADR the commit implements when it
  isn't obvious from the subject alone, e.g. `Closes FR-004` or
  `Per docs/decisions/ADR-0003-effort-scale.md`.
- A schema or architecture change's commit references its ADR, per the
  constitution's Development Workflow section.

## Branching: trunk-based development

- The default branch is always releasable. Work happens on short-lived
  branches cut from it and merged back quickly — hours to a couple of
  days, not weeks.
- No long-lived feature branches, no separate `develop`/`release` branches.
  A feature too large for a short-lived branch is broken into smaller,
  independently mergeable slices (this is also what spec-kit's prioritized
  user stories, P1/P2/P3, are for — each is meant to be an independently
  shippable slice).
- Branch names describe the change concisely, e.g. `log-a-session`,
  `fix-set-rollover`, `docs-design-criteria` — matching the feature-slug
  convention spec-kit already uses under `specs/<NNN-slug>/`.
- Prefer merging over long-lived rebasing; keep the branch's own history
  clean before merging (squash trivial fixup commits), but never rewrite
  history that's already been merged to the trunk.

## Pull requests

This repository's PR template lives at
`.github/pull_request_template.md` — use it, don't restate its structure
by hand. It asks for:

- **Summary** — one or two sentences: what changed and why, linking the
  spec/requirement or issue.
- **Changes** — a schematic bullet list, one line per meaningful change,
  each linking to the relevant file/line in the diff when that adds
  clarity (a GitHub permalink or `path/to/file.ts#L42`-style reference).
  Not a prose paragraph, not a restatement of the whole diff.
- **Test plan** — a checklist of what was actually verified.
- **Related** — links to the spec file, issue, and/or ADR involved.

Keep the description factual and scannable: a reviewer should understand
the change's shape from the Changes list alone, without opening every file.

## PR comments

- State the fact, then the ask or the fix — no blame, no unnecessary
  hedging.
- Link to the exact line under discussion rather than re-quoting large
  blocks of code.
- When resolving a thread, say what was actually done (or why nothing was
  changed) before marking it resolved — a bare resolve with no comment
  loses the record for later readers.
- Keep review comments about the code and the requirement it implements —
  redirect design-level disagreements to the spec (propose a spec change)
  rather than relitigating them inline across many PR comments.
