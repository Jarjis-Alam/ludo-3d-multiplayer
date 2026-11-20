import React from 'react';

export interface TurnIndicatorBarProps {
  playerName: string;
  isMyTurn: boolean;
  timeLeft: number;
  maxTime?: number;
  diceValue?: number | null;
  hasLegalMoves?: boolean;
  className?: string;
}

export const TurnIndicatorBar: React.FC<TurnIndicatorBarProps> = ({
  playerName,
  isMyTurn,
  timeLeft,
  maxTime = 15,
  diceValue = null,
  hasLegalMoves = true,
  className = '',
}) => {
  const percent = Math.max(0, Math.min(100, (timeLeft / maxTime) * 100));
  const isUrgent = timeLeft <= 5 && timeLeft > 0;

  let headline = isMyTurn ? 'Your Turn' : `${playerName}’s Turn`;
  if (isMyTurn && diceValue !== null) {
    headline = diceValue === 6
      ? '🎉 Rolled 6! Choose pawn & bonus turn'
      : hasLegalMoves
      ? `🎲 Rolled ${diceValue} — Choose a pawn`
      : `No moves for ${diceValue} — turn passed`;
  }

  return (
    <div className={`turn-indicator-bar-container ${isMyTurn ? 'my-turn-glow' : ''} ${className}`}>
      <div className="turn-indicator-left">
        <span className="turn-crown-icon" aria-hidden="true">👑</span>
        <div className="turn-headline-wrapper">
          <span className="turn-headline-text">{headline}</span>
          {/* Smooth Golden Progress Bar directly under the headline */}
          <div className="turn-progress-track">
            <div
              className={`turn-progress-fill ${isUrgent ? 'progress-urgent' : ''}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="turn-indicator-right">
        <div className={`turn-timer-badge ${isUrgent ? 'timer-urgent-pulse' : ''}`}>
          <span className="timer-clock-icon">⏱</span>
          <span className="timer-seconds-number">{Math.max(0, timeLeft)}s</span>
        </div>
      </div>
    </div>
  );
};
