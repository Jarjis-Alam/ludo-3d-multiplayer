import React, { useEffect, useState } from 'react';
import { AudioEngine } from './AudioEngine';

interface DiceRollerProps {
  value: number | null;
  rolling: boolean;
  canRoll: boolean;
  isMyTurn?: boolean;
  onRoll: () => void;
  playerColor?: string;
  playerName?: string;
  timeLeft?: number; // 0 to 15 seconds
  maxTime?: number;
}

const PIP_PATTERNS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const DiceRoller: React.FC<DiceRollerProps> = ({
  value,
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
    } else if (value) {
      setDisplayVal(value);
    }
  }, [rolling, value]);

  const pips = PIP_PATTERNS[displayVal] || PIP_PATTERNS[6];
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / maxTime) * 100));
  const strokeDashoffset = 100 - progressPercent;
  const isUrgent = timeLeft <= 5 && timeLeft > 0;
  const showTimer = (canRoll || (isMyTurn && value !== null)) && timeLeft > 0;

  return (
    <div className="dice-roller-container select-none">
      <div className={`dice-tray-wrapper ${canRoll ? 'tray-active-glow' : ''} ${isUrgent ? 'tray-urgent-border' : ''}`}>
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

        {/* 3D Tactile Dice Cube */}
        <button
          type="button"
          className={`dice-cube-btn ${rolling ? 'rolling-tumbling' : ''} ${
            canRoll ? 'can-roll-pulse' : 'disabled'
          }`}
          onClick={() => {
            if (canRoll && !rolling) onRoll();
          }}
          disabled={!canRoll || rolling}
          title={canRoll ? 'Tap to roll the dice' : 'Waiting for turn'}
          aria-label={canRoll ? 'Roll dice' : `Dice value ${displayVal}`}
        >
          <div className="dice-box-face">
            <div className="pip-grid-3x3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                <div key={idx} className="pip-cell">
                  {pips.includes(idx) && (
                    <div
                      className="dice-pip-dot"
                      style={{
                        backgroundColor:
                          displayVal === 6
                            ? 'var(--accent-red, #dc2626)'
                            : displayVal === 1
                            ? 'var(--accent-gold, #d97706)'
                            : '#1e293b',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* Clear Roll Availability / Action Feedback */}
      {canRoll ? (
        <button
          type="button"
          className={`roll-action-pill ${isUrgent ? 'roll-urgent-pulse' : ''}`}
          onClick={() => {
            if (canRoll && !rolling) onRoll();
          }}
          disabled={rolling}
        >
          {rolling ? (
            <span className="animate-pulse">🎲 Rolling…</span>
          ) : (
            <span>🎲 TAP TO ROLL {isUrgent ? `(${timeLeft}s)` : ''}</span>
          )}
        </button>
      ) : isMyTurn && value !== null ? (
        <div className="flex flex-col items-center gap-1.5">
          {displayVal === 6 && (
            <div className="dice-six-badge">
              <span>✨ ROLLED 6 — BONUS ROLL! ✨</span>
            </div>
          )}
          <div className={`dice-waiting-badge ${isUrgent ? 'text-red-400 border-red-500/60 bg-red-950/40' : 'text-amber-300 border-amber-400/50 bg-amber-500/10'} font-bold`}>
            ♟ Choose a pawn {isUrgent ? `(${timeLeft}s remaining)` : ''}
          </div>
        </div>
      ) : (
        <div className="dice-waiting-badge">
          {playerName ? `Waiting for ${playerName}… (${timeLeft}s)` : 'Awaiting turn…'}
        </div>
      )}
    </div>
  );
};
