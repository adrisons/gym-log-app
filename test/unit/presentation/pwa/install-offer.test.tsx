import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallOffer } from '@/presentation/pwa/install-offer';
import { usePwaLifecycleStore } from '@/application/pwa-lifecycle-store';
import { InMemoryPwaLifecycle } from '../../../support';

describe('InstallOffer (spec 009 FR-010-018)', () => {
  let fake: InstanceType<typeof InMemoryPwaLifecycle>;

  beforeEach(() => {
    fake = new InMemoryPwaLifecycle();
    usePwaLifecycleStore.setState({
      port: undefined,
      installOfferKind: 'unavailable',
      isStandalone: false,
      installOfferDismissedPermanently: false,
      installOfferDismissedThisVisit: false,
    });
  });

  it('renders nothing when unavailable', () => {
    usePwaLifecycleStore.getState().configure(fake);
    render(<InstallOffer />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders nothing when already standalone (FR-013)', () => {
    fake.setInstallOfferKind('native');
    fake.setStandalone(true);
    usePwaLifecycleStore.getState().configure(fake);
    render(<InstallOffer />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an Install control for the native kind (FR-010/FR-011)', async () => {
    fake.setInstallOfferKind('native');
    fake.setNextInstallChoice('accepted');
    usePwaLifecycleStore.getState().configure(fake);
    render(<InstallOffer />);

    await userEvent.click(screen.getByRole('button', { name: 'Install' }));

    expect(fake.promptNativeInstallCallCount).toBe(1);
  });

  it('renders manual instructions, no Install button, for the manual kind (FR-012)', () => {
    fake.setInstallOfferKind('manual');
    usePwaLifecycleStore.getState().configure(fake);
    render(<InstallOffer />);

    expect(
      screen.queryByRole('button', { name: 'Install' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/add to home screen/i);
  });

  it('"Don\'t show again" persists the dismissal via the port (FR-014)', async () => {
    fake.setInstallOfferKind('native');
    usePwaLifecycleStore.getState().configure(fake);
    render(<InstallOffer />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Don’t show again' }),
    );

    expect(fake.isInstallOfferDismissed()).toBe(true);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('"Not now" hides the offer for this visit only, without touching the port', async () => {
    fake.setInstallOfferKind('native');
    usePwaLifecycleStore.getState().configure(fake);
    render(<InstallOffer />);

    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fake.isInstallOfferDismissed()).toBe(false);
  });
});
