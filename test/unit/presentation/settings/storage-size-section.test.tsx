import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StorageSizeSection } from '@/presentation/settings/storage-size-section';
import { useStorageAccess } from '@/application/storage-access';
import { InMemoryStorage } from '../../../support';

describe('StorageSizeSection (FR-001-004)', () => {
  it('shows a whole-number KB/MB figure next to the storage status, never a decimal', async () => {
    const storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
    render(<StorageSizeSection />);

    await waitFor(() => {
      expect(screen.getByText(/^\d+ (KB|MB)$/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/\./)).not.toBeInTheDocument();
  });

  it('shows a figure for a completely fresh store, never blank or "0 KB"', async () => {
    useStorageAccess.getState().configure(new InMemoryStorage());
    render(<StorageSizeSection />);

    await waitFor(() => {
      expect(screen.getByText(/^\d+ (KB|MB)$/)).toBeInTheDocument();
    });
    expect(screen.queryByText('0 KB')).not.toBeInTheDocument();
  });
});
