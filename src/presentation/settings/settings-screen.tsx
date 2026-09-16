/**
 * FR-001-006: the Settings screen — unit/increments, theme, first day of
 * week, and the Data section (export/import/delete-everything).
 */
import { useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/application/settings-store';
import { useSetScreenTitle } from '@/presentation/nav/screen-title';
import { applyTheme } from '@/presentation/theme';
import { UnitAndIncrementsSection } from './unit-and-increments-section';
import { ThemeSection } from './theme-section';
import { FirstDayOfWeekSection } from './first-day-of-week-section';
import { StorageStatusSection } from './storage-status-section';
import { DataSection } from './data-section';
import './settings.css';

export function SettingsScreen() {
  useSetScreenTitle('Settings');
  const load = useSettingsStore((state) => state.load);
  const loaded = useSettingsStore((state) => state.loaded);

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
      <DataSection onDataChanged={handleDataChanged} />
    </main>
  );
}
