import React, { useEffect, useState } from 'react';
import { AudioEngine } from './AudioEngine';
import { PlayerAvatar } from './PlayerAvatar';
import { GameBackground } from './GameBackground';

export interface VictoryPlayer {
  id: string;
  name: string;
  color: string;
  seat: number;
  tokensHome: number;
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
  onRematch: () => void;
  onLeave: () => void;
}

const COLOR_HEX: Record<string, string> = {
  red: '#ED3945',
  green: '#08A66A',
  yellow: '#FFAA13',
  blue: '#3978F6',
};

export const VictoryPodium: React.FC<VictoryPodiumProps> = ({
  roomCode,
  winnerSeat,
  rankings = [],
  players,
  sessionId,
  hostId,
  rematching,
  message,
  onRematch,
  onLeave,
}) => {
  const [tab, setTab] = useState<'podium' | 'stats'>('podium');

  useEffect(() => {
    AudioEngine.playVictory();
  }, []);

  // Determine official 1st, 2nd, and remaining placements
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

  const sortedList = [
    ...(firstPlayer ? [{ ...firstPlayer, rankTitle: '1st Place (Champion)', badge: '1', medal: '🥇' }] : []),
    ...(secondPlayer ? [{ ...secondPlayer, rankTitle: '2nd Place (Runner-Up)', badge: '2', medal: '🥈' }] : []),
    ...(thirdPlayer ? [{ ...thirdPlayer, rankTitle: '3rd Place', badge: '3', medal: '🥉' }] : []),
    ...(fourthPlayer ? [{ ...fourthPlayer, rankTitle: '4th Place', badge: '4', medal: '🎖️' }] : []),
  ];

  const isHost = hostId === sessionId;
  const isWinner = firstPlayer?.id === sessionId;

  return (
    <GameBackground>
      <div className="victory-overlay-container">
        {/* Colorful Confetti particles in 4 player colors */}
        <div className="victory-confetti-layer" aria-hidden="true">
          {[...Array(24)].map((_, i) => (
            <span
              key={i}
              className={`confetti-particle particle-${i % 4}`}
              style={{
                left: `${(i * 4.2 + 2) % 100}%`,
                animationDelay: `${(i * 0.15) % 3}s`,
                animationDuration: `${2.5 + ((i * 0.2) % 2)}s`,
              }}
            />
          ))}
        </div>

        <div className="victory-main-card">
          {/* Header Crown & Title */}
          <div className="victory-header-badge">
            <div className="victory-crown-medallion">
              <span>👑</span>
            </div>
            <h1 className="victory-title-headline">VICTORY!</h1>
            <p className="victory-winner-subtitle">
              {firstPlayer
                ? isWinner
                  ? 'Congratulations! You Won the Match!'
                  : `${firstPlayer.name} has claimed the crown!`
                : 'Match Complete!'}
            </p>
            <div className="victory-room-tag">Room #{roomCode} • 2–4 Players</div>
          </div>

          {/* Switcher Pill */}
          <div className="victory-tab-switcher" role="tablist">
            <button
              type="button"
              className={`victory-tab-btn ${tab === 'podium' ? 'active' : ''}`}
              onClick={() => setTab('podium')}
            >
              🏆 Podium Stand
            </button>
            <button
              type="button"
              className={`victory-tab-btn ${tab === 'stats' ? 'active' : ''}`}
              onClick={() => setTab('stats')}
            >
              📊 Match Scores
            </button>
          </div>

          {/* Tab 1: Podium Stand */}
          {tab === 'podium' ? (
            <div className="victory-podium-stand">
              {/* 2nd Place */}
              {secondPlayer && (
                <div className="podium-tier tier-2">
                  <div className="podium-place-label">2ND</div>
                  <PlayerAvatar seat={secondPlayer.seat} name={secondPlayer.name} size={48} showCrown={false} />
                  <span className="podium-player-name">{secondPlayer.name}</span>
                  <span className="podium-home-count">
                    {secondSeat !== undefined ? '4/4 Home' : `${secondPlayer.tokensHome}/4 Home`}
                  </span>
                  <div className="podium-block block-2">
                    <span className="podium-medal">🥈</span>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {firstPlayer && (
                <div className="podium-tier tier-1">
                  <div className="podium-place-label champion">CHAMPION</div>
                  <PlayerAvatar seat={firstPlayer.seat} name={firstPlayer.name} size={64} showCrown={true} isHost={true} />
                  <span className="podium-player-name champion-name">{firstPlayer.name}</span>
                  <span className="podium-home-count champion-count">4/4 Home • Winner</span>
                  <div className="podium-block block-1">
                    <span className="podium-medal">🥇</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {thirdPlayer && (
                <div className="podium-tier tier-3">
                  <div className="podium-place-label">3RD</div>
                  <PlayerAvatar seat={thirdPlayer.seat} name={thirdPlayer.name} size={44} showCrown={false} />
                  <span className="podium-player-name">{thirdPlayer.name}</span>
                  <span className="podium-home-count">{thirdPlayer.tokensHome}/4 Home</span>
                  <div className="podium-block block-3">
                    <span className="podium-medal">🥉</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Full Leaderboard */
            <div className="victory-stats-list">
              {sortedList.map((p) => (
                <div key={p.id} className="victory-stat-card">
                  <div className="stat-left-col">
                    <span className="stat-rank-medal">{p.medal}</span>
                    <PlayerAvatar seat={p.seat} name={p.name} size={36} showCrown={false} />
                    <div className="stat-info-col">
                      <span className="stat-name">{p.name} {p.id === sessionId ? '(You)' : ''}</span>
                      <span className="stat-title">{p.rankTitle}</span>
                    </div>
                  </div>
                  <span className="stat-tokens-badge">
                    {p.tokensHome}/4 Home
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="victory-actions-group">
            <button
              type="button"
              className="primary-game-btn victory-primary-btn"
              onClick={onRematch}
              disabled={rematching}
            >
              {rematching ? 'Starting Rematch…' : isHost ? '🔄 Play Rematch' : '🔄 Request Rematch'}
            </button>
            <button
              type="button"
              className="secondary-violet-btn victory-secondary-btn"
              onClick={onLeave}
            >
              🏠 Return to Lobby
            </button>
          </div>

          {message && <p className="victory-notice-msg">{message}</p>}
        </div>
      </div>
    </GameBackground>
  );
};

export default VictoryPodium;
