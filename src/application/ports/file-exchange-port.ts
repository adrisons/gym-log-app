/**
 * `FileExchangePort` — the one-shot, user-gesture file save/open dialogs
 * export and import need (`specs/006-settings-data`
 * contracts/file-exchange-port.md). Kept separate from `StoragePort`: this
 * is not durable app storage, it is a single dialog per call, always
 * initiated from a user tap (constitution Principle V: "platform-gated
 * capabilities requested inside a user gesture").
 */

export interface FileExchangePort {
  /**
   * Prompts the user to save `content` as a file named `suggestedName`.
   * Resolves when the save completes; also resolves normally (not
   * rejects) if the user cancels the dialog — cancelling a save is not an
   * error condition.
   */
  saveFile(
    suggestedName: string,
    content: string,
    mimeType: string,
  ): Promise<void>;

  /**
   * Prompts the user to pick a file. Returns its name and text content, or
   * `undefined` if the user cancels — never rejects for "no file chosen",
   * only for a genuine I/O failure reading a chosen file.
   */
  pickFile(
    acceptMimeType: string,
  ): Promise<{ name: string; content: string } | undefined>;
}
