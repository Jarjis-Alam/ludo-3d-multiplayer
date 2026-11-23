import React, { useEffect, useMemo } from 'react';
import { AudioEngine } from './AudioEngine';

export interface VictoryPlayer {
  id: string;
  name: string;
  color: string;
  seat: number;
  tokensHome: number;
}

export interface VictoryMatchStats {
  startedAt: number;
  finishedAt?: number;
  rolls: number;
  captures: number;
  safeMoves: number;
}

export interface VictoryPodiumProps {
  roomCode: string;
  winnerSeat: number;
  rankings?: number[];
  players: VictoryPlayer[];
  sessionId: string;
  hostId: string;
  rematching: boolean;
  message?: string;
  stats?: VictoryMatchStats | null;
  onRematch: () => void;
  onLeave: () => void;
  onShare: () => void;
}

const CrownIcon: React.FC = () => (
  <svg viewBox="0 0 72 54" className="victory-crown" aria-hidden="true">
    <path
      d="M6 44 3 15l17 12L36 5l16 22 17-12-3 29Z"
      fill="#ffd23f"
      stroke="#2b1030"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path d="M9 45h54" stroke="#2b1030" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const Laurel: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 60 132" className={`victory-laurel ${className}`} aria-hidden="true">
    <path
      d="M44 12C27 34 20 62 26 88c5 18 14 28 25 33"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <g fill="currentColor">
      {/* Leaves fan out from both sides of the stem like a laurel sprig */}
      <ellipse cx="31" cy="20" rx="13" ry="5.4" transform="rotate(-54 31 20)" />
      <ellipse cx="41" cy="30" rx="11" ry="4.8" transform="rotate(-30 41 30)" />
      <ellipse cx="22" cy="38" rx="13" ry="5.4" transform="rotate(-66 22 38)" />
      <ellipse cx="35" cy="49" rx="11" ry="4.8" transform="rotate(-42 35 49)" />
      <ellipse cx="17" cy="58" rx="13" ry="5.4" transform="rotate(-80 17 58)" />
      <ellipse cx="31" cy="69" rx="11" ry="4.8" transform="rotate(-56 31 69)" />
      <ellipse cx="16" cy="79" rx="13" ry="5.4" transform="rotate(-94 16 79)" />
      <ellipse cx="29" cy="90" rx="11" ry="4.8" transform="rotate(-70 29 90)" />
      <ellipse cx="22" cy="102" rx="12" ry="5" transform="rotate(-110 22 102)" />
      <ellipse cx="33" cy="112" rx="10" ry="4.4" transform="rotate(-88 33 112)" />
    </g>
  </svg>
);

const DiceIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" />
    <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

const SwordsIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 3h4l9 9-2 2-9-9V3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M20 3h-4l-9 9 2 2 9-9V3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M6.5 17.5 3 21M17.5 17.5 21 21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const ShieldIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3 4.5 6v6c0 4.3 3 7.6 7.5 9 4.5-1.4 7.5-4.7 7.5-9V6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="m12 8.5 1.3 2.7 3 .4-2.2 2.1.6 3-2.7-1.5-2.7 1.5.6-3-2.2-2.1 3-.4Z" fill="currentColor" />
  </svg>
);

const StopwatchIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="14" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 14V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M9.5 4h5M12 4v2.8M18.4 7.6l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const PlayIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5 18.5 12 8 18.5Z" fill="currentColor" />
  </svg>
);

const HomeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 11 12 4l8 7v8.5H4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
    <path d="M10 19.5v-5h4v5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
  </svg>
);

const ShareIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
    <circle cx="17.5" cy="6" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
    <circle cx="17.5" cy="18" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
    <path d="m8.2 10.9 7.1-3.8M8.2 13.1l7.1 3.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

