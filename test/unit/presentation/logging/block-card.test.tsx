import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockCard } from '@/presentation/logging/block-card';

describe('BlockCard (FR-006, FR-007)', () => {
  it('an unnamed block renders its position label, never "Untitled"', () => {
    render(
      <BlockCard
        displayName="Block 2"
        hasName={false}
        onRename={() => {}}
        onSetRounds={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );
    expect(screen.getByText('Block 2')).toBeInTheDocument();
    expect(screen.queryByText(/untitled/i)).not.toBeInTheDocument();
  });

  it('renaming calls onRename with the new name', async () => {
    const onRename = vi.fn();
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        onRename={onRename}
        onSetRounds={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    await userEvent.click(screen.getByRole('button', { name: /rename/i }));
    await userEvent.type(screen.getByLabelText(/block name/i), 'Squats');
    await userEvent.click(screen.getByRole('button', { name: /save name/i }));

    expect(onRename).toHaveBeenCalledWith('Squats');
  });

  it('delete calls onDelete', async () => {
    const onDelete = vi.fn();
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        onRename={() => {}}
        onSetRounds={() => {}}
        onDelete={onDelete}
      >
        <p>content</p>
      </BlockCard>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /delete block/i }),
    );

    expect(onDelete).toHaveBeenCalled();
  });

  it('shows the given subtitle under the block name', () => {
    render(
      <BlockCard
        displayName="Legs"
        hasName={true}
        subtitle="2 exercises · 5 sets logged"
        onRename={() => {}}
        onSetRounds={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    expect(screen.getByText('2 exercises · 5 sets logged')).toBeInTheDocument();
  });

  it('collapsing hides children and expanding shows them again (FR-2)', async () => {
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        onRename={() => {}}
        onSetRounds={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    const collapseWrap = screen
      .getByText('content')
      .closest('.block-card__collapse')!;
    expect(collapseWrap).not.toHaveClass('block-card__collapse--collapsed');
    expect(collapseWrap).not.toHaveAttribute('inert');

    await userEvent.click(
      screen.getByRole('button', { name: /collapse block 1/i }),
    );
    // Animated to zero height and taken out of the tab order/AT tree
    // (`inert`) — never unmounted: a `SetRow` inside can have a debounced
    // commit in flight (ADR-0007) that must survive a mere visual collapse.
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(collapseWrap).toHaveClass('block-card__collapse--collapsed');
    expect(collapseWrap).toHaveAttribute('inert');
    expect(screen.getByText('Block 1')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /expand block 1/i }),
    );
    // Still `inert` immediately after expanding: the grid-template-rows
    // transition is still animating open, and jsdom fires no real CSS
    // transition events on its own — content must stay clipped/unreachable
    // until the wrapper's own `onTransitionEnd` says the transition
    // actually finished (Copilot review, PR #22).
    expect(collapseWrap).not.toHaveClass('block-card__collapse--collapsed');
    expect(collapseWrap).toHaveClass('block-card__collapse--transitioning');
    expect(collapseWrap).toHaveAttribute('inert');

    fireEvent.transitionEnd(collapseWrap, {
      propertyName: 'grid-template-rows',
    });

    expect(collapseWrap).not.toHaveClass('block-card__collapse--transitioning');
    expect(collapseWrap).not.toHaveAttribute('inert');
  });

  it('shows an unset rounds field by default and reports a typed value (ADR-0008)', async () => {
    const onSetRounds = vi.fn();
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        onRename={() => {}}
        onSetRounds={onSetRounds}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    const roundsInput = screen.getByRole('spinbutton', { name: /rounds/i });
    expect(roundsInput).toHaveValue(null);

    await userEvent.type(roundsInput, '3');

    expect(onSetRounds).toHaveBeenLastCalledWith(3);
  });

  it('rejects a non-integer rounds value rather than silently truncating it', async () => {
    const onSetRounds = vi.fn();
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        rounds={3}
        onRename={() => {}}
        onSetRounds={onSetRounds}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    const roundsInput = screen.getByRole('spinbutton', { name: /rounds/i });
    onSetRounds.mockClear();

    fireEvent.change(roundsInput, { target: { value: '2.5' } });

    // Never called with the floor-truncated 2 — a decimal is rejected
    // outright, not silently rounded down to a value never entered.
    expect(onSetRounds).not.toHaveBeenCalled();
  });

  it('clearing the rounds field reports undefined, not zero', async () => {
    const onSetRounds = vi.fn();
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        rounds={3}
        onRename={() => {}}
        onSetRounds={onSetRounds}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    const roundsInput = screen.getByRole('spinbutton', { name: /rounds/i });
    expect(roundsInput).toHaveValue(3);

    await userEvent.clear(roundsInput);

    expect(onSetRounds).toHaveBeenLastCalledWith(undefined);
  });

  it("rounds stays visible while the block is collapsed (it is the block's own plan, not its logged content)", async () => {
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        rounds={3}
        onRename={() => {}}
        onSetRounds={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /collapse block 1/i }),
    );

    expect(screen.getByRole('spinbutton', { name: /rounds/i })).toBeVisible();
  });

  it('bare mode renders only children/footer, no header chrome', () => {
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        bare
        onRename={() => {}}
        onSetRounds={() => {}}
        onDelete={() => {}}
        footer={<p>footer content</p>}
      >
        <p>exercise content</p>
      </BlockCard>,
    );

    expect(screen.getByText('exercise content')).toBeInTheDocument();
    expect(screen.getByText('footer content')).toBeInTheDocument();
    expect(screen.queryByText('Block 1')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /rename/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /actions/i }),
    ).not.toBeInTheDocument();
  });
});
