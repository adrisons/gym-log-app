import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from '@/presentation/nav/bottom-nav';

function activeTabName(container: HTMLElement): string | undefined {
  return container
    .querySelector('.bottom-nav__tab--active')
    ?.textContent?.trim();
}

describe('BottomNav', () => {
  it('renders all four destinations as links, each with an icon and a label (logging is reached via a FAB, not a tab — FR-1)', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    for (const name of ['Diary', 'Search', 'Insights', 'Exercises']) {
      const link = screen.getByRole('link', { name });
      expect(nav).toContainElement(link);
      expect(link.querySelector('svg')).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Log' })).not.toBeInTheDocument();
  });

  it('marks "Diary" active on the diary route', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/diary']}>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(activeTabName(container)).toBe('Diary');
  });

  it('marks "Diary" active on a nested diary route', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/diary/session-1']}>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(activeTabName(container)).toBe('Diary');
  });

  it('marks "Exercises" active on its own route', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/exercises']}>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(activeTabName(container)).toBe('Exercises');
  });
});
