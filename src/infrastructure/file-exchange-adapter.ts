/**
 * Real `FileExchangePort` implementation (`specs/006-settings-data`
 * contracts/file-exchange-port.md). Feature-detects the File System
 * Access API's save/open pickers the same way `select-adapter.ts` already
 * detects `showDirectoryPicker` for storage — falls back to
 * `<a download>` / `<input type="file">` for browsers that lack them
 * (Firefox, older WebKit).
 */
export class FileExchangeAdapter {
  async saveFile(
    suggestedName: string,
    content: string,
    mimeType: string,
  ): Promise<void> {
    if ('showSaveFilePicker' in window) {
      let handle: FileSystemFileHandle;
      try {
        handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: mimeType,
              accept: { [mimeType]: [extensionFor(suggestedName)] },
            },
          ],
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return; // user cancelled — not an error (contract)
        }
        throw new Error('Could not save the file.', { cause: error });
      }
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    }

    // Fallback: a programmatic <a download> click.
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async pickFile(
    acceptMimeType: string,
  ): Promise<{ name: string; content: string } | undefined> {
    if ('showOpenFilePicker' in window) {
      let handles: FileSystemFileHandle[];
      try {
        handles = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: acceptMimeType,
              accept: { [acceptMimeType]: ['.json'] },
            },
          ],
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return undefined; // user cancelled
        }
        throw new Error('Could not open the file picker.', { cause: error });
      }
      const handle = handles[0];
      if (!handle) return undefined;
      const file = await handle.getFile();
      return { name: file.name, content: await file.text() };
    }

    // Fallback: a hidden <input type="file">.
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = acceptMimeType === 'application/json' ? '.json' : '*';
      let settled = false;

      const onFocusBack = (): void => {
        window.removeEventListener('focus', onFocusBack);
        // The dialog closed; if no 'change' fired shortly after, the user
        // cancelled with no selection.
        setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(undefined);
          }
        }, 300);
      };

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          if (!settled) {
            settled = true;
            resolve(undefined);
          }
          return;
        }
        settled = true;
        window.removeEventListener('focus', onFocusBack);
        file
          .text()
          .then((content) => resolve({ name: file.name, content }))
          .catch((error: unknown) => {
            reject(
              new Error('Could not read the selected file.', { cause: error }),
            );
          });
      });

      window.addEventListener('focus', onFocusBack);
      input.click();
    });
  }
}

function extensionFor(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '.json' : name.slice(dot);
}
