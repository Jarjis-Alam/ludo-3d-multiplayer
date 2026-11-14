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

  // Sort players: winner first, then descending by tokensHome
  const sorted = [...players].sort((a, b) => {
    if (a.seat === winnerSeat) return -1;
    if (b.seat === winnerSeat) return 1;
    return b.tokensHome - a.tokensHome;
  });

  const winner = sorted[0];
  const runnerUp = sorted[1];
  const thirdPlace = sorted[2];
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
            {winner ? `${winner.name} Wins!` : 'Victory!'}
          </h1>

          <div className="match-tagline">
            <span className="text-amber-300 font-bold">4/4 PAWNS HOME</span>
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
            {runnerUp && (
              <div className="podium-col col-2">
                <div
                  className="podium-avatar-ring"
                  style={{ borderColor: COLOR_HEX[runnerUp.color] || '#aaa' }}
                >
                  <span className="avatar-initials">{runnerUp.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="podium-name">{runnerUp.name}</span>
                <span className="podium-score">{runnerUp.tokensHome}/4 Home</span>
                <div className="pedestal pedestal-2">
                  <span className="rank-badge">2</span>
                </div>
              </div>
            )}

            {/* 1st Place (Center) */}
            {winner && (
              <div className="podium-col col-1">
                <div className="victor-tag">VICTOR</div>
                <div
                  className="podium-avatar-ring victor-ring"
                  style={{ borderColor: '#f59e0b' }}
                >
                  <span className="avatar-initials">{winner.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="podium-name font-bold">{winner.name}</span>
                <span className="podium-score text-amber-300">4/4 Home</span>
                <div className="pedestal pedestal-1">
                  <span className="rank-badge gold">1</span>
                  <span className="podium-gold-reward">+500 XP</span>
                </div>
              </div>
            )}

            {/* 3rd Place (Right) */}
            {thirdPlace && (
              <div className="podium-col col-3">
                <div
                  className="podium-avatar-ring"
                  style={{ borderColor: COLOR_HEX[thirdPlace.color] || '#aaa' }}
                >
                  <span className="avatar-initials">{thirdPlace.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="podium-name">{thirdPlace.name}</span>
                <span className="podium-score">{thirdPlace.tokensHome}/4 Home</span>
                <div className="pedestal pedestal-3">
                  <span className="rank-badge">3</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* View 2: Match Stats */
          <div className="stats-breakdown">
            {sorted.map((p, rank) => (
              <div key={p.id} className="stat-row">
                <div className="flex items-center gap-2">
                  <span className="rank-number">#{rank + 1}</span>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: COLOR_HEX[p.color] }}
                  />
                  <span className="player-stat-name">{p.name}</span>
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
