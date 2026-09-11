import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BandLoadInput } from '@/presentation/logging/band-load-input';

describe('BandLoadInput (FR-011)', () => {
  it("lists the user's band labels in their stored order", () => {
    render(
      <BandLoadInput
        bandLabels={['Red', 'Blue', 'Green']}
        selectedLabel={undefined}
        onSelectLabel={() => {}}
        onSaveBandLabels={() => {}}
      />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Red', 'Blue', 'Green']);
  });

  it('selecting a label calls onSelectLabel', async () => {
    const onSelectLabel = vi.fn();
    render(
      <BandLoadInput
        bandLabels={['Red', 'Blue']}
        selectedLabel={undefined}
        onSelectLabel={onSelectLabel}
        onSaveBandLabels={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Red' }));

    expect(onSelectLabel).toHaveBeenCalledWith('Red');
  });

  it('adding a label calls onSaveBandLabels with the appended list', async () => {
    const onSaveBandLabels = vi.fn();
    render(
      <BandLoadInput
        bandLabels={['Red']}
        selectedLabel={undefined}
        onSelectLabel={() => {}}
        onSaveBandLabels={onSaveBandLabels}
      />,
    );

    await userEvent.type(
      screen.getByPlaceholderText('New band label'),
      'Purple',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add label' }));

    expect(onSaveBandLabels).toHaveBeenCalledWith(['Red', 'Purple']);
  });

  it('reordering a label calls onSaveBandLabels with the new order', async () => {
    const onSaveBandLabels = vi.fn();
    render(
      <BandLoadInput
        bandLabels={['Red', 'Blue']}
        selectedLabel={undefined}
        onSelectLabel={() => {}}
        onSaveBandLabels={onSaveBandLabels}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Move Blue up' }));

    expect(onSaveBandLabels).toHaveBeenCalledWith(['Blue', 'Red']);
  });

  it('removing a label calls onSaveBandLabels without it', async () => {
    const onSaveBandLabels = vi.fn();
    render(
      <BandLoadInput
        bandLabels={['Red', 'Blue']}
        selectedLabel={undefined}
        onSelectLabel={() => {}}
        onSaveBandLabels={onSaveBandLabels}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove Red' }));

    expect(onSaveBandLabels).toHaveBeenCalledWith(['Blue']);
  });
});
