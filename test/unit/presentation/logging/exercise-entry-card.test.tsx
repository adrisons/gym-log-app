import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseEntryCard } from '@/presentation/logging/exercise-entry-card';

describe('ExerciseEntryCard', () => {
  it('reorder handles are keyboard-operable buttons, not drag-only', async () => {
    const onMoveUp = vi.fn();
    render(
      <ExerciseEntryCard
        exerciseName="Back squat"
        canMoveUp={true}
        canMoveDown={false}
        onMoveUp={onMoveUp}
        onMoveDown={() => {}}
        otherBlocks={[]}
        onMoveToBlock={() => {}}
        onDelete={() => {}}
      >
        <p>content</p>
      </ExerciseEntryCard>,
    );

    const up = screen.getByRole('button', { name: /move back squat up/i });
    await userEvent.click(up);
    expect(onMoveUp).toHaveBeenCalled();

    expect(
      screen.getByRole('button', { name: /move back squat down/i }),
    ).toBeDisabled();
  });

  it('moving to another block calls onMoveToBlock', async () => {
    const onMoveToBlock = vi.fn();
    render(
      <ExerciseEntryCard
        exerciseName="Back squat"
        canMoveUp={false}
        canMoveDown={false}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        otherBlocks={[{ id: 'block-2', displayName: 'Block 2' }]}
        onMoveToBlock={onMoveToBlock}
        onDelete={() => {}}
      >
        <p>content</p>
      </ExerciseEntryCard>,
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/move to block/i),
      'block-2',
    );

    expect(onMoveToBlock).toHaveBeenCalledWith('block-2');
  });
});
