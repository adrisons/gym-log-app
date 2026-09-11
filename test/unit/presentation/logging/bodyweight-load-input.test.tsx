import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BodyweightLoadInput } from '@/presentation/logging/bodyweight-load-input';

describe('BodyweightLoadInput (FR-014)', () => {
  it('shows "Bodyweight only" when no component is set', () => {
    render(
      <BodyweightLoadInput addedOrAssistedKg={undefined} onChange={() => {}} />,
    );
    expect(screen.getByText('Bodyweight only')).toBeInTheDocument();
  });

  it('reports an added component', () => {
    render(<BodyweightLoadInput addedOrAssistedKg={10} onChange={() => {}} />);
    expect(screen.getByText('Bodyweight +10 kg')).toBeInTheDocument();
  });

  it('reports an assisted (negative) component', () => {
    render(<BodyweightLoadInput addedOrAssistedKg={-20} onChange={() => {}} />);
    expect(screen.getByText('Bodyweight -20 kg')).toBeInTheDocument();
  });

  it('clamps a value above +300 to +300', () => {
    const onChange = vi.fn();
    render(
      <BodyweightLoadInput addedOrAssistedKg={undefined} onChange={onChange} />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '500' } });
    expect(onChange).toHaveBeenCalledWith(300);
  });

  it('clamps a value below -300 to -300', () => {
    const onChange = vi.fn();
    render(
      <BodyweightLoadInput addedOrAssistedKg={undefined} onChange={onChange} />,
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-500' } });
    expect(onChange).toHaveBeenCalledWith(-300);
  });

  it('treats exactly 0 as "no component"', () => {
    const onChange = vi.fn();
    render(<BodyweightLoadInput addedOrAssistedKg={10} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
