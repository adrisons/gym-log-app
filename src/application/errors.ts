/**
 * Application-layer error types. PHASE 0: a stub. The full error policy
 * (how failures are classified, what `presentation` sees) is Phase 1.
 */

/**
 * Raised when a storage operation fails. `infrastructure/` adapters catch
 * their own low-level errors and rethrow as this, so no infrastructure
 * error object crosses the port boundary (ADR-0002; constitution
 * Principle IV).
 *
 * `kind` (spec 003 FR-012a) is a narrow, optional discriminant for the
 * three causes the application layer must react to differently: quota
 * exceeded, a File System Access permission lost/revoked, and a stored
 * schema version newer than this build understands. It is `undefined` for
 * every other failure — not a general error-code system, and never shown
 * to the user directly; `message` remains the only human-readable text.
 */
export class StorageError extends Error {
  override readonly name = 'StorageError';
  constructor(
    message: string,
    override readonly cause?: unknown,
    readonly kind?: 'quota-exceeded' | 'permission-lost' | 'schema-too-new',
  ) {
    super(message);
  }
}
