import React, { useEffect, useState } from 'react';
import { AudioEngine } from './AudioEngine';

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
  red: '#e63946',
  green: '#2a9d8f',
  yellow: '#f59e0b',
  blue: '#2563eb',
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

  return (
    <div className="victory-overlay">
      {/* Dynamic Confetti & Sparkles Layer */}
      <div className="confetti-container" />

      <div className="victory-card">
        {/* Header Ribbon */}
        <div className="victory-ribbon">
          <span className="text-amber-400">★</span>
          <span className="victory-subtitle">ROYAL DARBAR • MATCH COMPLETE</span>
          <span className="text-amber-400">★</span>
        </div>

        {/* Crown & Victor Headline */}
        <div className="victory-hero">
          <div className="crown-badge">
            <span className="crown-icon">♔</span>
            <span className="sparkle top-right">✨</span>
            <span className="sparkle bottom-left">✦</span>
          </div>

          <h1 className="winner-headline">
            {firstPlayer ? `${firstPlayer.name} Wins 1st Place!` : 'Match Finished!'}
          </h1>

          <div className="match-tagline">
            <span className="text-amber-300 font-bold">1ST & 2ND PLACE DECIDED</span>
            <span>•</span>
            <span>ROOM #{roomCode}</span>
          </div>

          {/* Mode Switcher Pill */}
          <div className="tab-pill-switcher">
            <button
              type="button"
              className={`pill-btn ${tab === 'podium' ? 'active' : ''}`}
              onClick={() => setTab('podium')}
            >
              🏆 Grand Podium
            </button>
            <button
              type="button"
              className={`pill-btn ${tab === 'stats' ? 'active' : ''}`}
              onClick={() => setTab('stats')}
            >
              📊 Match Stats
            </button>
          </div>
        </div>

        {/* View 1: 3-Tier Podium */}
        {tab === 'podium' ? (
          <div className="podium-assembly">
            {/* 2nd Place (Left) */}
            {secondPlayer && (
              <div className="podium-col col-2">
                <div className="victor-tag" style={{ background: 'linear-gradient(135deg, #cbd5e1, #94a3b8)' }}>RUNNER-UP</div>
                <div
                  className="podium-avatar-ring"
                  style={{ borderColor: COLOR_HEX[secondPlayer.color] || '#aaa' }}
                >
                  <span className="avatar-initials">{secondPlayer.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="podium-name">{secondPlayer.name}</span>
                <span className="podium-score">
                  {secondSeat !== undefined ? '4/4 Home • 2nd Place' : `${secondPlayer.tokensHome}/4 Home`}
                </span>
                <div className="pedestal pedestal-2">
                  <span className="rank-badge">2 🥈</span>
                </div>
              </div>
            )}

            {/* 1st Place (Center) */}
            {firstPlayer && (
              <div className="podium-col col-1">
                <div className="victor-tag">CHAMPION</div>
                <div
                  className="podium-avatar-ring victor-ring"
                  style={{ borderColor: '#f59e0b' }}
                >
                  <span className="avatar-initials">{firstPlayer.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="podium-name font-bold">{firstPlayer.name}</span>
                <span className="podium-score text-amber-300">4/4 Home • 1st Place</span>
                <div className="pedestal pedestal-1">
                  <span className="rank-badge gold">1 🥇</span>
                  <span className="podium-gold-reward">👑 VICTORY</span>
                </div>
              </div>
            )}

            {/* 3rd Place (Right) */}
            {thirdPlayer && (
              <div className="podium-col col-3">
                <div className="victor-tag" style={{ background: 'linear-gradient(135deg, #d97706, #78350f)' }}>3RD PLACE</div>
                <div
                  className="podium-avatar-ring"
                  style={{ borderColor: COLOR_HEX[thirdPlayer.color] || '#aaa' }}
                >
                  <span className="avatar-initials">{thirdPlayer.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="podium-name">{thirdPlayer.name}</span>
                <span className="podium-score">{thirdPlayer.tokensHome}/4 Home</span>
                <div className="pedestal pedestal-3">
                  <span className="rank-badge">3 🥉</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* View 2: Match Stats */
          <div className="stats-breakdown">
            {sortedList.map((p) => (
              <div key={p.id} className="stat-row">
                <div className="flex items-center gap-2">
                  <span className="rank-number">{p.medal} #{p.badge}</span>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: COLOR_HEX[p.color] }}
                  />
                  <span className="player-stat-name">{p.name}</span>
                  <span className="text-xs text-slate-400">({p.rankTitle})</span>
                </div>
                <span className="text-amber-300 font-mono font-bold">
                  {p.tokensHome}/4 tokens finished
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action Controls */}
        <div className="victory-actions">
          <button
            type="button"
            className="rematch-btn"
            onClick={onRematch}
            disabled={rematching}
          >
            {rematching ? 'Starting Rematch…' : isHost ? 'Play Rematch' : 'Request Rematch'}
          </button>
          <button type="button" className="leave-btn" onClick={onLeave}>
            Return to Lobby
          </button>
        </div>

        {message && <p className="victory-message">{message}</p>}
      </div>
    </div>
  );
};

export default VictoryPodium;
