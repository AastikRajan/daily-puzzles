import type { PuzzleType } from '@daily-logic/engine';

/**
 * Miniature grid pictograms — one per puzzle type, drawn to read at 28-44px.
 * Stroke/fill use currentColor so the accent flows from the parent.
 */
export default function TypeGlyph({ type, size = 36 }: { type: PuzzleType; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 36 36',
    fill: 'none',
    'aria-hidden': true,
  } as const;
  const sw = 2;

  switch (type) {
    case 'sudoku':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="30" height="30" rx="4" stroke="currentColor" strokeWidth={sw} />
          <path d="M13 3v30M23 3v30M3 13h30M3 23h30" stroke="currentColor" strokeWidth={sw} opacity="0.45" />
          <text x="8" y="11" fontSize="8" fontWeight="700" fill="currentColor" fontFamily="inherit">7</text>
          <text x="26" y="31.5" fontSize="8" fontWeight="700" fill="currentColor" fontFamily="inherit">3</text>
        </svg>
      );
    case 'killer':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="30" height="30" rx="4" stroke="currentColor" strokeWidth={sw} />
          <path d="M18 3v30M3 18h30" stroke="currentColor" strokeWidth={sw} opacity="0.45" />
          <path d="M7 7h14v7h-7v7H7z" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.4" />
          <circle cx="26" cy="26" r="3.4" fill="currentColor" />
        </svg>
      );
    case 'nonogram':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="30" height="30" rx="4" stroke="currentColor" strokeWidth={sw} />
          <path d="M13 3v30M23 3v30M3 13h30M3 23h30" stroke="currentColor" strokeWidth={sw} opacity="0.45" />
          <rect x="13.8" y="4" width="8.4" height="8.2" fill="currentColor" />
          <rect x="4" y="13.8" width="8.8" height="8.4" fill="currentColor" />
          <rect x="13.8" y="23.8" width="8.4" height="8.2" fill="currentColor" />
          <rect x="23.8" y="13.8" width="8.2" height="8.4" fill="currentColor" />
        </svg>
      );
    case 'kakuro':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="30" height="30" rx="4" stroke="currentColor" strokeWidth={sw} />
          <path d="M18 3v30M3 18h30" stroke="currentColor" strokeWidth={sw} opacity="0.45" />
          <path d="M3.5 3.5L17.5 17.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 6.5 L4 16 L14 16 Z" fill="currentColor" opacity="0.8" />
          <text x="24.5" y="13.5" fontSize="8" fontWeight="700" fill="currentColor" fontFamily="inherit">9</text>
          <text x="7" y="30" fontSize="8" fontWeight="700" fill="currentColor" fontFamily="inherit">6</text>
        </svg>
      );
    case 'binairo':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="30" height="30" rx="4" stroke="currentColor" strokeWidth={sw} />
          <path d="M18 3v30M3 18h30" stroke="currentColor" strokeWidth={sw} opacity="0.45" />
          <circle cx="10.5" cy="10.5" r="3.6" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="25.5" cy="25.5" r="3.6" stroke="currentColor" strokeWidth="2.2" />
          <path d="M25.5 7v7M10.5 22v7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
  }
}
