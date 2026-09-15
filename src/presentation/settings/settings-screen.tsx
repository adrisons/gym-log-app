/**
 * FR-001-006: the Settings screen — unit/increments, theme, first day of
 * week, band labels, and the Data section (export/import/delete-everything).
 */
import { useCallback, useEffect, useState } from 'react';
import { useSettingsStore } from '@/application/settings-store';
import { useSetScreenTitle } from '@/presentation/nav/screen-title';
import { applyTheme } from '@/presentation/theme';
import { UnitAndIncrementsSection } from './unit-and-increments-section';
import { ThemeSection } from './theme-section';
import { FirstDayOfWeekSection } from './first-day-of-week-section';
import { BandLabelsSection } from './band-labels-section';
import { DataSection } from './data-section';
import './settings.css';

export function SettingsScreen() {
  useSetScreenTitle('Settings');
  const load = useSettingsStore((state) => state.load);
  const loaded = useSettingsStore((state) => state.loaded);
  // Bumped after a successful import or delete-everything (Copilot review,
  // PR #31): both replace persisted Settings/band labels out from under
  // this screen's already-mounted sections, which otherwise keep showing
  // (and could re-save) their pre-import in-memory values. Remounting
  // `BandLabelsSection` via `key` forces its own storage read to re-run;
  // reloading the settings store and re-applying the theme covers the
  // other three sections, which already subscribe to that store.
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDataChanged = useCallback(async () => {
    await load();
    applyTheme(useSettingsStore.getState().settings.theme);
    setDataVersion((version) => version + 1);
  }, [load]);

  if (!loaded) {
    return <main className="settings-screen" aria-label="Settings" />;
  }

  return (
    <main className="settings-screen" aria-label="Settings">
      <UnitAndIncrementsSection />
      <ThemeSection />
      <FirstDayOfWeekSection />
      <BandLabelsSection key={dataVersion} />
      <DataSection onDataChanged={handleDataChanged} />
    </main>
  );
}
