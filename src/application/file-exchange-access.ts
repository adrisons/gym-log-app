/**
 * Holds the single `FileExchangePort` instance the composition root
 * configures once at mount — mirrors `storage-access.ts`'s own
 * `storage`/`configure` pattern exactly (spec 006).
 */
import { create } from 'zustand';
import type { FileExchangePort } from './ports/file-exchange-port';

interface FileExchangeAccessState {
  fileExchange: FileExchangePort | undefined;
  configure: (fileExchange: FileExchangePort) => void;
}

export const useFileExchangeAccess = create<FileExchangeAccessState>((set) => ({
  fileExchange: undefined,
  configure: (fileExchange) => set({ fileExchange }),
}));

/** Throws if called before the composition root's `configure()`. */
export function requireFileExchange(): FileExchangePort {
  const { fileExchange } = useFileExchangeAccess.getState();
  if (!fileExchange) {
    throw new Error('useFileExchangeAccess: not configured yet.');
  }
  return fileExchange;
}
