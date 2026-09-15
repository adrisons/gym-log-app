/**
 * FR-001/003: light/dark/system theme. Setting it applies
 * `document.documentElement.dataset.theme` immediately (`applyTheme`,
 * `@/presentation/theme`) so the change is visible with no reload;
 * `main.tsx`'s OS-preference listener keeps a `'system'` choice live —
 * see that file's own doc comment for how the two coordinate.
 */
import { useSettingsStore } from '@/application/settings-store';
import { applyTheme } from '@/presentation/theme';

const OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function ThemeSection() {
  const theme = useSettingsStore((state) => state.settings.theme);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  return (
    <section className="settings-section" aria-label="Theme">
      <h2>Theme</h2>
      <fieldset className="settings-radio-group">
        <legend className="settings-field-label">Appearance</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="settings-radio">
            <input
              type="radio"
              name="settings-theme"
              value={option.value}
              checked={theme === option.value}
              onChange={() => {
                applyTheme(option.value);
                void updateSettings({ theme: option.value });
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
