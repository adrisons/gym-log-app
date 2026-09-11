import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockCard } from '@/presentation/logging/block-card';

describe('BlockCard (FR-006, FR-007)', () => {
  it('an unnamed block renders its position label, never "Untitled"', () => {
    render(
      <BlockCard
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

  it('renaming calls onRename with the new name', async () => {
    const onRename = vi.fn();
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        onRename={onRename}
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
});
