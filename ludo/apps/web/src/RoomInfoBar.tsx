import React from 'react';

export interface RoomInfoBarProps {
  roomCode: string;
  playerCount: number;
  maxPlayers?: number;
  latency?: number;
  copied?: boolean;
  onCopy: () => void;
  /** Seats still empty in this room; the count doubles as the invite trigger. */
  openSeats?: number;
  onInvite?: () => void;
  className?: string;
}

export const RoomInfoBar: React.FC<RoomInfoBarProps> = ({
  roomCode,
  playerCount,
  maxPlayers = 4,
  latency = 42,
  copied = false,
  onCopy,
  openSeats = 0,
  onInvite,
  className = '',
}) => {
  return (
    <div className={`room-info-bar-container ${className}`}>
      {/* Room Code with Copy Action */}
      <div
        className="room-info-pill-item room-code-section"
        onClick={onCopy}
        role="button"
        tabIndex={0}
        title="Tap to copy Room Code"
      >
        <span className="room-label-prefix">Room</span>
        <span className="room-code-digits">#{roomCode}</span>
        <button
          type="button"
          className="room-copy-btn"
          aria-label="Copy Room Code"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>

      {/* Divider */}
      <div className="room-info-divider" aria-hidden="true" />

      {/* Player Count — doubles as the invite entry point while seats are free */}
      <div
        className={`room-info-pill-item player-count-section ${openSeats > 0 ? 'has-open-seats' : ''}`}
        onClick={openSeats > 0 ? onInvite : undefined}
        role={openSeats > 0 ? 'button' : undefined}
        tabIndex={openSeats > 0 ? 0 : undefined}
        title={openSeats > 0 ? 'Invite players to the open seats' : undefined}
        onKeyDown={
          openSeats > 0 && onInvite
            ? (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onInvite();
              }
            : undefined
        }
      >
        <span className="room-pill-icon">👥</span>
        <span className="player-count-text">
          <span className="player-count-bold">{playerCount}</span> / {maxPlayers} Players
        </span>
        {openSeats > 0 && (
          <span className="open-seats-chip">
            ＋{openSeats}
            <span className="open-seats-word"> open</span>
          </span>
        )}
      </div>

      {/* Network Latency */}
      <div className="room-info-pill-item latency-section">
        <span className="latency-icon">📶</span>
        <span className="latency-text">{latency} ms</span>
      </div>
    </div>
  );
};
