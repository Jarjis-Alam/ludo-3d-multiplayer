import React from 'react';
import { SeatSymbolShape } from './SeatGlyph';

export type PawnColor = 'red' | 'green' | 'yellow' | 'blue';

export interface PawnTokenProps {
  color: PawnColor;
  /** Optional explicit seat. Defaults from colour so every call site stays identity-correct. */
  seat?: number;
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
  className?: string;
}

const COLOR_SEAT: Record<PawnColor, number> = { red: 0, green: 1, yellow: 2, blue: 3 };

export const PawnDefs: React.FC = () => (
  <svg
    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      {/* ==================== RUBY ENAMEL ==================== */}
      <radialGradient id="pawnV2RedHead" cx="34%" cy="26%" r="72%">
        <stop offset="0%" stopColor="#ffb3be" />
        <stop offset="24%" stopColor="#f0435a" />
        <stop offset="62%" stopColor="#c1122f" />
        <stop offset="88%" stopColor="#7a0b22" />
        <stop offset="100%" stopColor="#4a0212" />
      </radialGradient>
      <linearGradient id="pawnV2RedBody" x1="22%" y1="0%" x2="86%" y2="100%">
        <stop offset="0%" stopColor="#ff7186" />
        <stop offset="30%" stopColor="#dc1f3c" />
        <stop offset="72%" stopColor="#a30f28" />
        <stop offset="100%" stopColor="#5c0417" />
      </linearGradient>
      <radialGradient id="pawnV2RedBase" cx="40%" cy="24%" r="80%">
        <stop offset="0%" stopColor="#ff8b9b" />
        <stop offset="52%" stopColor="#c1122f" />
        <stop offset="100%" stopColor="#46000f" />
      </radialGradient>

      {/* ==================== EMERALD ENAMEL ==================== */}
      <radialGradient id="pawnV2GreenHead" cx="34%" cy="26%" r="72%">
        <stop offset="0%" stopColor="#b6f0cc" />
        <stop offset="24%" stopColor="#2ecb7f" />
        <stop offset="62%" stopColor="#0d9455" />
        <stop offset="88%" stopColor="#056137" />
        <stop offset="100%" stopColor="#01301b" />
      </radialGradient>
      <linearGradient id="pawnV2GreenBody" x1="22%" y1="0%" x2="86%" y2="100%">
        <stop offset="0%" stopColor="#63dda0" />
        <stop offset="30%" stopColor="#13b56b" />
        <stop offset="72%" stopColor="#088049" />
        <stop offset="100%" stopColor="#024526" />
      </linearGradient>
      <radialGradient id="pawnV2GreenBase" cx="40%" cy="24%" r="80%">
        <stop offset="0%" stopColor="#8ce8b6" />
        <stop offset="52%" stopColor="#0d9455" />
        <stop offset="100%" stopColor="#01301b" />
      </radialGradient>

      {/* ==================== AMBER ENAMEL ==================== */}
      <radialGradient id="pawnV2YellowHead" cx="34%" cy="26%" r="72%">
        <stop offset="0%" stopColor="#fff6d0" />
        <stop offset="24%" stopColor="#ffcf4a" />
        <stop offset="62%" stopColor="#f59a0b" />
        <stop offset="88%" stopColor="#c26905" />
        <stop offset="100%" stopColor="#6f3900" />
      </radialGradient>
      <linearGradient id="pawnV2YellowBody" x1="22%" y1="0%" x2="86%" y2="100%">
        <stop offset="0%" stopColor="#ffe291" />
        <stop offset="30%" stopColor="#fdb515" />
        <stop offset="72%" stopColor="#d17c05" />
        <stop offset="100%" stopColor="#7a4100" />
      </linearGradient>
      <radialGradient id="pawnV2YellowBase" cx="40%" cy="24%" r="80%">
        <stop offset="0%" stopColor="#ffebae" />
        <stop offset="52%" stopColor="#f59a0b" />
        <stop offset="100%" stopColor="#6f3900" />
      </radialGradient>

      {/* ==================== SAPPHIRE ENAMEL ==================== */}
      <radialGradient id="pawnV2BlueHead" cx="34%" cy="26%" r="72%">
        <stop offset="0%" stopColor="#c6e9ff" />
        <stop offset="24%" stopColor="#4da3f5" />
        <stop offset="62%" stopColor="#1f63c9" />
        <stop offset="88%" stopColor="#123e8a" />
        <stop offset="100%" stopColor="#061a44" />
      </radialGradient>
      <linearGradient id="pawnV2BlueBody" x1="22%" y1="0%" x2="86%" y2="100%">
        <stop offset="0%" stopColor="#8bc8ff" />
        <stop offset="30%" stopColor="#2b7fe0" />
        <stop offset="72%" stopColor="#174c9f" />
        <stop offset="100%" stopColor="#072354" />
      </linearGradient>
      <radialGradient id="pawnV2BlueBase" cx="40%" cy="24%" r="80%">
        <stop offset="0%" stopColor="#a9d8ff" />
        <stop offset="52%" stopColor="#1f63c9" />
        <stop offset="100%" stopColor="#061a44" />
      </radialGradient>

      {/* ==================== SHARED BRASS & LACQUER ==================== */}
      <linearGradient id="pawnV2Gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff3c4" />
        <stop offset="32%" stopColor="#e3bd57" />
        <stop offset="58%" stopColor="#b8892c" />
        <stop offset="78%" stopColor="#ffe9a3" />
        <stop offset="100%" stopColor="#8a621b" />
      </linearGradient>
      <linearGradient id="pawnV2GoldSoft" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#f9e7b0" />
        <stop offset="45%" stopColor="#dcae45" />
        <stop offset="100%" stopColor="#96671c" />
      </linearGradient>
      <linearGradient id="starGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff275" />
        <stop offset="40%" stopColor="#f5a30b" />
        <stop offset="70%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>

      <filter id="pawnV2Shadow" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.5" />
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
    stroke: '#4a0212',
    rim: '#ffb3be',
  },
  green: {
    head: 'url(#pawnV2GreenHead)',
    body: 'url(#pawnV2GreenBody)',
    base: 'url(#pawnV2GreenBase)',
    stroke: '#01301b',
    rim: '#b6f0cc',
  },
  yellow: {
    head: 'url(#pawnV2YellowHead)',
    body: 'url(#pawnV2YellowBody)',
    base: 'url(#pawnV2YellowBase)',
    stroke: '#6f3900',
    rim: '#fff6d0',
  },
  blue: {
    head: 'url(#pawnV2BlueHead)',
    body: 'url(#pawnV2BlueBody)',
    base: 'url(#pawnV2BlueBase)',
    stroke: '#061a44',
    rim: '#c6e9ff',
  },
};

