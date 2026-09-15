import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BandLabelsSection } from '@/presentation/settings/band-labels-section';
import { useStorageAccess } from '@/application/storage-access';
import { InMemoryStorage } from '../../../support';

describe('BandLabelsSection (spec 006 FR-004/005)', () => {
  let storage: InMemoryStorage;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
    await storage.saveBandLabels(['Light', 'Medium']);
  });

  it('loads and displays the stored band labels', async () => {
    render(<BandLabelsSection />);

    await waitFor(() => {
      expect(screen.getByLabelText('Band label 1')).toHaveValue('Light');
      expect(screen.getByLabelText('Band label 2')).toHaveValue('Medium');
    });
  });

  it('adds a new band label and persists it', async () => {
    const user = userEvent.setup();
    render(<BandLabelsSection />);
    await waitFor(() =>
      expect(screen.getByLabelText('Band label 1')).toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText('New band label'), 'Heavy');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(async () => {
      expect(await storage.listBandLabels()).toEqual([
        'Light',
        'Medium',
        'Heavy',
      ]);
    });
    expect(screen.getByLabelText('Band label 3')).toHaveValue('Heavy');
  });

  it('renames a band label and persists the change', async () => {
    const user = userEvent.setup();
    render(<BandLabelsSection />);
    await waitFor(() =>
      expect(screen.getByLabelText('Band label 1')).toBeInTheDocument(),
    );

    await user.clear(screen.getByLabelText('Band label 1'));
    await user.type(screen.getByLabelText('Band label 1'), 'Extra Light');

    await waitFor(async () => {
      expect(await storage.listBandLabels()).toEqual(['Extra Light', 'Medium']);
    });
  });

  it('reorders a band label up and down and persists the new order', async () => {
    const user = userEvent.setup();
    render(<BandLabelsSection />);
    await waitFor(() =>
      expect(screen.getByLabelText('Band label 1')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Move Medium up' }));
    await waitFor(async () => {
      expect(await storage.listBandLabels()).toEqual(['Medium', 'Light']);
    });

    await user.click(screen.getByRole('button', { name: 'Move Medium down' }));
    await waitFor(async () => {
      expect(await storage.listBandLabels()).toEqual(['Light', 'Medium']);
    });
  });

  it('removes a band label and persists the removal', async () => {
    const user = userEvent.setup();
    render(<BandLabelsSection />);
    await waitFor(() =>
      expect(screen.getByLabelText('Band label 1')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Remove Light' }));

    await waitFor(async () => {
      expect(await storage.listBandLabels()).toEqual(['Medium']);
    });
    expect(screen.queryByDisplayValue('Light')).not.toBeInTheDocument();
  });

  it('removing or renaming a label never rewrites a set already logged with it (FR-005) — this section never touches session storage', async () => {
    const user = userEvent.setup();
    render(<BandLabelsSection />);
    await waitFor(() =>
      expect(screen.getByLabelText('Band label 1')).toBeInTheDocument(),
    );

    const saveSessionSpy = vi.spyOn(storage, 'saveSession');
    await user.click(screen.getByRole('button', { name: 'Remove Light' }));

    await waitFor(async () => {
      expect(await storage.listBandLabels()).toEqual(['Medium']);
    });
    expect(saveSessionSpy).not.toHaveBeenCalled();
  });

  it('persists the final edit last even when the first write is slower than the second (Copilot review, PR #31)', async () => {
    const saveOrder: string[][] = [];
    vi.spyOn(storage, 'saveBandLabels').mockImplementation(async (labels) => {
      saveOrder.push(labels);
      // The first save (only) is artificially slow — without the queue
      // serializing these, the fast second write could land and then be
      // clobbered by the slow first write resolving after it, leaving
      // the *older* snapshot persisted despite the UI already showing
      // the newer one.
      const delayMs = saveOrder.length === 1 ? 30 : 0;
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    });

    render(<BandLabelsSection />);
    await waitFor(() =>
      expect(screen.getByLabelText('Band label 1')).toBeInTheDocument(),
    );
    const input = screen.getByLabelText('Band label 1');

    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.change(input, { target: { value: 'AB' } });

    await waitFor(() => expect(saveOrder).toHaveLength(2));
    // The queue chained the second write behind the first, so
    // saveBandLabels was invoked in edit order, not resolution order —
    // the last call recorded is the final, newest edit.
    expect(saveOrder).toEqual([
      ['A', 'Medium'],
      ['AB', 'Medium'],
    ]);
  });
});
