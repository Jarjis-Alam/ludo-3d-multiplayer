import React, { useEffect, useState } from 'react';
import { AudioEngine } from './AudioEngine';

interface DiceRollerProps {
  value: number | null;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  playerColor?: string;
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
  onRoll,
  playerColor = 'gold',
  timeLeft = 15,
  maxTime = 15,
}) => {
  const [displayVal, setDisplayVal] = useState<number>(value || 6);

  useEffect(() => {
    if (rolling) {
      AudioEngine.playDiceRoll();
      const interval = setInterval(() => {
        setDisplayVal(Math.floor(Math.random() * 6) + 1);
      }, 60);
      return () => clearInterval(interval);
    } else if (value) {
      setDisplayVal(value);
    }
  }, [rolling, value]);

  const pips = PIP_PATTERNS[displayVal] || PIP_PATTERNS[6];
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / maxTime) * 100));
  const strokeDashoffset = 100 - progressPercent;

  return (
    <div className="dice-roller-container select-none">
      <div className="dice-tray-wrapper">
        {/* SVG Circular Timer Ring */}
        {canRoll && (
          <svg className="dice-timer-svg" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(212, 175, 55, 0.2)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="4"
              strokeDasharray="289"
              strokeDashoffset={2.89 * strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
        )}

        {/* Tactile 3D-Shaded Dice Cube */}
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
        >
          <div className="dice-box-face">
            <div className="pip-grid-3x3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                <div key={idx} className="pip-cell">
                  {pips.includes(idx) && (
                    <span
                      className={`pip-dot ${
                        displayVal === 6 ? 'pip-red' : 'pip-dark'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>

      {canRoll && (
        <button
          type="button"
          className="roll-action-pill"
          onClick={() => {
            if (canRoll && !rolling) onRoll();
          }}
          disabled={rolling}
        >
          {rolling ? (
            <span className="animate-pulse">Rolling…</span>
          ) : (
            <span>TAP TO ROLL</span>
          )}
        </button>
      )}
    </div>
  );
};
