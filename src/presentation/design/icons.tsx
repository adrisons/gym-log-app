/**
 * The app's one icon set (docs/design.md §1.2: "line icons only,
 * consistent stroke weight, on a fixed grid"). Every icon shares the same
 * 20x20 grid, 1.75 stroke, round caps/joins — hand-drawn rather than
 * pulled from a library, so the whole set reads as one family instead of
 * whatever a third-party set happened to ship.
 *
 * Every icon is `aria-hidden` and purely decorative: docs/design.md §1.2
 * and requirements.md §7.4 both require a word alongside any icon-carried
 * meaning, so the accessible name always lives on the surrounding button/
 * label, never on the icon itself.
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'plus'
  | 'pencil'
  | 'trash'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-right'
  | 'move-to'
  | 'sliders'
  | 'more-vertical'
  | 'close'
  | 'check'
  | 'calendar'
  | 'dumbbell'
  | 'book'
  | 'search'
  | 'chart'
  | 'list'
  | 'menu';

const PATHS: Record<IconName, string> = {
  plus: 'M10 4v12M4 10h12',
  pencil: 'M12.5 3.5l4 4L6 18H2v-4L12.5 3.5Z',
  trash:
    'M4 6h12M8 6V4h4v2M6 6l.8 10.2c.05.7.63 1.3 1.33 1.3h3.74c.7 0 1.28-.6 1.33-1.3L14 6M9 9.5v5M11 9.5v5',
  'chevron-up': 'M5 12.5l5-5 5 5',
  'chevron-down': 'M5 7.5l5 5 5-5',
  'chevron-right': 'M7.5 5l5 5-5 5',
  'move-to': 'M4 10h10M10 5.5L14.5 10 10 14.5',
  sliders: 'M5 4v5M5 12v4M10 4v9M10 16v0M15 4v2M15 9v7M3 9h4M8 13h4M13 6h4',
  'more-vertical': 'M10 4.5v.01M10 10v.01M10 15.5v.01',
  close: 'M5 5l10 10M15 5L5 15',
  check: 'M4 10.5l4 4 8-9',
  calendar: 'M4 5h12v11H4z M4 8h12 M7 3v3 M13 3v3',
  dumbbell: 'M5.5 5.5v9 M6 10h8 M14.5 5.5v9',
  book: 'M10 6.5c-1-1-2.8-1.5-6-1.5v9.5c3.2 0 5 .5 6 1.5 1-1 2.8-1.5 6-1.5V5c-3.2 0-5 .5-6 1.5Z M10 6.5v9.5',
  search: 'M12.5 12.5 17 17 M9 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z',
  chart: 'M4 16V9 M9.5 16V4 M15 16v-6',
  list: 'M4 5.5h12 M4 10h12 M4 14.5h12',
  menu: 'M4 6h12 M4 10h12 M4 14h12',
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
