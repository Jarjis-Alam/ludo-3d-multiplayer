import React from 'react';

export interface PawnTokenProps {
  color: 'red' | 'green' | 'yellow' | 'blue';
  isLegal?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  size?: number;
  className?: string;
}

export const PawnDefs: React.FC = () => (
  <svg
    style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      {/* ==================== RED JEWEL ENAMEL ==================== */}
      <radialGradient id="pawnGradRedHead" cx="35%" cy="28%" r="65%">
        <stop offset="0%" stopColor="#ff758f" />
        <stop offset="35%" stopColor="#ef233c" />
        <stop offset="75%" stopColor="#b7094c" />
        <stop offset="100%" stopColor="#590d22" />
      </radialGradient>
      <linearGradient id="pawnGradRedBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff4d6d" />
        <stop offset="45%" stopColor="#d90429" />
        <stop offset="85%" stopColor="#9b111e" />
        <stop offset="100%" stopColor="#590d22" />
      </linearGradient>
      <radialGradient id="pawnGradRedBase" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#ff8fa3" />
        <stop offset="60%" stopColor="#d90429" />
        <stop offset="100%" stopColor="#480010" />
      </radialGradient>

      {/* ==================== GREEN JEWEL ENAMEL ==================== */}
      <radialGradient id="pawnGradGreenHead" cx="35%" cy="28%" r="65%">
        <stop offset="0%" stopColor="#95d5b2" />
        <stop offset="35%" stopColor="#00b464" />
        <stop offset="75%" stopColor="#00723a" />
        <stop offset="100%" stopColor="#012a14" />
      </radialGradient>
      <linearGradient id="pawnGradGreenBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#52b788" />
        <stop offset="45%" stopColor="#008a48" />
        <stop offset="85%" stopColor="#00572e" />
        <stop offset="100%" stopColor="#012a14" />
      </linearGradient>
      <radialGradient id="pawnGradGreenBase" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#74c69d" />
        <stop offset="60%" stopColor="#008a48" />
        <stop offset="100%" stopColor="#01200f" />
      </radialGradient>

      {/* ==================== YELLOW JEWEL ENAMEL ==================== */}
      <radialGradient id="pawnGradYellowHead" cx="35%" cy="28%" r="65%">
        <stop offset="0%" stopColor="#fff8e1" />
        <stop offset="35%" stopColor="#ffb703" />
        <stop offset="75%" stopColor="#fb8500" />
        <stop offset="100%" stopColor="#7a3200" />
      </radialGradient>
      <linearGradient id="pawnGradYellowBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffd166" />
        <stop offset="45%" stopColor="#fb8500" />
        <stop offset="85%" stopColor="#c55300" />
        <stop offset="100%" stopColor="#662200" />
      </linearGradient>
      <radialGradient id="pawnGradYellowBase" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#ffe49e" />
        <stop offset="60%" stopColor="#f77f00" />
        <stop offset="100%" stopColor="#572800" />
      </radialGradient>

      {/* ==================== BLUE JEWEL ENAMEL ==================== */}
      <radialGradient id="pawnGradBlueHead" cx="35%" cy="28%" r="65%">
        <stop offset="0%" stopColor="#ade8f4" />
        <stop offset="35%" stopColor="#0096c7" />
        <stop offset="75%" stopColor="#00509d" />
        <stop offset="100%" stopColor="#03045e" />
      </radialGradient>
      <linearGradient id="pawnGradBlueBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#48cae4" />
        <stop offset="45%" stopColor="#0077b6" />
        <stop offset="85%" stopColor="#023e8a" />
        <stop offset="100%" stopColor="#011638" />
      </linearGradient>
      <radialGradient id="pawnGradBlueBase" cx="50%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#90e0ef" />
        <stop offset="60%" stopColor="#0077b6" />
        <stop offset="100%" stopColor="#011638" />
      </radialGradient>

      {/* ==================== GOLD COLLAR & STAR ACCENTS ==================== */}
      <linearGradient id="pawnGoldCollar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffeaa7" />
        <stop offset="35%" stopColor="#d4af37" />
        <stop offset="70%" stopColor="#fffbeb" />
        <stop offset="100%" stopColor="#996515" />
      </linearGradient>

      <linearGradient id="starGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff275" />
        <stop offset="40%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>

      {/* Soft Contact Drop Shadow Filter */}
      <filter id="pawnDropShadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="2.2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>
  </svg>
);

