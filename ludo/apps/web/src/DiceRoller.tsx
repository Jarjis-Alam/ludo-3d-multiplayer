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
    [19, 19],
    [45, 45],
  ],
  3: [
    [19, 19],
    [32, 32],
    [45, 45],
  ],
  4: [
    [19, 19],
    [45, 19],
    [19, 45],
    [45, 45],
  ],
  5: [
    [19, 19],
    [45, 19],
    [32, 32],
    [19, 45],
    [45, 45],
  ],
  6: [
    [19, 17],
    [45, 17],
    [19, 32],
    [45, 32],
    [19, 47],
    [45, 47],
  ],
};

/**
 * Self-contained vector SVG Dice Face with 3D enamel body and bold, glossy, high-contrast pips.
 * Guaranteed to render with zero CSS dependency bugs across all browsers and devices.
 */
export const DiceFaceSVG: React.FC<{
  value: number;
  size?: number;
}> = ({ value = 6, size = 54 }) => {
  const val = Math.max(1, Math.min(6, value || 6));
  const coords = PIP_COORDINATES[val] || PIP_COORDINATES[6];
  const isSix = val === 6;
  const isOne = val === 1;

  const pipFill = isSix ? '#dc2626' : isOne ? '#d97706' : '#0f172a';
  const pipStroke = isSix ? '#7f1d1d' : isOne ? '#78350f' : '#020617';
  const pipRadius = isOne ? 7.5 : isSix ? 5.4 : 5.8;

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
        <linearGradient id="diceFaceBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
      </defs>

      {/* Main 3D Beveled Body */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="12"
        ry="12"
        fill="url(#diceFaceBodyGrad)"
        stroke="#d4af37"
        strokeWidth="1.8"
      />

      {/* Inner Specular Highlight Edge */}
      <rect
        x="4.5"
        y="4.5"
        width="55"
        height="55"
        rx="10.5"
        ry="10.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth="1.2"
      />

      {/* Solid High-Contrast 3D Pips */}
      {coords.map(([cx, cy], i) => (
        <g key={i}>
          {/* Subtle contact depth shadow */}
          <circle cx={cx} cy={cy + 1.2} r={pipRadius} fill="rgba(0, 0, 0, 0.35)" />
          {/* Main saturated pip body */}
          <circle
            cx={cx}
            cy={cy}
            r={pipRadius}
            fill={pipFill}
            stroke={pipStroke}
            strokeWidth="0.8"
          />
          {/* Specular Glint Highlight */}
          <circle
            cx={cx - pipRadius * 0.32}
            cy={cy - pipRadius * 0.32}
            r={pipRadius * 0.3}
            fill="#ffffff"
            opacity="0.85"
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
      <DiceFaceSVG value={displayVal} size={36} />
      <div className={`dice-corner-badge mini ${displayVal === 6 ? 'badge-six' : ''}`}>
        {displayVal}
      </div>
    </div>
  );
};

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

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / maxTime) * 100));
  const strokeDashoffset = 100 - progressPercent;
  const isUrgent = timeLeft <= 5 && timeLeft > 0;
  const showTimer = (canRoll || (isMyTurn && activeDice !== null)) && timeLeft > 0;

  return (
    <div className="dice-roller-container select-none">
      <div
        className={`dice-tray-wrapper ${canRoll ? 'tray-active-glow' : ''} ${
          isUrgent ? 'tray-urgent-border' : ''
        }`}
      >
        {/* Turn Countdown SVG Ring */}
        {showTimer && (
          <svg className={`dice-timer-svg ${isUrgent ? 'timer-urgent-pulse' : ''}`} viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(212, 175, 55, 0.2)'}
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={isUrgent ? '#ef4444' : '#f59e0b'}
              strokeWidth="4"
              strokeDasharray="289"
              strokeDashoffset={2.89 * strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
        )}

        {/* 3D Tactile Dice Button with Floating High-Contrast Gold Number Badge */}
        <button
          type="button"
          className={`dice-cube-btn relative ${rolling ? 'rolling-tumbling' : ''} ${
            canRoll ? 'can-roll-pulse' : 'disabled'
          }`}
          onClick={() => {
            if (canRoll && !rolling) onRoll();
          }}
          disabled={!canRoll || rolling}
          title={canRoll ? 'Tap to roll the dice' : `Dice value: ${displayVal}`}
          aria-label={canRoll ? 'Roll dice' : `Dice value ${displayVal}`}
        >
          <DiceFaceSVG value={displayVal} size={54} />
          {/* Floating High-Contrast Gold Number Badge */}
          <div className={`dice-corner-badge ${displayVal === 6 ? 'badge-six' : ''}`}>
            {displayVal}
          </div>
        </button>
      </div>

      {/* Prominent Rolled Number Display Callout */}
      <div className="dice-rolled-callout">
        {value !== null ? (
          <>
            <span className="dice-rolled-number">🎲 {displayVal}</span>
            <span className="dice-rolled-desc">
              {displayVal === 6
                ? 'ROLLED 6 (EXTRA TURN!)'
                : activeDice !== null && isMyTurn
                ? `ROLLED ${displayVal} • SELECT PAWN`
                : activeDice !== null && playerName
                ? `${playerName.toUpperCase()} ROLLED ${displayVal}`
                : `LAST ROLL: ${displayVal}`}
            </span>
          </>
        ) : (
          <>
            <span className="dice-rolled-number">🎲</span>
            <span className="dice-rolled-desc">
              {canRoll
                ? 'YOUR TURN • TAP TO ROLL'
                : playerName
                ? `${playerName.toUpperCase()}'S TURN TO ROLL`
                : 'AWAITING FIRST ROLL'}
            </span>
          </>
        )}
      </div>

      {/* Clear Action Button / Waiting Feedback */}
      {canRoll ? (
        <button
          type="button"
          className={`roll-action-pill ${isUrgent ? 'roll-urgent-pulse' : ''}`}
          onClick={onRoll}
          disabled={rolling}
        >
          {rolling ? (
            <span className="animate-pulse">ROLLING…</span>
          ) : (
            <span>TAP TO ROLL {isUrgent ? `(${timeLeft}s)` : ''}</span>
          )}
        </button>
      ) : isMyTurn && activeDice !== null ? (
        <div className="flex flex-col items-center gap-1.5 mt-1">
          <div
            className={`dice-waiting-badge ${
              isUrgent
                ? 'text-red-400 border-red-500/60 bg-red-950/40'
                : 'text-amber-300 border-amber-400/50 bg-amber-500/10'
            } font-bold`}
          >
            👉 Tap glowing pawn on board {isUrgent ? `(${timeLeft}s)` : ''}
          </div>
        </div>
      ) : (
        <div className="dice-waiting-badge mt-1">
          {playerName ? `Waiting for ${playerName}… (${timeLeft}s)` : 'Awaiting turn…'}
        </div>
      )}
    </div>
  );
};
