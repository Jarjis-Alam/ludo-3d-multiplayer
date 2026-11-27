import React from 'react';
import { SeatGlyph } from './SeatGlyph';

export type TurnPhase = 'roll' | 'select' | 'waiting' | 'extra' | 'notice' | 'passed';

export interface TurnIndicatorBarProps {
  playerName: string;
  seat?: number;
  isMyTurn: boolean;
  timeLeft: number;
  maxTime?: number;
  diceValue?: number | null;
  hasLegalMoves?: boolean;
  phase?: TurnPhase;
  noticeMessage?: string | null;
  className?: string;
}

export const TurnIndicatorBar: React.FC<TurnIndicatorBarProps> = ({
  playerName,
  seat,
  isMyTurn,
  timeLeft,
  maxTime = 30,
  diceValue = null,
  hasLegalMoves = true,
  phase,
  noticeMessage = null,
  className = '',
}) => {
  const percent = Math.max(0, Math.min(100, (timeLeft / maxTime) * 100));
  const isUrgent = timeLeft <= 5 && timeLeft > 0;
  const isExtra = phase === 'extra';

  // The bar always answers "whose turn is it?" first; the last event or the next
  // action sits underneath, so a timeout notice can never read as if it were
  // describing the player who is up now.
  let headline = isMyTurn ? 'Your Turn' : `${playerName}’s Turn`;
  let subline: string | null = null;

  if (phase === 'notice' && noticeMessage) {
    subline = noticeMessage;
  } else if (phase === 'passed') {
    subline = 'Turn passed to the next player';
  } else if (isExtra) {
    subline = isMyTurn
      ? 'Bonus roll — six, capture or home entry'
      : `${playerName} earned a bonus roll`;
  } else if (isMyTurn && diceValue !== null) {
    subline = hasLegalMoves ? `Rolled ${diceValue} — choose a pawn` : `No moves for ${diceValue} — turn passed`;
  } else if (isMyTurn) {
    subline = 'Tap the dice or press Space to roll';
  } else if (diceValue !== null) {
    subline = `Rolled ${diceValue}`;
  }

  return (
    <div
      className={`turn-indicator-bar-container ${isMyTurn ? 'my-turn-glow' : ''} ${
        isExtra ? 'turn-extra-calm' : ''
      } ${phase === 'notice' ? 'turn-notice' : ''} ${className}`}
    >
      <div className="turn-indicator-left">
        <span className="turn-crown-icon" aria-hidden="true">
          {isExtra ? '✨' : '👑'}
        </span>
        <div className="turn-headline-wrapper">
          <span className="turn-headline-text">
            {typeof seat === 'number' && (
              <SeatGlyph
                seat={seat}
                size={13}
                tone={isMyTurn ? 'gold' : 'cream'}
                className="turn-seat-glyph"
              />
            )}
            {headline}
          </span>
          {subline && <span className="turn-subline-text">{subline}</span>}
          {/* Smooth Golden Progress Bar directly under the headline */}
          <div className="turn-progress-track">
            <div
              className={`turn-progress-fill ${isUrgent ? 'progress-urgent' : ''}`}
              style={{ transform: `scaleX(${percent / 100})` }}
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
