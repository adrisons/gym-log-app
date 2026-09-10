/**
 * Application-layer error types. PHASE 0: a stub. The full error policy
 * (how failures are classified, what `presentation` sees) is Phase 1.
 */

/**
 * Raised when a storage operation fails. `infrastructure/` adapters catch
 * their own low-level errors and rethrow as this, so no infrastructure
 * error object crosses the port boundary (ADR-0002; constitution
 * Principle IV).
 */
export class StorageError extends Error {
  override readonly name = 'StorageError';
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}
