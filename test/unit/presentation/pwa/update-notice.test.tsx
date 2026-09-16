import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateNotice } from '@/presentation/pwa/update-notice';
import { usePwaLifecycleStore } from '@/application/pwa-lifecycle-store';
import { useUnconfirmedEntryTracker } from '@/application/logging/unconfirmed-entry-tracker';
import { InMemoryPwaLifecycle } from '../../../support';

describe('UpdateNotice (spec 009 FR-001-005/FR-018)', () => {
  let fake: InstanceType<typeof InMemoryPwaLifecycle>;

  beforeEach(() => {
    fake = new InMemoryPwaLifecycle();
    usePwaLifecycleStore.setState({ port: undefined, updateAvailable: false });
    useUnconfirmedEntryTracker.setState({ count: 0 });
  });

  it('renders nothing when no update is available', () => {
    usePwaLifecycleStore.getState().configure(fake);
    render(<UpdateNotice />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the banner once an update is available (FR-001)', () => {
    usePwaLifecycleStore.getState().configure(fake);
    fake.triggerUpdateAvailable();
    render(<UpdateNotice />);

    expect(
      screen.getByRole('status', { name: 'Update available' }),
    ).toBeInTheDocument();
  });

  it('never renders while a set is unconfirmed, even with an update available (FR-002, NON-NEGOTIABLE)', () => {
    usePwaLifecycleStore.getState().configure(fake);
    fake.triggerUpdateAvailable();
    useUnconfirmedEntryTracker.getState().increment();
    render(<UpdateNotice />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('applying the update calls the port and never applies automatically otherwise (FR-003/FR-004)', async () => {
    usePwaLifecycleStore.getState().configure(fake);
    fake.triggerUpdateAvailable();
    render(<UpdateNotice />);

    expect(fake.applyUpdateCallCount).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(fake.applyUpdateCallCount).toBe(1);
  });

  it('"Later" hides the notice without applying the update (FR-004)', async () => {
    usePwaLifecycleStore.getState().configure(fake);
    fake.triggerUpdateAvailable();
    render(<UpdateNotice />);

    await userEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fake.applyUpdateCallCount).toBe(0);
  });
});
