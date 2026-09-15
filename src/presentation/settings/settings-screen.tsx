/**
 * FR-001-006: the Settings screen — unit/increments, theme, first day of
 * week, band labels, and the Data section (export/import/delete-everything).
 */
import { useEffect } from 'react';
import { useSettingsStore } from '@/application/settings-store';
import { useSetScreenTitle } from '@/presentation/nav/screen-title';
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

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return <main className="settings-screen" aria-label="Settings" />;
  }

  return (
    <main className="settings-screen" aria-label="Settings">
      <UnitAndIncrementsSection />
      <ThemeSection />
      <FirstDayOfWeekSection />
      <BandLabelsSection />
      <DataSection />
    </main>
  );
}