export const PawnToken: React.FC<PawnTokenProps> = ({
  color,
  seat,
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
  className = '',
}) => {
  const g = COLOR_MAP[color] || COLOR_MAP.red;
  const seatIndex = seat ?? COLOR_SEAT[color] ?? 0;

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
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <svg
        viewBox="4 1 40 54"
        width="100%"
        height="100%"
        className="traditional-pawn-svg pawn-v2-svg"
        style={{ pointerEvents: 'none', overflow: 'visible' }}
        aria-hidden="true"
      >
        <g filter="url(#pawnV2Shadow)">
          {/* Contact shadow */}
          <ellipse cx="24" cy="51.4" rx="15" ry="3.4" fill="rgba(8, 4, 18, 0.38)" />

          {/* Turned pedestal — lower plinth */}
          <path
            d="M6.6 46.4c0-3 7.8-5 17.4-5s17.4 2 17.4 5-7.8 5.1-17.4 5.1S6.6 49.4 6.6 46.4Z"
            fill={g.stroke}
            opacity="0.85"
          />
          <path
            d="M8 45.6c0-2.6 7.2-4.5 16-4.5s16 1.9 16 4.5-7.2 4.6-16 4.6S8 48.2 8 45.6Z"
            fill={g.base}
            stroke={g.stroke}
            strokeWidth="0.7"
          />
          <ellipse cx="24" cy="43.9" rx="15.2" ry="4.1" fill={g.base} stroke="rgba(255,255,255,0.28)" strokeWidth="0.7" />
          <ellipse cx="24" cy="42.9" rx="11.6" ry="2.7" fill="rgba(255,255,255,0.18)" />

          {/* Slim turned stem */}
          <path
            d="M15.9 43.4c1.2-4.4 2.3-7.4 2.9-10.2h10.4c.6 2.8 1.7 5.8 2.9 10.2-5.2 1.4-11 1.4-16.2 0Z"
            fill={g.body}
            stroke={g.stroke}
            strokeWidth="0.7"
          />
          <path
            d="M18.7 35.4c-.5 2.4-1.2 4.8-2 7.1"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M30.2 35.2c.5 2.6 1.1 4.9 1.9 7.4"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />

          {/* Brass collar */}
          <ellipse cx="24" cy="32.7" rx="8.4" ry="2.5" fill="url(#pawnV2Gold)" stroke="#7c5514" strokeWidth="0.55" />
          <ellipse cx="24" cy="31.9" rx="6.3" ry="1.35" fill="url(#pawnV2GoldSoft)" opacity="0.95" />
          <ellipse cx="21.3" cy="31.5" rx="2.3" ry="0.5" fill="#fffdf0" opacity="0.85" />

          {/* Sculpted crown head */}
          <circle cx="24" cy="19.2" r="11.1" fill={g.head} stroke={g.stroke} strokeWidth="0.8" />
          <path
            d="M13.6 17.4c1.5-5.4 5.4-8.9 10.4-8.9"
            stroke={g.rim}
            strokeWidth="1.35"
            strokeLinecap="round"
            opacity="0.55"
            fill="none"
          />
          <ellipse
            cx="20"
            cy="14.6"
            rx="3.9"
            ry="2.3"
            transform="rotate(-27 20 14.6)"
            fill="#ffffff"
            opacity="0.72"
          />
          <circle cx="17.4" cy="18.4" r="1.25" fill="#ffffff" opacity="0.5" />

          {/* Seat identity medallion on the crown */}
          <circle cx="24" cy="20.2" r="4.9" fill="rgba(18, 8, 28, 0.22)" />
          <g
            transform="translate(24 20.2) scale(0.56) translate(-12 -12)"
            fill="#fffdf6"
            opacity="1"
          >
            <SeatSymbolShape seat={seatIndex} />
          </g>

          {/* Lacquer rim light on the base top edge */}
          <path
            d="M9.4 43.4c4.2 1.6 25 1.6 29.2 0"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
};
