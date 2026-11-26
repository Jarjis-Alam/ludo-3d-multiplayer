import React from 'react';

export type PawnColor = 'red' | 'green' | 'yellow' | 'blue';

export interface PawnTokenProps {
  color: PawnColor;
  /** Optional explicit seat. Defaults from colour so every call site stays identity-correct. */
  seat?: number;
  /** Identifies the pawn on the board so the flight overlay can measure its cell-sized box. */
  tokenIndex?: number;
  isLegal?: boolean;
  isSelected?: boolean;
  isThreatened?: boolean;
  isFinished?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onActivate?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  title?: string;
  size?: number;
  /** Explicit box, used by the flight overlay to match the pawn's rendered size exactly. */
  width?: number;
  height?: number;
  className?: string;
}

export const PawnDefs: React.FC = () => (
  <svg
    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      {/* ==================== RUBY ==================== */}
      <radialGradient id="pawnV2RedHead" cx="34%" cy="24%" r="74%">
        <stop offset="0%" stopColor="#ff9d9d" />
        <stop offset="28%" stopColor="#f04a4a" />
        <stop offset="66%" stopColor="#d4232b" />
        <stop offset="92%" stopColor="#a4131b" />
        <stop offset="100%" stopColor="#7d0d14" />
      </radialGradient>
      <linearGradient id="pawnV2RedBody" x1="18%" y1="0%" x2="84%" y2="100%">
        <stop offset="0%" stopColor="#f96464" />
        <stop offset="32%" stopColor="#de2b31" />
        <stop offset="74%" stopColor="#b81b22" />
        <stop offset="100%" stopColor="#8f1118" />
      </linearGradient>
      <radialGradient id="pawnV2RedBase" cx="36%" cy="22%" r="82%">
        <stop offset="0%" stopColor="#ef5b5b" />
        <stop offset="55%" stopColor="#c81f27" />
        <stop offset="100%" stopColor="#96141b" />
      </radialGradient>

      {/* ==================== EMERALD ==================== */}
      <radialGradient id="pawnV2GreenHead" cx="34%" cy="24%" r="74%">
        <stop offset="0%" stopColor="#a8f5b4" />
        <stop offset="28%" stopColor="#46d264" />
        <stop offset="66%" stopColor="#1ca23a" />
        <stop offset="92%" stopColor="#0f7a28" />
        <stop offset="100%" stopColor="#0a5f1f" />
      </radialGradient>
      <linearGradient id="pawnV2GreenBody" x1="18%" y1="0%" x2="84%" y2="100%">
        <stop offset="0%" stopColor="#6fe287" />
        <stop offset="32%" stopColor="#27b944" />
        <stop offset="74%" stopColor="#178f31" />
        <stop offset="100%" stopColor="#0d6b24" />
      </linearGradient>
      <radialGradient id="pawnV2GreenBase" cx="36%" cy="22%" r="82%">
        <stop offset="0%" stopColor="#4ccf68" />
        <stop offset="55%" stopColor="#169b33" />
        <stop offset="100%" stopColor="#0b6c22" />
      </radialGradient>

      {/* ==================== AMBER ==================== */}
      <radialGradient id="pawnV2YellowHead" cx="34%" cy="24%" r="74%">
        <stop offset="0%" stopColor="#fff2b8" />
        <stop offset="28%" stopColor="#ffd447" />
        <stop offset="66%" stopColor="#f0ab0c" />
        <stop offset="92%" stopColor="#c27f04" />
        <stop offset="100%" stopColor="#966003" />
      </radialGradient>
      <linearGradient id="pawnV2YellowBody" x1="18%" y1="0%" x2="84%" y2="100%">
        <stop offset="0%" stopColor="#ffe37a" />
        <stop offset="32%" stopColor="#f5bd14" />
        <stop offset="74%" stopColor="#d39306" />
        <stop offset="100%" stopColor="#a66f03" />
      </linearGradient>
      <radialGradient id="pawnV2YellowBase" cx="36%" cy="22%" r="82%">
        <stop offset="0%" stopColor="#ffd24d" />
        <stop offset="55%" stopColor="#e0a10a" />
        <stop offset="100%" stopColor="#9c6702" />
      </radialGradient>

      {/* ==================== SAPPHIRE ==================== */}
      <radialGradient id="pawnV2BlueHead" cx="34%" cy="24%" r="74%">
        <stop offset="0%" stopColor="#a6d8ff" />
        <stop offset="28%" stopColor="#4c9df0" />
        <stop offset="66%" stopColor="#1668c8" />
        <stop offset="92%" stopColor="#0a4a99" />
        <stop offset="100%" stopColor="#053a78" />
      </radialGradient>
      <linearGradient id="pawnV2BlueBody" x1="18%" y1="0%" x2="84%" y2="100%">
        <stop offset="0%" stopColor="#77bdff" />
        <stop offset="32%" stopColor="#2183e2" />
        <stop offset="74%" stopColor="#0f5cad" />
        <stop offset="100%" stopColor="#084283" />
      </linearGradient>
      <radialGradient id="pawnV2BlueBase" cx="36%" cy="22%" r="82%">
        <stop offset="0%" stopColor="#4aa3ef" />
        <stop offset="55%" stopColor="#1066bd" />
        <stop offset="100%" stopColor="#064478" />
      </radialGradient>

      {/* ==================== SHARED CREAM BAND ==================== */}
      <linearGradient id="pawnV2Cream" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fffdf5" />
        <stop offset="100%" stopColor="#ecdcb6" />
      </linearGradient>

      <filter id="pawnV2Shadow" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="1.4" stdDeviation="0.9" floodColor="#000000" floodOpacity="0.45" />
      </filter>
      <filter id="pawnV2Glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#FFC83D" floodOpacity="0.95" />
      </filter>
    </defs>
  </svg>
);

