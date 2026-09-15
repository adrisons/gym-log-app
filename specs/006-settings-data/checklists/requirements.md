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
- **2026-09-15 — `/speckit-clarify` pass, three product-owner-directed
  clarifications encoded.** Added a `## Clarifications` session recording
  three answers already decided by the project owner rather than
  open questions: (1) the interchange format must stay additive-compatible
  for future disciplines/parameters via the existing schema-version
  mechanism (FR-021); (2) the primary JSON export is explicitly designed
  to be directly interpretable by a general-purpose AI assistant for
  progression analysis, not just device-to-device migration (FR-022,
  SC-008); (3) the export must exclude device/installation/browser
  identifying metadata while still including the user's own free-text
  notes as their own training data, not scanned or redacted (FR-023,
  SC-009). No existing FR was contradicted; all three are additive.
- **2026-09-12 — `spec-reviewer` and `schema-guardian` subagent review,
  findings applied, Status → Reviewed.** `schema-guardian` gave a sound
  verdict on the "Settings doesn't bump the schema" claim (Principle III's
  literal scope supports it, on the same precedent as band labels/the
  logging draft), while flagging that `docs/requirements.md` §6's broader
  wording isn't identically reconciled — now noted explicitly in
  Non-Goals rather than left implicit. It also found FR-016's schema-
  version-reset wording ambiguous (could be read as writing a stale
  hardcoded literal) and that seed-catalogue IDs aren't deterministic
  across installs (`crypto.randomUUID()` per install) — both fixed.
  `spec-reviewer` then found: the Edge Cases bullet for
  "delete-everything then import" still assumed the pre-fix empty-
  catalogue behavior, contradicting the now-reseeded FR-016 (fixed); FR-007
  and the Export-file entity called band labels/Settings "canonical"
  while the Settings entity itself said the opposite (fixed, now
  consistently "non-canonical singleton state"); FR-016's schema-marker
  reset, even after the first fix, didn't account for the reseed write
  itself counting as `specs/003-persistence` FR-007a's "first real write"
  (fixed — the marker ends at the current version, not the pre-write
  sentinel); FR-020/SC-007 cited `docs/requirements.md` §7.1 as if it had
  a number for export/import/delete-everything when it doesn't (fixed,
  now honest about there being no existing target to measure against);
  User Story 3 referenced an invented "week view" UI with no basis in any
  other spec, and FR-018 had no acceptance scenario of its own (fixed,
  now points at the Insights consistency card instead and has a Given/
  When/Then). Two minor notes were also addressed: a cross-reference
  added to ADR-0005 carving out delete-everything's reseed from its
  "does not re-seed on later launches" wording, and User Story 2's
  Independent Test now states the expected seed-duplicate outcome
  instead of implying a clean match.
