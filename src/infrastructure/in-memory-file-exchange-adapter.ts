import type { FileExchangePort } from '../application/ports/file-exchange-port';

/**
 * Deterministic, inspectable `FileExchangePort` fake (constitution
 * Principle IV: every port has an in-memory fake usable in tests — mirrors
 * `InMemoryStorageAdapter`'s shape). Lives in `infrastructure/`, not
 * `test/support/`, for the same reason `InMemoryStorageAdapter` does: `src/`
 * must never import from `test/`, and this could in principle be wired by
 * the composition root too (it currently is not).
 */
export interface SavedFile {
  suggestedName: string;
  content: string;
  mimeType: string;
}

export class InMemoryFileExchangeAdapter implements FileExchangePort {
  readonly saved: SavedFile[] = [];
  #nextPick: { name: string; content: string } | undefined;

  /** Configures what the next `pickFile()` call resolves to — `undefined` simulates the user cancelling. */
  setNextPick(pick: { name: string; content: string } | undefined): void {
    this.#nextPick = pick;
  }

  async saveFile(
    suggestedName: string,
    content: string,
    mimeType: string,
  ): Promise<void> {
    this.saved.push({ suggestedName, content, mimeType });
  }

  async pickFile(): Promise<{ name: string; content: string } | undefined> {
    return this.#nextPick;
  }

  /** Test isolation: clears all state between tests. */
  reset(): void {
    this.saved.length = 0;
    this.#nextPick = undefined;
  }
}
