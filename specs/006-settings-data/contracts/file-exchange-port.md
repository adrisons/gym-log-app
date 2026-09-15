# Contract: `FileExchangePort` (new)

`src/application/ports/file-exchange-port.ts` — the one-shot,
user-gesture file dialogs export/import need. Kept separate from
`StoragePort` (research.md): this is not durable app storage, it is a
single save/open dialog per call, always initiated from a user tap
(constitution Principle V: "platform-gated capabilities requested inside
a user gesture").

```ts
export interface FileExchangePort {
  /** Prompts the user to save `content` as a file named `suggestedName`.
   * Resolves when the save completes; resolves normally (not rejects) if
   * the user cancels the dialog — cancelling a save is not an error. */
  saveFile(suggestedName: string, content: string, mimeType: string): Promise<void>;

  /** Prompts the user to pick a file. Returns its name and text content,
   * or `undefined` if the user cancels — never rejects for "no file
   * chosen," only for a genuine I/O failure reading a chosen file. */
  pickFile(acceptMimeType: string): Promise<{ name: string; content: string } | undefined>;
}
```

## Implementation (`src/infrastructure/file-exchange-adapter.ts`)

Feature-detects `'showSaveFilePicker' in window` /
`'showOpenFilePicker' in window` (same shape as `select-adapter.ts`'s
existing `hasFileSystemAccess` check):

- **Available**: `showSaveFilePicker({ suggestedName, types: [...] })` →
  `createWritable()` → `write(content)` → `close()`; `showOpenFilePicker({ types: [...] })` →
  read the picked handle's `File` → `.text()`.
- **Fallback** (Firefox, older WebKit): `saveFile` creates a `Blob`, an
  object URL, and a programmatic `<a download="suggestedName">` click,
  then revokes the URL; `pickFile` renders a hidden
  `<input type="file" accept="...">`, clicks it, and resolves on
  `change` (or `undefined` if the dialog is dismissed with no
  selection — `input.value` empty on `focus` returning with no `change`
  fired, via the standard `window.addEventListener('focus', ...)` +
  short-timeout cancel-detection pattern).

Both paths are wrapped so a genuine read/write failure rejects with a
plain `Error` (this port is not a `StoragePort` method, so it does not
use `StorageError`'s `kind` discriminant — export/import failures are
surfaced by `application/data-transfer/` with their own FR-013/014
messaging, not by this port).

## Test double

`src/infrastructure/in-memory-file-exchange-adapter.ts` (test-only,
`test/support/`-exported): `saveFile` records `{ suggestedName, content,
mimeType }` in an array the test can assert on; `pickFile` returns a
pre-configured response set via a `setNextPick(...)` test helper —
mirrors `InMemoryStorageAdapter`'s "deterministic, inspectable fake"
shape (constitution Principle IV: every port has an in-memory fake).
