import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetRow, COMMIT_DEBOUNCE_MS } from '@/presentation/logging/set-row';

const baseProps = {
  loadKind: 'weight' as const,
  volumeKind: 'reps' as const,
  trackEffort: false,
  bandLabels: ['Red', 'Blue'],
  freeTextSuggestions: [],
  onSaveBandLabels: () => {},
};

/** Real time, real waiting: mixing `userEvent` with vitest's fake timers
 * deadlocks (userEvent's own internal delays need real timers), so these
 * tests wait out the actual debounce window instead of simulating it. */
function waitForCommit(onConfirm: ReturnType<typeof vi.fn>) {
  return waitFor(() => expect(onConfirm).toHaveBeenCalled(), {
    timeout: COMMIT_DEBOUNCE_MS + 1000,
  });
}

describe('SetRow (US1 minimal + US3 full load/effort/volume surface, ADR-0006, ADR-0007)', () => {
  it('shows a stated reason instead of any control until a load or volume is entered (FR-019)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(
      screen.getByText(/enter a load or a rep count/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /repeat last set/i }),
    ).not.toBeInTheDocument();
  });

  it('shows only the load input and volume control the template says — no load-type or volume-kind switcher', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /change load type/i }),
    ).not.toBeInTheDocument();
  });

  it('effort is hidden unless the template tracks it', () => {
    const { rerender } = render(
      <SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />,
    );
    expect(
      screen.queryByRole('listbox', { name: /effort/i }),
    ).not.toBeInTheDocument();

    rerender(
      <SetRow
        {...baseProps}
        trackEffort
        prefill={undefined}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByRole('listbox', { name: /effort/i }),
    ).toBeInTheDocument();
  });

  it('there is no confirm control anywhere on the row (ADR-0007, FR-003)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(
      screen.queryByRole('button', { name: /add set/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^save$/i)).not.toBeInTheDocument();
  });

  it(
    'entering reps commits a set with load "none" once the debounce settles, not per keystroke (ADR-0007, FR-019)',
    async () => {
      const onConfirm = vi.fn();
      render(
        <SetRow
          {...baseProps}
          loadKind="none"
          prefill={undefined}
          onConfirm={onConfirm}
        />,
      );

      await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
      await userEvent.keyboard('{ArrowDown}'.repeat(8));

      // Not committed yet — the debounce window hasn't elapsed.
      expect(onConfirm).not.toHaveBeenCalled();

      await waitForCommit(onConfirm);

      // Exactly one set, with the final settled value — not one per
      // intermediate arrow-key step along the way to 8.
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith({
        volume: { kind: 'reps', count: 8 },
        load: { kind: 'none' },
        setKind: 'working',
      });
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );

  it(
    'typing a weight commits it as a Weight load, ≥ 0, once the debounce settles (FR-026, ADR-0007)',
    async () => {
      const onConfirm = vi.fn();
      render(
        <SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />,
      );

      await userEvent.type(
        screen.getByRole('spinbutton', { name: /weight/i }),
        '60',
      );
      expect(onConfirm).not.toHaveBeenCalled();

      await waitForCommit(onConfirm);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith({
        load: { kind: 'weight', value: 60, unit: 'kg' },
        setKind: 'working',
      });
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );

  it(
    'filling weight then reps in quick succession commits exactly one set with both, not one per field (multi-field debounce regression)',
    async () => {
      const onConfirm = vi.fn();
      render(
        <SetRow {...baseProps} prefill={undefined} onConfirm={onConfirm} />,
      );

      await userEvent.type(
        screen.getByRole('spinbutton', { name: /weight/i }),
        '60',
      );
      await userEvent.click(screen.getByRole('listbox', { name: /^reps$/i }));
      await userEvent.keyboard('{ArrowDown}'.repeat(8));

      await waitForCommit(onConfirm);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith({
        volume: { kind: 'reps', count: 8 },
        load: { kind: 'weight', value: 60, unit: 'kg' },
        setKind: 'working',
      });
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );

  it("pre-fills from the previous set's load/volume when it matches the current template and offers a single-tap repeat (FR-008, ADR-0007)", () => {
    render(
      <SetRow
        {...baseProps}
        prefill={{
          volume: { kind: 'reps', count: 5 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: /weight/i })).toHaveValue(
      100,
    );
    expect(screen.getByRole('option', { name: '5' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /repeat last set/i }),
    ).toBeInTheDocument();
  });

  it('tapping "Repeat last set" confirms the pre-filled set unchanged, immediately (no debounce)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        prefill={{
          volume: { kind: 'reps', count: 5 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /repeat last set/i }),
    );

    expect(onConfirm).toHaveBeenCalledWith({
      volume: { kind: 'reps', count: 5 },
      load: { kind: 'weight', value: 100, unit: 'kg' },
      setKind: 'working',
    });
  });

  it(
    '"Repeat last set" disappears the instant the user edits anything, and does not itself schedule a duplicate commit',
    async () => {
      const onConfirm = vi.fn();
      render(
        <SetRow
          {...baseProps}
          prefill={{
            volume: { kind: 'reps', count: 5 },
            load: { kind: 'weight', value: 100, unit: 'kg' },
          }}
          onConfirm={onConfirm}
        />,
      );

      await userEvent.type(
        screen.getByRole('spinbutton', { name: /weight/i }),
        '5',
      );

      expect(
        screen.queryByRole('button', { name: /repeat last set/i }),
      ).not.toBeInTheDocument();

      await waitForCommit(onConfirm);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );

  it('does not offer "Repeat last set" with no previous set to repeat, even if the row is already valid', () => {
    render(
      <SetRow
        {...baseProps}
        loadKind="bodyweight"
        prefill={undefined}
        onConfirm={() => {}}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /repeat last set/i }),
    ).not.toBeInTheDocument();
  });

  it('offers "Log this set" for a fresh, untouched Bodyweight-only row with nothing else required, and it commits immediately (no debounce)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        loadKind="bodyweight"
        prefill={undefined}
        onConfirm={onConfirm}
      />,
    );

    const button = screen.getByRole('button', { name: /log this set/i });
    await userEvent.click(button);

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'bodyweight' },
      setKind: 'working',
    });
  });

  it(
    'a pending commit fires against the current onConfirm, not the one captured when the edit happened (stale-block-id-after-move regression)',
    async () => {
      const onConfirmA = vi.fn();
      const onConfirmB = vi.fn();
      const { rerender } = render(
        <SetRow {...baseProps} prefill={undefined} onConfirm={onConfirmA} />,
      );

      await userEvent.type(
        screen.getByRole('spinbutton', { name: /weight/i }),
        '60',
      );

      // Simulates the exercise entry moving to another block while the
      // commit is still pending: the parent re-renders `SetRow` with a new
      // `onConfirm` closure bound to the new block, well before the
      // debounce elapses.
      rerender(
        <SetRow {...baseProps} prefill={undefined} onConfirm={onConfirmB} />,
      );

      await waitForCommit(onConfirmB);

      expect(onConfirmA).not.toHaveBeenCalled();
      expect(onConfirmB).toHaveBeenCalledTimes(1);
      expect(onConfirmB).toHaveBeenCalledWith({
        load: { kind: 'weight', value: 60, unit: 'kg' },
        setKind: 'working',
      });
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );

  it('normalizes an out-of-range historical rep-count prefill instead of offering it under an "unset" wheel (out-of-range-prefill regression)', async () => {
    const onConfirm = vi.fn();
    render(
      <SetRow
        {...baseProps}
        prefill={{
          // Legal historical data: `createVolume` has no upper bound on
          // reps, but the wheel only offers 1..100.
          volume: { kind: 'reps', count: 150 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={onConfirm}
      />,
    );

    // The wheel correctly shows nothing selected...
    expect(screen.getByRole('option', { name: '—' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // ...and the weight alone (still pre-filled) already makes "Repeat
    // last set" available without the stale out-of-range count.
    await userEvent.click(
      screen.getByRole('button', { name: /repeat last set/i }),
    );

    expect(onConfirm).toHaveBeenCalledWith({
      load: { kind: 'weight', value: 100, unit: 'kg' },
      setKind: 'working',
    });
  });

  it("ignores a prefill whose load kind no longer matches the exercise's template", () => {
    render(
      <SetRow
        {...baseProps}
        loadKind="band"
        prefill={{
          volume: { kind: 'reps', count: 5 },
          load: { kind: 'weight', value: 100, unit: 'kg' },
        }}
        onConfirm={() => {}}
      />,
    );

    expect(
      screen.queryByRole('spinbutton', { name: /weight/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Red' })).toBeInTheDocument();
  });

  it('the weight field has no dedicated quick-increment buttons (numeric keypad only)', () => {
    render(<SetRow {...baseProps} prefill={undefined} onConfirm={() => {}} />);

    expect(
      screen.queryByRole('button', { name: /increase weight/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /decrease weight/i }),
    ).not.toBeInTheDocument();
  });

  it(
    'selecting a band commits it as a Band load once the debounce settles, no expand step',
    async () => {
      const onConfirm = vi.fn();
      render(
        <SetRow
          {...baseProps}
          loadKind="band"
          prefill={undefined}
          onConfirm={onConfirm}
        />,
      );

      await userEvent.click(screen.getByRole('radio', { name: 'Red' }));
      await waitForCommit(onConfirm);

      expect(onConfirm).toHaveBeenCalledWith({
        load: { kind: 'band', label: 'Red' },
        setKind: 'working',
      });
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );

  it(
    'Bodyweight with no component is valid once the added/assisted field is touched and the debounce settles (US3, Acceptance Scenario 3.5)',
    async () => {
      const onConfirm = vi.fn();
      render(
        <SetRow
          {...baseProps}
          loadKind="bodyweight"
          prefill={undefined}
          onConfirm={onConfirm}
        />,
      );

      await userEvent.type(
        screen.getByRole('spinbutton', { name: /added.*assisted/i }),
        '10',
      );
      await waitForCommit(onConfirm);

      expect(onConfirm).toHaveBeenCalledWith({
        load: { kind: 'bodyweight', addedOrAssistedKg: 10 },
        setKind: 'working',
      });
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );

  it(
    'selecting an effort level includes it, always paired with its word label, and commits once settled (ADR-0003)',
    async () => {
      const onConfirm = vi.fn();
      render(
        <SetRow
          {...baseProps}
          trackEffort
          prefill={undefined}
          onConfirm={onConfirm}
        />,
      );

      await userEvent.type(
        screen.getByRole('spinbutton', { name: /weight/i }),
        '20',
      );
      await userEvent.click(screen.getByRole('listbox', { name: /^effort$/i }));
      await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      await waitForCommit(onConfirm);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ effort: 3 }),
      );
    },
    COMMIT_DEBOUNCE_MS + 2000,
  );
});
