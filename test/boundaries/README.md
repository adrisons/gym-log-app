# Boundary rule verification (spec 000 FR-008)

The layer-boundary rule (`eslint-plugin-boundaries`, configured from
`eslint.boundaries.js`) is proven by deliberately adding an illegal import
for each forbidden edge — direct and routed through a barrel — confirming
`npm run lint` fails and names it, then removing it. This file records that
procedure and the results observed during Phase 0 implementation
(2026-09-10).

`test/boundaries/edge-set.test.ts` is the automated, permanent guard that
`docs/architecture.md` and `eslint.boundaries.js` stay in agreement
(FR-009/SC-003); this file is the manual, one-time proof that the *runtime
enforcement itself* actually rejects a bad import (SC-002), which an
edge-list comparison alone cannot show.

## Procedure

For each case: create the file with the given content, run
`npx eslint <path>`, confirm it reports a `boundaries/dependencies` error
naming the import, then delete the probe file.

## Direct imports (forbidden edges)

| # | From → To | Probe file | Import | Result |
|---|---|---|---|---|
| 1 | `domain` → `application-ports` | `src/domain/__p.ts` | `import type { StoragePort } from '../application/ports/storage-port'` | ✅ FAILED — "no policy allowing dependencies from elements of type 'domain' to elements of type 'application-ports'" |
| 2 | `presentation` → `infrastructure` | `src/presentation/__p.tsx` | `import { INFRASTRUCTURE_LAYER } from '../infrastructure/placeholder'` | ✅ FAILED — same error shape, `presentation` → `infrastructure` |
| 3 | `shared` → `application-ports` | `src/shared/__p.ts` | `import type { StoragePort } from '../application/ports/storage-port'` | ✅ FAILED |
| 4 | `presentation-design` → `application-ports` | `src/presentation/design/__p.ts` | `import type { StoragePort } from '../../application/ports/storage-port'` | ✅ FAILED |

## Barrel-routed imports (same forbidden edges, via `src/application/index.ts`)

| # | From → To | Probe file | Import | Result |
|---|---|---|---|---|
| 5 | `domain` → `application` (barrel) | `src/domain/__p.ts` | `import type { StoragePort } from '../application'` | ✅ FAILED — the barrel path does not bypass the rule |
| 6 | `shared` → `application` (barrel) | `src/shared/__p.ts` | `import type { StoragePort } from '../application'` | ✅ FAILED |

## Legal imports (control — must pass)

| # | From → To | Probe file | Import | Result |
|---|---|---|---|---|
| 7 | `presentation` → `application` (barrel), a legitimate export | `src/presentation/__p.tsx` | `import { StorageError } from '../application'` | ✅ PASSED |
| 8 | `infrastructure` → `application-ports` | `src/infrastructure/__p.ts` | `import type { StoragePort } from '../application/ports/storage-port'` | ✅ PASSED |
| 9 | `composition-root` (`src/presentation/main.tsx`) → `domain` + `infrastructure` + `shared` | `src/presentation/main.tsx` | three imports, one per layer | ✅ PASSED (2026-09-11, after the composition-root fix below) |
| 10 | `presentation` (ordinary file, same folder as the composition root) → `infrastructure` | `src/presentation/other.tsx` | `import { CONSTANT } from '../infrastructure/placeholder'` | ✅ FAILED — confirms the composition-root's broad access does not leak to sibling files |
| 11 | `presentation` → `application-ports` (direct) | `src/presentation/__p.tsx` | `import type { StoragePort } from '../application/ports/storage-port'` | ✅ FAILED — presentation must never see a persistence type directly |
| 12 | `presentation` (sibling of `main.tsx`) → `composition-root` (`src/presentation/main.tsx`) | `src/presentation/__p.tsx` | `import { probe } from './main'` | ✅ FAILED — the composition root may be an entry point only, never a module another file imports for its exports |
| 13 | `presentation`, ordinary intra-layer import (control — must pass) | two files in `src/presentation/` | one imports the other, neither is `main.tsx` | ✅ PASSED |

## The application barrel is restricted, not just the direct port import

`src/application/index.ts` re-exports only `StorageError` — none of the
`ports/storage-port.ts` types (`StoragePort`, `SessionRecord`,
`ExerciseRecord`, `SessionId`, `ExerciseId`, `DateRange`). Case 7 above
(`presentation` → `application` barrel, importing `StorageError`) passes
because that export is legitimate; a hypothetical `import type {
StoragePort } from '../application'` is not blocked by the boundary
*lint* rule (the plugin classifies the dependency by the imported file —
`application` — not by where the re-exported symbol actually originates),
but IS caught by `npm run typecheck` (`tsc`) with `TS2305: Module
"../application" has no exported member 'StoragePort'`, since the barrel
no longer re-exports it. Both checks are mandatory in CI (constitution
Definition of Done), so the bypass is closed either way — but this is a
reminder that the boundary rule alone does not follow a re-export's real
origin; keeping barrels narrow is what closes the gap.

## Notes

- The boundary rule needs a real import resolver to classify an import —
  see `docs/architecture.md` "Path resolution". Without
  `eslint-import-resolver-typescript` configured, every case above silently
  passes (the import is treated as unresolvable/external and the rule never
  evaluates it). This was caught during Phase 0 implementation precisely by
  running this verification and seeing forbidden imports pass — the
  verification step is load-bearing, not a formality.
- Case 2 required a real file at `src/infrastructure/placeholder.ts` to
  import — an import of a non-existent path also resolves to "unknown" and
  is silently skipped, which looks identical to a working rule from the
  command's exit code alone. Always probe against a file that exists.
- Cases 9/10 caught a second real bug (2026-09-11): a
  `composition-root` **element** descriptor for `src/presentation/main.tsx`
  never actually classifies as `composition-root` — element patterns match
  folders, not files, so `main.tsx` always resolved to plain `presentation`
  regardless of descriptor order, `partialMatch: false`, or `exclusive:
  true`. This was invisible until a real probe against `main.tsx` was run
  (case 9 initially FAILED with "no policy allowing... presentation →
  domain/infrastructure/shared"). Fixed by dropping the element descriptor
  for `composition-root` and instead granting its policy via a file-path
  selector (`from: { file: { path: 'src/presentation/main.tsx' } }`) — see
  `docs/architecture.md` "Composition-root classification" and the inline
  comment in `eslint.boundaries.js`.
- Case 12 caught a third real bug (2026-09-11, found via PR #3 code review):
  because `main.tsx` classifies as plain `presentation`, a `presentation`
  sibling importing it was an "internal" (same-element) dependency, which
  `eslint-plugin-boundaries` skips before policies run *unless*
  `checkInternals: true` is set on the rule (eslint.config.js). Without it,
  the universal disallow-`main.tsx` policy in `eslint.boundaries.js` never
  fired — a sibling could freely `import './main'` and trigger its
  mount/service-worker side effects. Fixed by adding `checkInternals: true`
  and an explicit `allow` entry for each type's own-type target (no longer
  free once internals are checked), plus the universal disallow policy
  listed last so it overrides the `presentation` self-import allow for
  `main.tsx` specifically (policies evaluate in order; the last match
  wins).
- Case 11/case-7-barrel-note (also from the same review pass) caught a
  fourth real bug: `allowedImports.presentation` included
  `application-ports`, letting `presentation` import `StoragePort` directly
  — contradicting the port's own contract JSDoc
  (`src/application/ports/storage-port.ts`) and
  `docs/development-principles.md`. Removed `application-ports` from
  `presentation`'s allow-list; see "The application barrel is restricted"
  above for the related barrel-narrowing fix.
