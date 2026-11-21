import React, { useEffect, useState } from 'react';
import { AudioEngine } from './AudioEngine';

interface DiceRollerProps {
  value: number | null;
  activeDice?: number | null;
  rolling: boolean;
  canRoll: boolean;
  isMyTurn?: boolean;
  onRoll: () => void;
  playerColor?: string;
  playerName?: string;
  timeLeft?: number; // 0 to 15 seconds
  maxTime?: number;
}

export const PIP_COORDINATES: Record<number, Array<[number, number]>> = {
  1: [[32, 32]],
  2: [
    [20, 20],
    [44, 44],
  ],
  3: [
    [20, 20],
    [32, 32],
    [44, 44],
  ],
  4: [
    [20, 20],
    [44, 20],
    [20, 44],
    [44, 44],
  ],
  5: [
    [20, 20],
    [44, 20],
    [32, 32],
    [20, 44],
    [44, 44],
  ],
  6: [
    [20, 18],
    [44, 18],
    [20, 32],
    [44, 32],
    [20, 46],
    [44, 46],
  ],
};

/**
 * 3D Tactile Ivory Vector Dice Face with soft cream body, rounded bevels, and crisp black pips.
 * Exactly matches the elevated central dice in the master reference screenshot.
 */
export const DiceFaceSVG: React.FC<{
  value: number;
  size?: number;
}> = ({ value = 6, size = 64 }) => {
  const val = Math.max(1, Math.min(6, value || 6));
  const coords = PIP_COORDINATES[val] || PIP_COORDINATES[6];

  const pipFill = '#1a1528';
  const pipRadius = val === 1 ? 7.2 : val === 6 ? 5.2 : 5.6;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="dice-svg-face"
      aria-label={`Dice ${val}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* Soft warm ivory/cream gradient body */}
        <linearGradient id="masterDiceBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="45%" stopColor="#FFF4E0" />
          <stop offset="100%" stopColor="#F7E2C3" />
        </linearGradient>

        {/* Ambient base drop shadow for dice depth */}
        <filter id="diceDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0d091e" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Main Beveled Body with Soft Rounded Corners */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        ry="14"
        fill="url(#masterDiceBody)"
        stroke="#E2C7A3"
        strokeWidth="1.6"
      />

      {/* Specular Inner Glint Highlight Ring */}
      <rect
        x="4.5"
        y="4.5"
        width="55"
        height="55"
        rx="12"
        ry="12"
        fill="none"
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth="1.2"
      />

      {/* Crisp Solid Black Pips with Specular Glints */}
      {coords.map(([cx, cy], i) => (
        <g key={i}>
          {/* Contact Depth Shadow */}
          <circle cx={cx} cy={cy + 1} r={pipRadius} fill="rgba(0, 0, 0, 0.25)" />
          {/* Main Pip */}
          <circle cx={cx} cy={cy} r={pipRadius} fill={pipFill} />
          {/* Specular Glint */}
          <circle
            cx={cx - pipRadius * 0.3}
            cy={cy - pipRadius * 0.3}
            r={pipRadius * 0.3}
            fill="#ffffff"
            opacity="0.8"
          />
        </g>
      ))}
    </svg>
  );
};

export const MiniDiceCube: React.FC<{ value: number }> = ({ value }) => {
  const displayVal = Math.max(1, Math.min(6, value || 6));
  return (
    <div className="mini-dice-cube relative">
      <DiceFaceSVG value={displayVal} size={38} />
      <div className="dice-corner-badge mini">
        {displayVal}
      </div>
    </div>
  );
};

/**
 * Desktop & Tablet Royal Dice Tray component featuring elevated violet stage,
 * tactile ivory dice, and golden-yellow primary action button.
 */
export const DiceRoller: React.FC<DiceRollerProps> = ({
  value,
  activeDice,
  rolling,
  canRoll,
  isMyTurn = false,
  onRoll,
  playerColor = 'gold',
  playerName,
  timeLeft = 15,
  maxTime = 15,
}) => {
  const [displayVal, setDisplayVal] = useState<number>(value || 6);

  useEffect(() => {
    if (rolling) {
      AudioEngine.playDiceRoll();
      const interval = setInterval(() => {
        setDisplayVal(Math.floor(Math.random() * 6) + 1);
      }, 50);
      return () => clearInterval(interval);
    } else if (typeof value === 'number' && value >= 1 && value <= 6) {
      setDisplayVal(value);
    }
  }, [rolling, value]);

  const isUrgent = timeLeft <= 5 && timeLeft > 0;

  return (
    <div className="dice-roller-container select-none">
      {/* Elevated Violet Stage Mound */}
      <div className={`dice-elevated-stage ${canRoll ? 'stage-active-turn' : ''}`}>
        {/* Playful Action Sparkle Rays around the dice */}
        <div className="dice-action-sparkles" aria-hidden="true">
          <span className="sparkle-ray ray-1" />
          <span className="sparkle-ray ray-2" />
          <span className="sparkle-ray ray-3" />
        </div>

        {/* Tactile Ivory Dice Button */}
        <button
          type="button"
          className={`dice-cube-btn relative ${rolling ? 'rolling-tumbling' : ''} ${canRoll ? 'can-roll-pulse' : 'disabled'
            }`}
          onClick={() => {
            if (canRoll && !rolling) onRoll();
          }}
          disabled={!canRoll || rolling}
          title={canRoll ? 'Tap to roll the dice' : `Dice value: ${displayVal}`}
          aria-label={canRoll ? 'Roll dice' : `Dice value ${displayVal}`}
        >
          <span className="dice-face-settle" key={`face-${displayVal}-${rolling ? 'roll' : 'idle'}`}>
            <DiceFaceSVG value={displayVal} size={64} />
          </span>
          <div className="dice-corner-badge" key={`badge-${displayVal}`}>
            {displayVal}
          </div>
        </button>
      </div>

      {/* Prominent Golden-Yellow Roll Action Button */}
      <div className="dice-action-button-area">
        <button
          type="button"
          className={`primary-game-btn roll-primary-btn ${canRoll ? 'btn-active' : 'btn-disabled'} ${isUrgent && canRoll ? 'btn-urgent-pulse' : ''
            }`}
          onClick={() => {
            if (canRoll && !rolling) onRoll();
          }}
          disabled={!canRoll || rolling}
        >
          {rolling ? (
            <span className="animate-pulse">🎲 ROLLING…</span>
          ) : canRoll ? (
            <span>🎲 TAP TO ROLL</span>
          ) : isMyTurn && activeDice !== null ? (
            <span>👉 CHOOSE A PAWN ({activeDice})</span>
          ) : (
            <span>⏳ WAITING FOR {playerName?.toUpperCase() || 'PLAYER'}</span>
          )}
        </button>
      </div>

      {/* Contextual Sub-Callout */}
      <div className="dice-rolled-callout">
        {value !== null ? (
          <span className="dice-rolled-desc">
            {displayVal === 6
              ? '🎉 ROLLED A 6 (EXTRA TURN AWARDED!)'
              : activeDice !== null && isMyTurn
                ? `ROLLED ${displayVal} • SELECT GLOWING PAWN`
                : activeDice !== null && playerName
                  ? `${playerName.toUpperCase()} ROLLED ${displayVal}`
                  : `LAST ROLL: ${displayVal}`}
          </span>
        ) : (
          <span className="dice-rolled-desc">
            {canRoll ? 'YOUR TURN • TAP TO ROLL' : `WAITING FOR TURN (${timeLeft}s)`}
          </span>
        )}
      </div>
    </div>
  );
};
