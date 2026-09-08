# ADR-0001: Single project language

**Date:** 2026-09-08
**Status:** Accepted

## Context

The project needs one consistent language across every artifact — code,
identifiers, comments, commit messages, and documentation — to keep the
codebase and its history legible to any contributor or agent working on it.

## Decision

English is the single language for every artifact in this repository: code,
identifiers, comments, commit messages, and documentation. No mixing.

## Consequences

**Positive**

- Consistent, searchable codebase and history.
- No translation ambiguity in domain terms (see `docs/requirements.md` §3).

**Negative**

- None of consequence; this is a zero-cost convention.

**Neutral**

- Applies retroactively to all future commits and documents; does not require
  translating anything that does not yet exist.
