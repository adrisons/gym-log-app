import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteOldDataFlow } from '@/presentation/settings/delete-old-data-flow';
import { useStorageAccess } from '@/application/storage-access';
import type { SessionId } from '@/domain/ids';
import { createSession } from '@/domain/session';
import { InMemoryStorage } from '../../../support';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('DeleteOldDataFlow (FR-005-012)', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    useStorageAccess.getState().configure(storage);
  });

  it('delete is disabled until a cutoff is chosen (Acceptance Scenario 2.1)', async () => {
    render(<DeleteOldDataFlow onDeleted={() => {}} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );

    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
  });

  it('shows a live count once a quick option is chosen, and enables delete (Acceptance Scenario 2.2)', async () => {
    await storage.saveSession(
      createSession({
        id: 'old' as SessionId,
        dateTime: daysAgo(400),
        notes: '',
        blocks: [],
      }),
    );
    await storage.saveSession(
      createSession({
        id: 'recent' as SessionId,
        dateTime: daysAgo(1),
        notes: '',
        blocks: [],
      }),
    );

    render(<DeleteOldDataFlow onDeleted={() => {}} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /older than 1 year/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/1 session will be deleted/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeEnabled();
  });

  it('a zero-match cutoff shows a zero count and keeps delete disabled (Acceptance Scenario 2.3)', async () => {
    await storage.saveSession(
      createSession({
        id: 'recent' as SessionId,
        dateTime: daysAgo(1),
        notes: '',
        blocks: [],
      }),
    );

    render(<DeleteOldDataFlow onDeleted={() => {}} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /older than 1 year/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/0 sessions will be deleted/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
  });

  it('an incomplete explicit date shows no stale count and keeps delete disabled (Edge Cases)', async () => {
    await storage.saveSession(
      createSession({
        id: 'old' as SessionId,
        dateTime: daysAgo(400),
        notes: '',
        blocks: [],
      }),
    );

    render(<DeleteOldDataFlow onDeleted={() => {}} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /older than 1 year/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/1 session will be deleted/i),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('radio', { name: /before date/i }));

    expect(
      screen.queryByText(/session.*will be deleted/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
  });

  it('an explicit date past the cutoff counts and deletes correctly, keeping a same-day session', async () => {
    const old = createSession({
      id: 'old' as SessionId,
      dateTime: '2020-01-01T12:00:00.000Z',
      notes: '',
      blocks: [],
    });
    const sameDayLater = createSession({
      id: 'same-day' as SessionId,
      dateTime: '2026-03-01T20:00:00.000Z',
      notes: '',
      blocks: [],
    });
    await storage.saveSession(old);
    await storage.saveSession(sameDayLater);
    const onDeleted = vi.fn();

    render(<DeleteOldDataFlow onDeleted={onDeleted} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );
    await userEvent.click(screen.getByRole('radio', { name: /before date/i }));
    const dateInput = screen.getByLabelText(/cutoff date/i);
    await userEvent.type(dateInput, '2026-03-01');

    await waitFor(() => {
      expect(
        screen.getByText(/1 session will be deleted/i),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.getByText(/deleted 1 session\./i)).toBeInTheDocument();
    });
    expect(onDeleted).toHaveBeenCalled();
    expect(await storage.getSession(old.id)).toBeUndefined();
    expect(await storage.getSession(sameDayLater.id)).toEqual(sameDayLater);
  });

  it('cancelling closes the modal without deleting, and reopening starts with no cutoff chosen (Key Entities)', async () => {
    await storage.saveSession(
      createSession({
        id: 'old' as SessionId,
        dateTime: daysAgo(400),
        notes: '',
        blocks: [],
      }),
    );

    render(<DeleteOldDataFlow onDeleted={() => {}} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /older than 1 year/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/1 session will be deleted/i),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(
      screen.queryByRole('alertdialog', { name: /delete old data/i }),
    ).not.toBeInTheDocument();
    expect(await storage.getSession('old' as SessionId)).toBeDefined();

    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );
    expect(
      screen.queryByText(/session.*will be deleted/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
  });

  it('carries only the cutoff chooser, count, confirm and cancel — no extra copy (FR-012)', async () => {
    render(<DeleteOldDataFlow onDeleted={() => {}} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete old data/i }),
    );

    const dialog = screen.getByRole('alertdialog', {
      name: /delete old data/i,
    });
    // Every radio option and the two action buttons are the only controls;
    // no paragraph of explanatory copy beyond the (not-yet-shown) count.
    expect(dialog.querySelectorAll('button')).toHaveLength(2);
  });
});
