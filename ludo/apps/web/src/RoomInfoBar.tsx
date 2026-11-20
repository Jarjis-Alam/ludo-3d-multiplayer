import React from 'react';

export interface RoomInfoBarProps {
  roomCode: string;
  playerCount: number;
  maxPlayers?: number;
  latency?: number;
  copied?: boolean;
  onCopy: () => void;
  className?: string;
}

export const RoomInfoBar: React.FC<RoomInfoBarProps> = ({
  roomCode,
  playerCount,
  maxPlayers = 4,
  latency = 42,
  copied = false,
  onCopy,
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

      {/* Player Count */}
      <div className="room-info-pill-item player-count-section">
        <span className="room-pill-icon">👥</span>
        <span className="player-count-text">
          <span className="player-count-bold">{playerCount}</span> / {maxPlayers} Players
        </span>
      </div>

      {/* Network Latency */}
      <div className="room-info-pill-item latency-section">
        <span className="latency-icon">📶</span>
        <span className="latency-text">{latency} ms</span>
      </div>
    </div>
  );
};
