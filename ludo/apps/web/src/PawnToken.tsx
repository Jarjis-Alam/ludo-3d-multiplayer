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
      {/* Red Gradients */}
      <radialGradient id="pawnGradRedHead" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#fca5a5" />
        <stop offset="45%" stopColor="#e63946" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </radialGradient>
      <linearGradient id="pawnGradRedBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="50%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#991b1b" />
      </linearGradient>
      <radialGradient id="pawnGradRedBase" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#f87171" />
        <stop offset="70%" stopColor="#b91c1c" />
        <stop offset="100%" stopColor="#450a0a" />
      </radialGradient>

      {/* Green Gradients */}
      <radialGradient id="pawnGradGreenHead" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#86efac" />
        <stop offset="45%" stopColor="#059669" />
        <stop offset="100%" stopColor="#064e3b" />
      </radialGradient>
      <linearGradient id="pawnGradGreenBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="50%" stopColor="#059669" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <radialGradient id="pawnGradGreenBase" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="70%" stopColor="#047857" />
        <stop offset="100%" stopColor="#022c22" />
      </radialGradient>

      {/* Yellow Gradients */}
      <radialGradient id="pawnGradYellowHead" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#92400e" />
      </radialGradient>
      <linearGradient id="pawnGradYellowBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <radialGradient id="pawnGradYellowBase" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="70%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#451a03" />
      </radialGradient>

      {/* Blue Gradients */}
      <radialGradient id="pawnGradBlueHead" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#93c5fd" />
        <stop offset="45%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </radialGradient>
      <linearGradient id="pawnGradBlueBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="50%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <radialGradient id="pawnGradBlueBase" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="70%" stopColor="#1d4ed8" />
        <stop offset="100%" stopColor="#0f172a" />
      </radialGradient>

      {/* Gold Collar and Star Gradients */}
      <linearGradient id="pawnGoldCollar" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#d4af37" />
        <stop offset="50%" stopColor="#fffbeb" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>

      <linearGradient id="starGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>

      {/* Drop Shadow Filter */}
      <filter id="pawnDropShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.6" />
      </filter>
    </defs>
  </svg>
);

const COLOR_MAP = {
  red: {
    head: 'url(#pawnGradRedHead)',
    body: 'url(#pawnGradRedBody)',
    base: 'url(#pawnGradRedBase)',
    stroke: '#7f1d1d',
    highlight: '#fca5a5',
  },
  green: {
    head: 'url(#pawnGradGreenHead)',
    body: 'url(#pawnGradGreenBody)',
    base: 'url(#pawnGradGreenBase)',
    stroke: '#064e3b',
    highlight: '#86efac',
  },
  yellow: {
    head: 'url(#pawnGradYellowHead)',
    body: 'url(#pawnGradYellowBody)',
    base: 'url(#pawnGradYellowBase)',
    stroke: '#78350f',
    highlight: '#fef08a',
  },
  blue: {
    head: 'url(#pawnGradBlueHead)',
    body: 'url(#pawnGradBlueBody)',
    base: 'url(#pawnGradBlueBase)',
    stroke: '#1e3a8a',
    highlight: '#93c5fd',
  },
};

export const PawnToken: React.FC<PawnTokenProps> = ({
  color,
  isLegal = false,
  onClick,
  title,
  size = 32,
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
        viewBox="0 0 32 32"
        width="100%"
        height="100%"
        className="traditional-pawn-svg"
      >
        <g filter="url(#pawnDropShadow)">
          {/* Base shadow disc */}
          <ellipse cx="16" cy="27" rx="8.5" ry="3.2" fill="rgba(0,0,0,0.4)" />

          {/* Weighted Pedestal Base */}
          <path
            d="M 7 25 C 7 22.8, 9.5 21.2, 16 21.2 C 22.5 21.2, 25 22.8, 25 25 C 25 27.2, 22 28.5, 16 28.5 C 10 28.5, 7 27.2, 7 25 Z"
            fill={g.base}
            stroke="#d4af37"
            strokeWidth="0.8"
          />

          {/* Bell-shaped Body */}
          <path
            d="M 10 22.5 C 10.5 17.5, 12.5 15, 12.5 13.5 L 19.5 13.5 C 19.5 15, 21.5 17.5, 22 22.5 Z"
            fill={g.body}
            stroke={g.stroke}
            strokeWidth="0.6"
          />

          {/* Golden Collar Ring */}
          <ellipse
            cx="16"
            cy="13.5"
            rx="4.5"
            ry="1.4"
            fill="url(#pawnGoldCollar)"
            stroke="#996515"
            strokeWidth="0.5"
          />

          {/* Spherical Crown Head */}
          <circle
            cx="16"
            cy="8.5"
            r="4.8"
            fill={g.head}
            stroke="#d4af37"
            strokeWidth="0.75"
          />

          {/* Specular Glaze Highlight */}
          <ellipse
            cx="14.3"
            cy="6.8"
            rx="1.6"
            ry="1"
            fill="#ffffff"
            opacity="0.8"
          />
        </g>
      </svg>
    </div>
  );
};
