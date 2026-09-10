/**
 * Public surface of the application layer.
 *
 * This barrel also exists so `test/boundaries/` can verify the layer rule
 * catches a *barrel-routed* illegal import (spec FR-006): a `presentation`
 * or `domain` module importing `@/application` must fail the build just as
 * a direct `@/application/ports/storage-port` import does.
 */
export type {
  StoragePort,
  SessionRecord,
  ExerciseRecord,
  SessionId,
  ExerciseId,
  DateRange,
} from './ports/storage-port.js';
export { StorageError } from './errors.js';
