# Specification Quality Checklist: Settings, Export and Import

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Non-Goals section explicitly excludes related-but-out-of-scope capabilities
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- The import merge policy (replace-on-matching-identity, add-otherwise) was
  a candidate [NEEDS CLARIFICATION] point but has a reasonable default
  directly grounded in FR-12's own wording in `docs/requirements.md`
  ("preview of what will be added or replaced") — recorded under
  Assumptions rather than left open, per the user's request to proceed
  with the reviewer's best judgment.
- Whether Settings needs its own schema-version consideration (it is new
  stored data, not a reshape of an existing entity) is flagged under
  Assumptions for `schema-guardian` review before `/speckit-plan`.
- **2026-09-12 — addressed PR #17 review findings** (GitHub Copilot PR
  review, 13 threads): the pending logging draft is now included in
  export/import/delete-everything (it was previously, incorrectly, left
  out — a real gap against the §1.2 "everything exportable" invariant);
  import-time migration is now explicit about being in-memory-only until
  the confirmed atomic write; delete-everything now re-seeds the catalogue
  instead of contradicting D9's fresh-install guarantee; the
  "no schema bump for Settings" Non-Goal now cites the actual precedent
  (band labels / logging draft, `specs/001-log-a-session/research.md` §7)
  instead of asserting it bare; identity-matching is now defined per
  record kind (ID-based for Sessions/Exercises, whole-record replacement
  for the three singletons); added FR-011's storage-layer atomic-write
  dependency, FR-018 (first-day-of-week driving Insights FR-010), and
  FR-019/FR-020 (the accessibility audit and performance measurement
  `docs/agent-brief.md`'s Phase 6 requires, previously unaddressed here).
  ADR-0006 and `docs/requirements.md` §1.4 were also corrected in the same
  pass: a swim result needs the catalogue entry to carry the fixed
  distance and the Set to carry only `Volume: Duration`, since `Volume` is
  an exclusive union and cannot hold both at once — the original "no
  rework" phrasing overstated what the current model already supports.
