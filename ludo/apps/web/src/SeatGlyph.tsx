import React from 'react';

/**
 * Seat identity symbols. Colour is never the only way to tell players apart:
 * every seat owns one silhouette that is reused on pawns, player cards,
 * yards, turn indicators and the match timeline.
 */
export const SEAT_SYMBOLS = ['circle', 'triangle', 'diamond', 'square'] as const;
export type SeatSymbol = (typeof SEAT_SYMBOLS)[number];

const COLOR_TO_SEAT: Record<string, number> = { red: 0, green: 1, yellow: 2, blue: 3 };

export const seatForColor = (color?: string): number =>
  color && color in COLOR_TO_SEAT ? COLOR_TO_SEAT[color] : 0;

/** Bare 24×24 shape, for embedding inside another SVG. */
export const SeatSymbolShape: React.FC<{ seat: number }> = ({ seat }) => {
  switch (((seat % 4) + 4) % 4) {
    case 1:
      return <path d="M12 2.8 L21.4 20.4 H2.6 Z" />;
    case 2:
      return <path d="M12 2.2 L21.8 12 L12 21.8 L2.2 12 Z" />;
    case 3:
      return <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.6" />;
    default:
      return <circle cx="12" cy="12" r="8.9" />;
  }
};

export const SeatGlyph: React.FC<{
  seat: number;
  size?: number;
  tone?: 'current' | 'cream' | 'gold';
  className?: string;
  title?: string;
}> = ({ seat, size = 12, tone = 'current', className = '', title }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={`seat-glyph seat-glyph-${tone} seat-glyph-${SEAT_SYMBOLS[((seat % 4) + 4) % 4]} ${className}`}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {title && <title>{title}</title>}
    <SeatSymbolShape seat={seat} />
  </svg>
);

export const SeatSymbolLabel: React.FC<{ seat: number }> = ({ seat }) => (
  <span className="sr-only">{`${['Circle', 'Triangle', 'Diamond', 'Square'][((seat % 4) + 4) % 4]} symbol`}</span>
);
