import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from '@/presentation/settings/settings-screen';
import { useStorageAccess } from '@/application/storage-access';
import { useFileExchangeAccess } from '@/application/file-exchange-access';
import { useSettingsStore } from '@/application/settings-store';
import { InMemoryStorage, InMemoryFileExchange } from '../../../support';

describe('SettingsScreen (spec 006 FR-001-006)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
    useFileExchangeAccess.getState().configure(new InMemoryFileExchange());
    useSettingsStore.getState().configure(storage);
    useSettingsStore.setState({
      settings: useSettingsStore.getState().settings,
      loaded: false,
    });
  });

  it('renders every section once loaded', async () => {
    render(<SettingsScreen />);
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Unit and increments' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('region', { name: 'Theme' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'First day of the week' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Band labels' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Data' })).toBeInTheDocument();
  });

  it('changing the default unit applies immediately and persists (FR-001/002, SC-003)', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText('Default unit')).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByLabelText('Default unit'), 'lb');

    await waitFor(async () => {
      const saved = await storage.getSettings();
      expect(saved?.defaultUnit).toBe('lb');
    });
    expect(screen.getByLabelText('Default unit')).toHaveValue('lb');
  });

  it('changing first day of week persists (FR-018 dependency)', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Sunday' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('radio', { name: 'Sunday' }));

    await waitFor(async () => {
      const saved = await storage.getSettings();
      expect(saved?.firstDayOfWeek).toBe('sunday');
    });
  });
});
