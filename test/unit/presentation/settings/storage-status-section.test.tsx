import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageStatusSection } from '@/presentation/settings/storage-status-section';
import { useStorageStatusStore } from '@/application/storage-status-store';
import { InMemoryStorage } from '../../../support';
import type { StorageStatus } from '@/application/ports/storage-status';

describe('StorageStatusSection (spec 009 FR-006-009/FR-017)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    useStorageStatusStore.setState({
      storage: undefined,
      status: undefined,
      loaded: false,
      reconfirming: false,
      reconfirmError: undefined,
    });
  });

  it('states IndexedDB storage in plain, non-error language (FR-008)', async () => {
    useStorageStatusStore.getState().configure(storage);
    render(<StorageStatusSection />);

    await waitFor(() =>
      expect(
        screen.getByText(/browser\/app’s own storage/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('states the folder name when the File System adapter has one (FR-007)', async () => {
    storage.getStorageStatus = (): Promise<StorageStatus> =>
      Promise.resolve({
        kind: 'file-system',
        folderName: 'gym-log-data',
        permission: 'granted',
      });
    useStorageStatusStore.getState().configure(storage);
    render(<StorageStatusSection />);

    await waitFor(() =>
      expect(screen.getByText(/gym-log-data/)).toBeInTheDocument(),
    );
  });

  it('states no folder is chosen yet, not an error (User Story 2, Acceptance Scenario 4)', async () => {
    storage.getStorageStatus = (): Promise<StorageStatus> =>
      Promise.resolve({
        kind: 'file-system',
        folderName: undefined,
        permission: 'granted',
      });
    useStorageStatusStore.getState().configure(storage);
    render(<StorageStatusSection />);

    await waitFor(() =>
      expect(
        screen.getByText(/chosen automatically the first time/i),
      ).toBeInTheDocument(),
    );
  });

  it('offers a reconnect control when permission needs reconfirmation, and it recovers (FR-009/FR-017)', async () => {
    let permission: 'needs-reconfirmation' | 'granted' = 'needs-reconfirmation';
    storage.getStorageStatus = (): Promise<StorageStatus> =>
      Promise.resolve({
        kind: 'file-system',
        folderName: 'gym-log-data',
        permission,
      });
    storage.reconfirmFileSystemAccess = (): Promise<void> => {
      permission = 'granted';
      return Promise.resolve();
    };
    useStorageStatusStore.getState().configure(storage);
    render(<StorageStatusSection />);

    await waitFor(() =>
      expect(screen.getByText(/needs to be reconfirmed/i)).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Reconnect folder access' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText(/needs to be reconfirmed/i),
      ).not.toBeInTheDocument(),
    );
  });
});
