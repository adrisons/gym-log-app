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

export const useSettingsStore = create<SettingsState>((set, get) => ({
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
    await storage.saveSettings(next);
  },
}));
