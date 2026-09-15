/**
 * The Settings view-model store (spec 006 FR-001/002) — Zustand,
 * `configure(storage)` pattern mirroring `logging/logging-store.ts`.
 * Always exposes a fully-defaulted `Settings` (via `withSettingsDefaults`
 * over the port's raw, possibly-`undefined` `getSettings()`) so every
 * consumer (Settings screen sections, `insights-screen.tsx`'s
 * `firstDayOfWeek` read) never null-checks it — only this store's one
 * `load()` call site does.
 */
import { create } from 'zustand';
import type { StoragePort } from './ports/storage-port';
import {
  withSettingsDefaults,
  DEFAULT_SETTINGS,
  type Settings,
} from './ports/settings';

// Re-exported so `presentation/` call sites that need `withSettingsDefaults`
// (e.g. `insights-screen.tsx`'s FR-018 read) can get it from this
// `application`-layer module — `presentation` may import `application`,
// but not `application-ports` directly (`docs/architecture.md`'s
// forbidden-edge table).
export { withSettingsDefaults };

interface SettingsState {
  storage: StoragePort | undefined;
  settings: Settings;
  loaded: boolean;
  configure: (storage: StoragePort) => void;
  load: () => Promise<void>;
  /** Merges `patch` into the current Settings and persists immediately —
   * FR-002, no Save button. */
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  // Chains every persisted write onto one queue, mirroring
  // `session-detail-screen.tsx`'s `saveQueueRef` (Copilot review, PR #31):
  // every call site fires `updateSettings` with `void`, so two edits close
  // together (e.g. two quick-increment fields) could otherwise have their
  // `saveSettings` calls resolve out of order and persist the *older*
  // snapshot last, clobbering the newer one the UI already shows. `.catch`
  // is attached synchronously in the same expression that replaces the
  // ref, so a rejected attempt never permanently short-circuits every
  // later save chained onto it, and is never left unobserved (only
  // reachable via `void updateSettings(...)`, so nothing else would ever
  // await it) — it's only logged, same as the session-save queue.
  let saveQueue: Promise<void> = Promise.resolve();

  return {
    storage: undefined,
    settings: DEFAULT_SETTINGS,
    loaded: false,
    configure: (storage) => set({ storage }),
    async load() {
      const { storage } = get();
      if (!storage) return;
      const stored = await storage.getSettings();
      set({ settings: withSettingsDefaults(stored), loaded: true });
    },
    async updateSettings(patch) {
      const { storage, settings } = get();
      if (!storage) return;
      const next = withSettingsDefaults({ ...settings, ...patch });
      set({ settings: next });
      const attempt = saveQueue.then(() => storage.saveSettings(next));
      saveQueue = attempt.catch((error: unknown) => {
        console.error('Failed to save settings', error);
      });
      await saveQueue;
    },
  };
});