const formatDuration = (stats: VictoryMatchStats) => {
  const end = stats.finishedAt ?? Date.now();
  const totalSeconds = Math.max(0, Math.round((end - stats.startedAt) / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

/**
 * Victory screen: cream banner with laurels and a crown, a podium of tilted pawn
 * discs and the match's real counters (turns, captures, safe moves, duration).
 */
export const VictoryPodium: React.FC<VictoryPodiumProps> = ({
  roomCode,
  winnerSeat,
  rankings = [],
  players,
  sessionId,
  hostId,
  rematching,
  message,
  stats,
  onRematch,
  onLeave,
  onShare,
}) => {
  useEffect(() => {
    AudioEngine.playVictory();
  }, []);

  const rankedSeats = rankings.length > 0 ? rankings : [winnerSeat];
  const firstSeat = rankedSeats[0] ?? winnerSeat;
  const firstPlayer = players.find((p) => p.seat === firstSeat);

  const secondSeat = rankedSeats.length > 1 ? rankedSeats[1] : undefined;
  const secondPlayer =
    secondSeat !== undefined
      ? players.find((p) => p.seat === secondSeat)
      : players.filter((p) => p.seat !== firstSeat).sort((a, b) => b.tokensHome - a.tokensHome)[0];

  const remainingPlayers = players
    .filter((p) => p.seat !== firstSeat && p.seat !== secondPlayer?.seat)
    .sort((a, b) => b.tokensHome - a.tokensHome);

  const thirdPlayer = remainingPlayers[0];
  const fourthPlayer = remainingPlayers[1];

  const isHost = hostId === sessionId;
  const isWinner = firstPlayer?.id === sessionId;

  const podium = useMemo(
    () =>
      [
        fourthPlayer ? { player: fourthPlayer, place: 4 } : null,
        thirdPlayer ? { player: thirdPlayer, place: 3 } : null,
        secondPlayer ? { player: secondPlayer, place: 2 } : null,
        firstPlayer ? { player: firstPlayer, place: 1 } : null,
      ].filter((entry): entry is { player: VictoryPlayer; place: number } => entry !== null),
    [firstPlayer, secondPlayer, thirdPlayer, fourthPlayer]
  );

  const runnersUp = podium.filter((entry) => entry.place > 1).sort((a, b) => a.place - b.place);
  const duration = stats ? formatDuration(stats) : null;

  return (
    <div className="victory-screen">
      <div className="victory-backdrop" aria-hidden="true">
        <span className="victory-arm victory-arm-red" />
        <span className="victory-arm victory-arm-green" />
        <span className="victory-arm victory-arm-yellow" />
        <span className="victory-arm victory-arm-blue" />
        <span className="victory-band victory-band-top" />
        <span className="victory-band victory-band-bottom" />
      </div>

      <div className="victory-confetti-layer" aria-hidden="true">
        {[...Array(18)].map((_, i) => (
          <span
            key={i}
            className={`confetti-particle particle-${i % 5}`}
            style={{
              left: `${(i * 5.4 + 3) % 100}%`,
              animationDelay: `${(i * 0.28) % 4}s`,
              animationDuration: `${3 + ((i * 0.35) % 2.4)}s`,
            }}
          />
        ))}
      </div>

      <div className="victory-content">
        <header className="victory-head">
          <CrownIcon />
          <div className="victory-plate-row">
            <Laurel className="victory-laurel-left" />
            <div className="victory-plate">
              <h1 className="victory-title">VICTORY!</h1>
            </div>
            <Laurel className="victory-laurel-right" />
          </div>
          <p className="victory-subtitle">
            {firstPlayer
              ? isWinner
                ? 'YOU WON THE MATCH'
                : `${firstPlayer.name.toUpperCase()} WON THE MATCH`
              : 'MATCH COMPLETE'}
          </p>
          <p className="victory-room">Room #{roomCode}</p>
        </header>

        <div className="victory-stage">
          <div className="victory-stage-floor" aria-hidden="true" />
          <div className="victory-rays" aria-hidden="true" />
          <div className="victory-stage-glow" aria-hidden="true" />
          {podium.map((entry) => (
            <div
              key={entry.player.id}
              className={`victory-disc victory-disc-${entry.place} disc-${entry.player.color}`}
              title={`${entry.player.name} — ${entry.place}${entry.place === 1 ? 'st' : entry.place === 2 ? 'nd' : entry.place === 3 ? 'rd' : 'th'} place`}
              aria-label={`${entry.player.name}, place ${entry.place}`}
            />
          ))}
        </div>

        {stats && (
          <div className="victory-statcard">
            <div className="victory-stat">
              <DiceIcon />
              <span>Turns</span>
              <strong>{stats.rolls}</strong>
            </div>
            <div className="victory-stat">
              <SwordsIcon />
              <span>Captures</span>
              <strong>{stats.captures}</strong>
            </div>
            <div className="victory-stat">
              <ShieldIcon />
              <span>Safe Moves</span>
              <strong>{stats.safeMoves}</strong>
            </div>
            <div className="victory-stat">
              <StopwatchIcon />
              <span>Duration</span>
              <strong>{duration}</strong>
            </div>
          </div>
        )}

        {runnersUp.length > 0 && (
          <p className="victory-order">
            {runnersUp.map((entry, index) => (
              <span key={entry.player.id}>
                {index > 0 && <span className="victory-order-dot">·</span>}
                <i className={`victory-order-chip disc-${entry.player.color}`} />
                {entry.place}
                {entry.place === 2 ? 'nd' : entry.place === 3 ? 'rd' : 'th'} {entry.player.name}
              </span>
            ))}
          </p>
        )}

        <div className="victory-actions">
          <button
            type="button"
            className="victory-btn victory-btn-primary"
            onClick={onRematch}
            disabled={rematching}
          >
            <PlayIcon />
            {rematching ? 'Starting…' : isHost ? 'Play Again' : 'Request Rematch'}
          </button>
          <button type="button" className="victory-btn victory-btn-secondary" onClick={onLeave}>
            <HomeIcon />
            Back to Lobby
          </button>
          <button
            type="button"
            className="victory-btn-icon"
            onClick={onShare}
            aria-label="Share room code"
            title="Share room"
          >
            <ShareIcon />
          </button>
        </div>

        {message && <p className="victory-notice-msg">{message}</p>}
      </div>
    </div>
  );
};

export default VictoryPodium;
