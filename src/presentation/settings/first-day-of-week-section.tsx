/**
 * FR-001/018: first day of the week, driving the Insights consistency
 * card's week boundaries (`specs/005-insights` FR-010).
 */
import { useSettingsStore } from '@/application/settings-store';

const OPTIONS: { value: 'monday' | 'sunday'; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'sunday', label: 'Sunday' },
];

export function FirstDayOfWeekSection() {
  const firstDayOfWeek = useSettingsStore(
    (state) => state.settings.firstDayOfWeek,
  );
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  return (
    <section className="settings-section" aria-label="First day of the week">
      <h2>First day of the week</h2>
      <fieldset className="settings-radio-group">
        <legend className="settings-field-label">Week starts on</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="settings-radio">
            <input
              type="radio"
              name="settings-first-day-of-week"
              value={option.value}
              checked={firstDayOfWeek === option.value}
              onChange={() =>
                void updateSettings({ firstDayOfWeek: option.value })
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
