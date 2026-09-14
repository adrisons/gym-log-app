import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockCard } from '@/presentation/logging/block-card';

const baseProps = {
  canMoveUp: false,
  canMoveDown: false,
  onMoveUp: () => {},
  onMoveDown: () => {},
};

describe('BlockCard (FR-006, FR-007)', () => {
  it('an unnamed block renders its position label, never "Untitled"', () => {
    render(
      <BlockCard
        {...baseProps}
        displayName="Block 2"
        hasName={false}
        onRename={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );
    expect(screen.getByText('Block 2')).toBeInTheDocument();
    expect(screen.queryByText(/untitled/i)).not.toBeInTheDocument();
  });

  it('renaming opens a popup dialog and Save calls onRename with the new name (ADR-0009)', async () => {
    const onRename = vi.fn();
    render(
      <BlockCard
        {...baseProps}
        displayName="Block 1"
        hasName={false}
        onRename={onRename}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    await userEvent.click(screen.getByRole('button', { name: /rename/i }));
    const dialog = screen.getByRole('dialog', { name: /rename block 1/i });
    await userEvent.type(screen.getByLabelText(/block name/i), 'Squats');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onRename).toHaveBeenCalledWith('Squats');
    expect(dialog).not.toBeInTheDocument();
  });

  it('Cancel discards the edit without calling onRename, and returns focus to Rename', async () => {
    const onRename = vi.fn();
    render(
      <BlockCard
        {...baseProps}
        displayName="Block 1"
        hasName={false}
        onRename={onRename}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    const [renameButton] = screen.getAllByRole('button', { name: /rename/i });
    await userEvent.click(renameButton!);
    await userEvent.type(screen.getByLabelText(/block name/i), 'Squats');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(renameButton).toHaveFocus();
  });

  it('Escape cancels the popup, and reopening starts from the committed name again', async () => {
    const onRename = vi.fn();
    render(
      <BlockCard
        {...baseProps}
        displayName="Legs"
        hasName={true}
        onRename={onRename}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    await userEvent.click(
      screen.getAllByRole('button', { name: /rename/i })[0]!,
    );
    await userEvent.type(screen.getByLabelText(/block name/i), ' extra');
    await userEvent.keyboard('{Escape}');

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole('button', { name: /rename/i })[0]!,
    );
    expect(screen.getByLabelText(/block name/i)).toHaveValue('Legs');
  });

  it('delete calls onDelete', async () => {
    const onDelete = vi.fn();
    render(
      <BlockCard
        {...baseProps}
        displayName="Block 1"
        hasName={false}
        onRename={() => {}}
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
        {...baseProps}
        displayName="Legs"
        hasName={true}
        subtitle="2 exercises"
        onRename={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    expect(screen.getByText('2 exercises')).toBeInTheDocument();
  });

  it('collapsing hides children and expanding shows them again (FR-2)', async () => {
    render(
      <BlockCard
        {...baseProps}
        displayName="Block 1"
        hasName={false}
        onRename={() => {}}
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

  it('Move up/Move down are disabled at the respective ends and call onMoveUp/onMoveDown otherwise (ADR-0013)', async () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    render(
      <BlockCard
        displayName="Block 2"
        hasName={false}
        canMoveUp={true}
        canMoveDown={false}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRename={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /block 2 actions/i }),
    );
    const moveUp = screen.getByRole('button', { name: 'Move up' });
    const moveDown = screen.getByRole('button', { name: 'Move down' });
    expect(moveUp).toBeEnabled();
    expect(moveDown).toBeDisabled();

    await userEvent.click(moveUp);
    expect(onMoveUp).toHaveBeenCalled();
    expect(onMoveDown).not.toHaveBeenCalled();
  });
});
