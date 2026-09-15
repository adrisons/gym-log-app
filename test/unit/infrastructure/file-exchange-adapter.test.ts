import { describe, expect, it, vi, afterEach } from 'vitest';
import { FileExchangeAdapter } from '../../../src/infrastructure/file-exchange-adapter';

// jsdom has neither showSaveFilePicker nor showOpenFilePicker (same
// "no real browser API in a unit test" boundary the storage adapters'
// own contract suite documents), so this suite exercises the
// <a download>/<input type="file"> fallback path — also the realistic
// path for any browser lacking the File System Access API (Firefox,
// older WebKit), per contracts/file-exchange-port.md.

describe('FileExchangeAdapter (spec 006 contracts/file-exchange-port.md)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveFile fallback (<a download>)', () => {
    it('creates an object URL, clicks a download anchor, and revokes the URL', async () => {
      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:fake-url');
      const revokeObjectURL = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => undefined);
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);

      const adapter = new FileExchangeAdapter();
      await adapter.saveFile('export.json', '{"a":1}', 'application/json');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    });
  });

  describe('pickFile fallback (<input type="file">)', () => {
    it('resolves the file name and text content once a file is selected', async () => {
      const adapter = new FileExchangeAdapter();
      const clickSpy = vi
        .spyOn(HTMLInputElement.prototype, 'click')
        .mockImplementation(function (this: HTMLInputElement) {
          const file = new File(['{"hello":true}'], 'picked.json', {
            type: 'application/json',
          });
          Object.defineProperty(this, 'files', {
            value: [file],
            configurable: true,
          });
          this.dispatchEvent(new Event('change'));
        });

      const result = await adapter.pickFile('application/json');

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        name: 'picked.json',
        content: '{"hello":true}',
      });
    });

    it('resolves undefined when the dialog is dismissed with no selection', async () => {
      vi.useFakeTimers();
      const adapter = new FileExchangeAdapter();
      vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {
        // Simulate the OS dialog closing with nothing chosen: focus
        // returns to the window with no 'change' event.
        window.dispatchEvent(new Event('focus'));
      });

      const pending = adapter.pickFile('application/json');
      await vi.advanceTimersByTimeAsync(400);
      await expect(pending).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });
});
