/**
 * FR-001-006: the Settings screen — unit/increments, theme, first day of
 * week, and the Data section (export/import/delete-everything).
 */
import { useCallback, useEffect, useState } from 'react';
import { useSettingsStore } from '@/application/settings-store';
import { useSetScreenTitle } from '@/presentation/nav/screen-title';
import { applyTheme } from '@/presentation/theme';
import { UnitAndIncrementsSection } from './unit-and-increments-section';
import { ThemeSection } from './theme-section';
import { FirstDayOfWeekSection } from './first-day-of-week-section';
import { StorageStatusSection } from './storage-status-section';
import { StorageSizeSection } from './storage-size-section';
import { DataSection } from './data-section';
import './settings.css';

export function SettingsScreen() {
  useSetScreenTitle('Settings');
  const load = useSettingsStore((state) => state.load);
  const loaded = useSettingsStore((state) => state.loaded);
  // Forces `StorageSizeSection` to remount (and so recompute, FR-004) after
  // any data-changing flow in `DataSection` — import, delete-everything, or
  // this feature's own delete-old-data — without turning the readout into
  // a live/background-polling counter (Non-Goals): it only ever
  // recomputes in response to an actual change, on this screen's own
  // "re-read on mount" convention.
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    void load();
  }, [load]);

  // Reloads Settings and re-applies the theme after a successful import or
  // delete-everything (Copilot review, PR #31), both of which replace
  // persisted Settings out from under this screen's already-mounted
  // sections, which otherwise keep showing (and could re-save) their
  // pre-import in-memory values.
  const handleDataChanged = useCallback(async () => {
    await load();
    applyTheme(useSettingsStore.getState().settings.theme);
    setDataVersion((v) => v + 1);
  }, [load]);

  if (!loaded) {
    return <main className="settings-screen" aria-label="Settings" />;
  }

  return (
    <main className="settings-screen" aria-label="Settings">
      <UnitAndIncrementsSection />
      <ThemeSection />
      <FirstDayOfWeekSection />
      <StorageStatusSection />
      <StorageSizeSection key={dataVersion} />
      <DataSection onDataChanged={handleDataChanged} />
    </main>
  );
}
