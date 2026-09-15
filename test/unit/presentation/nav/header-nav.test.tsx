import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeaderNav } from '@/presentation/nav/header-nav';
import {
  ScreenTitleProvider,
  useSetScreenTitle,
} from '@/presentation/nav/screen-title';

describe('HeaderNav', () => {
  it('renders a closed menu behind a right-aligned hamburger button', () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders no title when nothing has registered one (e.g. outside a ScreenTitleProvider)', () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it("shows the current screen's title, registered via useSetScreenTitle, to the left of the menu button", () => {
    function Screen() {
      useSetScreenTitle('Insights');
      return null;
    }
    render(
      <MemoryRouter>
        <ScreenTitleProvider>
          <HeaderNav />
          <Screen />
        </ScreenTitleProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Insights' }),
    ).toBeInTheDocument();
  });

  it('opens the menu with exactly Diary, Insights, Exercises, Settings — no Search (ADR-0009, spec 006 FR-001/006)', () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const menu = screen.getByRole('menu', { name: 'Primary' });
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(4);
    for (const name of ['Diary', 'Insights', 'Exercises', 'Settings']) {
      expect(
        screen.getByRole('menuitem', { name: new RegExp(name) }),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('menuitem', { name: /search/i }),
    ).not.toBeInTheDocument();
    expect(menu).toBeInTheDocument();
  });

  it('marks "Diary" active on a nested diary route', () => {
    render(
      <MemoryRouter initialEntries={['/diary/session-1']}>
        <HeaderNav />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('menuitem', { name: /diary/i })).toHaveClass(
      'header-nav__item--active',
    );
  });

  it('closes on Escape and returns focus to the toggle', () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(toggle);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('closes when choosing a destination', () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /insights/i }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on an outside click', () => {
    render(
      <div>
        <MemoryRouter>
          <HeaderNav />
        </MemoryRouter>
        <button type="button">Elsewhere</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
