/**
 * Public surface of the application layer — what `presentation` and
 * `infrastructure` are meant to import from `application` as a whole.
 *
 * Deliberately does NOT re-export anything from `ports/` (StoragePort,
 * SessionRecord, ExerciseRecord, SessionId, ExerciseId, DateRange):
 * `presentation` must never see a persistence type, even indirectly through
 * this barrel (see the port's own JSDoc,
 * `docs/development-principles.md`, and `eslint.boundaries.js`'s
 * `allowedImports.presentation`, which excludes `application-ports`
 * entirely). `application-ports` is imported directly by whatever needs the
 * port type itself (`application`'s own use cases, `infrastructure`'s
 * adapters) — those layers are allowed to import `application-ports`
 * directly and don't need it re-exported here.
 *
 * `StorageError` is the one exception: it is a plain Error subclass with no
 * persistence-shaped fields, safe for a caller to catch/display.
 *
 * This barrel also exists so `test/boundaries/` can verify the layer rule
 * catches a *barrel-routed* illegal import (spec FR-006): a `presentation`
 * or `domain` module importing `@/application` must fail the build just as
 * a direct `@/application/ports/storage-port` import does — see
 * test/boundaries/README.md case 6 (`domain` → `application` barrel).
 */
export { StorageError } from './errors.js';
