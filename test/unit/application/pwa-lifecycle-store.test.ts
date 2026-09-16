import { beforeEach, describe, expect, it } from 'vitest';
import { usePwaLifecycleStore } from '@/application/pwa-lifecycle-store';
import { InMemoryPwaLifecycle } from '../../support';

describe('pwa-lifecycle-store (spec 009 FR-001-018)', () => {
  let fake: InstanceType<typeof InMemoryPwaLifecycle>;

  beforeEach(() => {
    fake = new InMemoryPwaLifecycle();
    usePwaLifecycleStore.setState({
      port: undefined,
      updateAvailable: false,
      installOfferKind: 'unavailable',
      isStandalone: false,
      installOfferDismissedPermanently: false,
      installOfferDismissedThisVisit: false,
    });
  });

  describe('update lifecycle (FR-001-005)', () => {
    it('flips updateAvailable when the port reports a new version (FR-001)', () => {
      usePwaLifecycleStore.getState().configure(fake);
      expect(usePwaLifecycleStore.getState().updateAvailable).toBe(false);

      fake.triggerUpdateAvailable();

      expect(usePwaLifecycleStore.getState().updateAvailable).toBe(true);
    });

    it('applyUpdate calls the port and resets updateAvailable (FR-003)', async () => {
      usePwaLifecycleStore.getState().configure(fake);
      fake.triggerUpdateAvailable();

      await usePwaLifecycleStore.getState().applyUpdate();

      expect(fake.applyUpdateCallCount).toBe(1);
      expect(usePwaLifecycleStore.getState().updateAvailable).toBe(false);
    });

    it('never flips updateAvailable on its own at configure time (FR-005: no notice for the version already current at launch)', () => {
      usePwaLifecycleStore.getState().configure(fake);
      expect(usePwaLifecycleStore.getState().updateAvailable).toBe(false);
    });
  });

  describe('install offer (FR-010-018)', () => {
    it('reads installOfferKind/isStandalone/dismissed state from the port at configure time', () => {
      fake.setInstallOfferKind('native');
      fake.setStandalone(false);
      fake.dismissInstallOfferPermanently();

      usePwaLifecycleStore.getState().configure(fake);

      const state = usePwaLifecycleStore.getState();
      expect(state.installOfferKind).toBe('native');
      expect(state.isStandalone).toBe(false);
      expect(state.installOfferDismissedPermanently).toBe(true);
    });

    it('reacts to the port announcing a kind change after configure (e.g. a delayed beforeinstallprompt)', () => {
      usePwaLifecycleStore.getState().configure(fake);
      expect(usePwaLifecycleStore.getState().installOfferKind).toBe(
        'unavailable',
      );

      fake.setInstallOfferKind('native');

      expect(usePwaLifecycleStore.getState().installOfferKind).toBe('native');
    });

    it('promptNativeInstall calls the port and refreshes isStandalone', async () => {
      fake.setInstallOfferKind('native');
      fake.setNextInstallChoice('accepted');
      usePwaLifecycleStore.getState().configure(fake);

      const outcome = await usePwaLifecycleStore
        .getState()
        .promptNativeInstall();

      expect(outcome).toBe('accepted');
      expect(fake.promptNativeInstallCallCount).toBe(1);
    });

    it('dismissInstallOfferPermanently persists via the port and updates the store (FR-014)', () => {
      usePwaLifecycleStore.getState().configure(fake);

      usePwaLifecycleStore.getState().dismissInstallOfferPermanently();

      expect(fake.isInstallOfferDismissed()).toBe(true);
      expect(
        usePwaLifecycleStore.getState().installOfferDismissedPermanently,
      ).toBe(true);
    });

    it('dismissInstallOfferForThisVisit is in-memory only — never touches the port', () => {
      usePwaLifecycleStore.getState().configure(fake);

      usePwaLifecycleStore.getState().dismissInstallOfferForThisVisit();

      expect(
        usePwaLifecycleStore.getState().installOfferDismissedThisVisit,
      ).toBe(true);
      expect(fake.isInstallOfferDismissed()).toBe(false);
    });
  });
});
