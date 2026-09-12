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

  it('shows the given subtitle under the block name', () => {
    render(
      <BlockCard
        displayName="Legs"
        hasName={true}
        subtitle="2 exercises · 5 sets logged"
        onRename={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </BlockCard>,
    );

    expect(screen.getByText('2 exercises · 5 sets logged')).toBeInTheDocument();
  });

  it('bare mode renders only children/footer, no header chrome', () => {
    render(
      <BlockCard
        displayName="Block 1"
        hasName={false}
        bare
        onRename={() => {}}
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