const COLOR_MAP = {
  red: {
    head: 'url(#pawnGradRedHead)',
    body: 'url(#pawnGradRedBody)',
    base: 'url(#pawnGradRedBase)',
    baseHighlight: '#ff8fa3',
    stroke: '#590d22',
  },
  green: {
    head: 'url(#pawnGradGreenHead)',
    body: 'url(#pawnGradGreenBody)',
    base: 'url(#pawnGradGreenBase)',
    baseHighlight: '#74c69d',
    stroke: '#012a14',
  },
  yellow: {
    head: 'url(#pawnGradYellowHead)',
    body: 'url(#pawnGradYellowBody)',
    base: 'url(#pawnGradYellowBase)',
    baseHighlight: '#ffe49e',
    stroke: '#572800',
  },
  blue: {
    head: 'url(#pawnGradBlueHead)',
    body: 'url(#pawnGradBlueBody)',
    base: 'url(#pawnGradBlueBase)',
    baseHighlight: '#bde0fe',
    stroke: '#011638',
  },
};

export const PawnToken: React.FC<PawnTokenProps> = ({
  color,
  isLegal = false,
  onClick,
  title,
  size = 36,
  className = '',
}) => {
  const g = COLOR_MAP[color] || COLOR_MAP.red;

  return (
    <div
      className={`traditional-pawn-wrapper ${isLegal ? 'pawn-legal-pulse' : ''} ${className}`}
      onClick={onClick}
      title={title}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        cursor: isLegal ? 'pointer' : 'default',
      }}
    >
      <svg
        viewBox="0 0 44 48"
        width="100%"
        height="100%"
        className="traditional-pawn-svg"
        style={{ pointerEvents: 'none' }}
      >
        <g filter="url(#pawnDropShadow)">
          {/* Ground Contact Shadow */}
          <ellipse cx="22" cy="44" rx="14" ry="3.5" fill="rgba(0,0,0,0.32)" />

          {/* Broad Circular Pedestal Base (Bottom Tier) */}
          <path
            d="M 6 39.5 C 6 37, 11 35.5, 22 35.5 C 33 35.5, 38 37, 38 39.5 C 38 42.5, 33 44.5, 22 44.5 C 11 44.5, 6 42.5, 6 39.5 Z"
            fill={g.base}
            stroke={g.stroke}
            strokeWidth="0.8"
          />

          {/* Pedestal Upper Bevel Rim */}
          <ellipse
            cx="22"
            cy="38.5"
            rx="13.5"
            ry="3.2"
            fill={g.baseHighlight}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.7"
          />

          {/* Smooth Conical Bell Body */}
          <path
            d="M 12 38.5 C 14 30.5, 15.5 24.5, 16 20.5 L 28 20.5 C 28.5 24.5, 30 30.5, 32 38.5 C 29 40, 15 40, 12 38.5 Z"
            fill={g.body}
            stroke={g.stroke}
            strokeWidth="0.7"
          />

          {/* Body Curved Specular Gloss Highlight */}
          <path
            d="M 15 22.5 C 14 27.5, 13.8 33.5, 15 36.5"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.55"
            fill="none"
          />

          {/* Golden Collar Ring (Torus) */}
          <ellipse
            cx="22"
            cy="20.5"
            rx="6.8"
            ry="2.1"
            fill="url(#pawnGoldCollar)"
            stroke="#996515"
            strokeWidth="0.6"
          />

          {/* Collar Gilded Highlight */}
          <ellipse
            cx="20.5"
            cy="20"
            rx="3"
            ry="0.7"
            fill="#ffffff"
            opacity="0.8"
          />

          {/* Large Plump Spherical Crown Head (Diameter 18px!) */}
          <circle
            cx="22"
            cy="11.5"
            r="9"
            fill={g.head}
            stroke={g.stroke}
            strokeWidth="0.75"
          />

          {/* Glossy Lacquered Head Highlight (Crescent Specular Reflection) */}
          <ellipse
            cx="18.5"
            cy="8.2"
            rx="3.6"
            ry="2"
            transform="rotate(-25 18.5 8.2)"
            fill="#ffffff"
            opacity="0.85"
          />

          {/* Secondary Micro Specular Dot */}
          <circle
            cx="16.2"
            cy="11.2"
            r="1.2"
            fill="#ffffff"
            opacity="0.6"
          />
        </g>
      </svg>
    </div>
  );
};