const COLOR_MAP: Record<
  PawnColor,
  { head: string; body: string; base: string; stroke: string; rim: string }
> = {
  red: {
    head: 'url(#pawnV2RedHead)',
    body: 'url(#pawnV2RedBody)',
    base: 'url(#pawnV2RedBase)',
    stroke: '#6f0b11',
    rim: '#ffd0d0',
  },
  green: {
    head: 'url(#pawnV2GreenHead)',
    body: 'url(#pawnV2GreenBody)',
    base: 'url(#pawnV2GreenBase)',
    stroke: '#08511a',
    rim: '#d4fbe0',
  },
  yellow: {
    head: 'url(#pawnV2YellowHead)',
    body: 'url(#pawnV2YellowBody)',
    base: 'url(#pawnV2YellowBase)',
    stroke: '#7a4c02',
    rim: '#fff6cf',
  },
  blue: {
    head: 'url(#pawnV2BlueHead)',
    body: 'url(#pawnV2BlueBody)',
    base: 'url(#pawnV2BlueBase)',
    stroke: '#043362',
    rim: '#d6ecff',
  },
};

/**
 * Glossy cast pawn: a round lacquered head on a flared body with a cream band
 * around the skirt, matching the reference art. Seat identity is carried by the
 * pawn colour alone, so nothing is drawn on top of the gloss.
 */
export const PawnToken: React.FC<PawnTokenProps> = ({
  color,
  seat,
  tokenIndex,
  isLegal = false,
  isSelected = false,
  isThreatened = false,
  isFinished = false,
  onClick,
  onActivate,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  title,
  size = 36,
  width,
  height,
  className = '',
}) => {
  const g = COLOR_MAP[color] || COLOR_MAP.red;

  const classes = [
    'traditional-pawn-wrapper',
    'pawn-token',
    isLegal ? 'pawn-legal-pulse is-selectable' : '',
    isSelected ? 'pawn-selected' : '',
    isThreatened ? 'pawn-threatened' : '',
    isFinished ? 'pawn-finished' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleActivate = (e: React.MouseEvent) => {
    if (!isLegal) return;
    onClick?.(e);
  };

  return (
    <div
      className={classes}
      onClick={handleActivate}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (!isLegal) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (onActivate) onActivate();
          else onClick?.({ stopPropagation: () => undefined } as unknown as React.MouseEvent);
        }
      }}
      role={isLegal ? 'button' : undefined}
      tabIndex={isLegal ? 0 : undefined}
      aria-label={title}
      title={title}
      data-pawn={tokenIndex !== undefined && seat !== undefined ? `${seat}-${tokenIndex}` : undefined}
      style={{
        width: `${width ?? size}px`,
        height: `${height ?? size}px`,
      }}
    >
      <svg
        viewBox="0 0 40 54"
        width="100%"
        height="100%"
        className="traditional-pawn-svg pawn-v2-svg"
        style={{ pointerEvents: 'none', overflow: 'visible' }}
        aria-hidden="true"
      >
        <g filter="url(#pawnV2Shadow)">
          {/* Soft contact shadow on the tile */}
          <ellipse cx="20" cy="49.4" rx="13.6" ry="3.1" fill="rgba(6, 3, 16, 0.22)" />

          {/* Rounded plinth */}
          <ellipse cx="20" cy="44.6" rx="15.6" ry="5.7" fill={g.base} stroke={g.stroke} strokeWidth="1.5" />
          <path
            d="M5.6 43.9c3.9 1.7 24.9 1.7 28.8 0"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
          />

          {/* Flared body */}
          <path
            d="M20 22.6c-3.6 0-6.7 5-8.4 12.4-.9 3.9-1.4 7-1.1 8.5 5.8 2.4 13.2 2.4 19 0 .3-1.5-.2-4.6-1.1-8.5-1.7-7.4-4.8-12.4-8.4-12.4Z"
            fill={g.body}
            stroke={g.stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />

          {/* Cream band around the skirt */}
          <path
            d="M11.4 37.2c5.1 2.2 12.1 2.2 17.2 0l.5 4.2c-5.9 2.6-12.3 2.6-18.2 0Z"
            fill="url(#pawnV2Cream)"
            stroke={g.stroke}
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M11.8 38.3c4.9 2 11.5 2 16.4 0"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.9"
            strokeLinecap="round"
            fill="none"
          />

          {/* Vertical gloss running down the body */}
          <path
            d="M15.4 27.4c-1.7 4-2.8 7.7-3.4 10.4"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Lacquered head */}
          <circle cx="20" cy="14" r="11.2" fill={g.head} stroke={g.stroke} strokeWidth="1.6" />
          <ellipse
            cx="15.6"
            cy="9.2"
            rx="4.4"
            ry="2.8"
            transform="rotate(-30 15.6 9.2)"
            fill="#ffffff"
            opacity="0.8"
          />
          <circle cx="13.9" cy="15" r="1.3" fill="#ffffff" opacity="0.42" />
          <path
            d="M11.2 20.4c1.4 3.5 4.1 5.7 7.6 6.4"
            stroke={g.rim}
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.28"
          />
        </g>
      </svg>
    </div>
  );
};
