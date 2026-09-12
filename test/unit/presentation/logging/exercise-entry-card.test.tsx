import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseEntryCard } from '@/presentation/logging/exercise-entry-card';

describe('ExerciseEntryCard', () => {
  it('reorder handles are keyboard-operable buttons, not drag-only, reachable from the entry menu', async () => {
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

    await userEvent.click(
      screen.getByRole('button', { name: /back squat actions/i }),
    );
    const up = screen.getByRole('menuitem', { name: /^move up$/i });
    await userEvent.click(up);
    expect(onMoveUp).toHaveBeenCalled();

    expect(
      screen.getByRole('menuitem', { name: /^move down$/i }),
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

    await userEvent.click(
      screen.getByRole('button', { name: /back squat actions/i }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/move to block/i),
      'block-2',
    );

    expect(onMoveToBlock).toHaveBeenCalledWith('block-2');
  });

  it('delete calls onDelete', async () => {
    const onDelete = vi.fn();
    render(
      <ExerciseEntryCard
        exerciseName="Back squat"
        canMoveUp={false}
        canMoveDown={false}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        otherBlocks={[]}
        onMoveToBlock={() => {}}
        onDelete={onDelete}
      >
        <p>content</p>
      </ExerciseEntryCard>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /back squat actions/i }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: /delete exercise/i }),
    );

    expect(onDelete).toHaveBeenCalled();
  });
});
