import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import { legalTokens } from '@ludo/game-engine';
import { Board2D } from './Board2D';
import { LandingBoard2D } from './LandingBoard2D';
import { DiceRoller } from './DiceRoller';
import { VictoryPodium } from './VictoryPodium';
import { AudioEngine } from './AudioEngine';
import './style.css';

type ClientPlayer = { id: string; name: string; color: string; seat: number; connected: boolean };
type Snapshot = {
  roomCode: string;
  host: string;
  invitationPath: string;
  status: 'lobby' | 'playing' | 'finished';
  currentPlayer: number;
  dice: number | null;
  winner: number | null;
  version: number;
  players: ClientPlayer[];
  tokens: Array<Array<{ kind: 'base' | 'path' | 'home'; progress: number }>>;
};

const socket: Socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  auth: { sessionToken: localStorage.getItem('ludo-session') || '' },
});

const colorHex: Record<string, string> = {
  red: '#e63946',
  green: '#2a9d8f',
  yellow: '#f59e0b',
  blue: '#2563eb',
};

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function App() {
  const [name, setName] = useState(localStorage.getItem('ludo_player_name') || '');
  const [roomInput, setRoomInput] = useState(new URLSearchParams(location.search).get('room') || '');
  const [landingTab, setLandingTab] = useState<'create' | 'join'>('create');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [lastDice, setLastDice] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(AudioEngine.isMuted());
  const [turnTimeLeft, setTurnTimeLeft] = useState(15);

  const canJoin = name.trim().length > 0 && name.trim().length <= 16;

  // Persist player name locally
  useEffect(() => {
    if (name.trim()) {
      localStorage.setItem('ludo_player_name', name.trim());
    }
  }, [name]);

  // Turn timer countdown
  useEffect(() => {
    if (snapshot?.status === 'playing') {
      setTurnTimeLeft(15);
      const interval = setInterval(() => {
        setTurnTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [snapshot?.status, snapshot?.currentPlayer, snapshot?.version]);

  useEffect(() => {
    const onSession = (data: { sessionToken: string; playerId: string }) => {
      localStorage.setItem('ludo-session', data.sessionToken);
      setSessionId(data.playerId);
    };
    const onState = (data: Snapshot) => {
      setSnapshot((prev) => {
        if (prev && data.version < prev.version) return prev;
        if (prev && data.version > prev.version + 1 && prev.roomCode) {
          socket.emit('request_game_state', prev.roomCode);
        }
        return data;
      });
      setRolling(false);
    };
    const onConnect = () => {
      setConnected(true);
      const savedRoom = localStorage.getItem('ludo-room');
      if (savedRoom) {
        socket.emit('request_game_state', savedRoom, (res: any) => {
          if (res?.ok && res.state) {
            setSnapshot(res.state);
          } else if (res && !res.ok) {
            localStorage.removeItem('ludo-room');
          }
        });
      }
    };
    const onDisconnect = () => setConnected(false);

    socket.on('session', onSession);
    socket.on('lobby_updated', onState);
    socket.on('room_state', onState);
    socket.on('game_started', onState);
    socket.on('rematch_started', onState);
    socket.on('state', onState);
    socket.on('player_disconnected', onState);
    socket.on('player_reconnected', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Auto-connect on mount so page refreshes recover session and active match
    if (!socket.connected) {
      socket.connect();
    }
    return () => {
      socket.off('session', onSession);
      socket.off('lobby_updated', onState);
      socket.off('room_state', onState);
      socket.off('game_started', onState);
      socket.off('rematch_started', onState);
      socket.off('state', onState);
      socket.off('player_disconnected', onState);
      socket.off('player_reconnected', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const connect = () => {
    if (!socket.connected) socket.connect();
  };

  const create = () => {
    connect();
    socket.emit('create_room', { name: name.trim() }, (result: any) => {
      if (!result.ok) return setMessage(result.error);
      localStorage.setItem('ludo-room', result.roomCode);
      setSnapshot(result.state);
      setMessage('Room created. Invite friends to join.');
    });
  };

  const join = () => {
    connect();
    socket.emit('join_room', { roomCode: roomInput.trim(), name: name.trim() }, (result: any) => {
      if (!result.ok) return setMessage(result.error);
      localStorage.setItem('ludo-room', result.roomCode);
      setSnapshot(result.state);
      setMessage('Joined the royal salon.');
    });
  };

  const leave = () => {
    if (snapshot)
      socket.emit('leave_room', snapshot.roomCode, () => {
        localStorage.removeItem('ludo-room');
        setSnapshot(null);
        setMessage('');
      });
  };

  const start = () => {
    if (!snapshot || starting) return;
    setStarting(true);
    setMessage('Starting match…');
    socket.emit(
      'start_game',
      { roomCode: snapshot.roomCode, actionId: `start_${Date.now()}` },
      (result: any) => {
        setStarting(false);
        if (!result) {
          setMessage('No response from server. Check backend connection.');
          return;
        }
        if (!result.ok) {
          setMessage(result.error || 'Server rejected match start');
          if (result.state) setSnapshot(result.state);
        } else {
          setMessage('');
          if (result.state) setSnapshot(result.state);
        }
      }
    );
  };

  const rematch = () => {
    if (!snapshot || rematching) return;
    setRematching(true);
    setMessage('Starting rematch…');
    socket.emit(
      'request_rematch',
      { roomCode: snapshot.roomCode, actionId: `rematch_${snapshot.version}_${Date.now()}` },
      (result: any) => {
        setRematching(false);
        if (!result) {
          setMessage('No response from server. Check backend connection.');
          return;
        }
        if (!result.ok) {
          setMessage(result.error || 'Server rejected rematch');
          if (result.state) setSnapshot(result.state);
        } else {
          setMessage('');
          if (result.state) setSnapshot(result.state);
        }
      }
    );
  };

  const copyInvite = () => {
    if (!snapshot) return;
    navigator.clipboard?.writeText(`${location.origin}/?room=${snapshot.roomCode}`);
    setMessage('Invite link copied to clipboard!');
    setTimeout(() => setMessage(''), 3000);
  };

  const copyCode = () => {
    if (!snapshot) return;
    navigator.clipboard?.writeText(snapshot.roomCode);
    setMessage('Room code copied to clipboard!');
    setTimeout(() => setMessage(''), 3000);
  };

  const toggleSound = () => {
    const muted = AudioEngine.toggleMute();
    setIsMuted(muted);
  };

  const localSeat = snapshot?.players.find((player) => player.id === sessionId)?.seat ?? -1;
  const activePlayer = snapshot?.players.find((player) => player.seat === snapshot.currentPlayer);
  const isMyTurn = localSeat === snapshot?.currentPlayer;

  const legal = useMemo(
    () =>
      snapshot && snapshot.dice !== null && localSeat === snapshot.currentPlayer
        ? legalTokens(snapshot as any, localSeat as any, snapshot.dice)
        : [],
    [snapshot, localSeat]
  );

  const rollDice = () => {
    if (!snapshot || rolling) return;
    setRolling(true);
    const actionId = `roll_${snapshot.version}_${Date.now()}`;
    socket.emit(
      'roll_dice',
      { roomCode: snapshot.roomCode, actionId, expectedVersion: snapshot.version },
      (result: any) => {
        if (!result?.ok) {
          setRolling(false);
          setMessage(result?.error || 'Unable to roll');
          if (result?.state) setSnapshot(result.state);
          return;
        }
        setLastDice(result.value);
        if (result.state) setSnapshot(result.state);
        window.setTimeout(() => setRolling(false), 550);
      }
    );
  };

  const moveToken = (token: number) => {
    if (!snapshot || !legal.includes(token)) return;
    const actionId = `move_${snapshot.version}_${token}_${Date.now()}`;
    socket.emit(
      'move_token',
      { roomCode: snapshot.roomCode, token, actionId, expectedVersion: snapshot.version },
      (result: any) => {
        if (!result?.ok) {
          setMessage(result?.error || 'That token cannot move');
          if (result?.state) setSnapshot(result.state);
        } else {
          setMessage('');
          if (result?.state) setSnapshot(result.state);
        }
      }
    );
  };

  // Header Component
  const renderHeader = (badgeText: string) => (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-logo">
          LUDO<span>•</span>
        </div>
        <div className="header-status-badge">
          <span className={`status-dot ${connected ? '' : 'reconnecting'}`} />
          <span>{badgeText}</span>
        </div>
      </div>
      <div className="header-controls">
        <button
          type="button"
          className="sound-toggle-btn"
          onClick={toggleSound}
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );

  // =========================================================================
  // VIEW 1: LANDING & MATCHMAKING
  // =========================================================================
  if (!snapshot) {
    return (
      <main>
        {renderHeader('2–4 PLAYERS ONLINE')}
        <div className="landing-container">
          <section className="landing-hero">
            <div className="hero-copy">
              <span className="hero-eyebrow">ROYAL 2D TABLETOP SALON</span>
              <h1 className="hero-title">
                Two to four friends.
                <br />
                <i>One perfect roll.</i>
              </h1>
              <p className="hero-lede">
                Experience authentic Meenakari royal enamel Ludo with zero latency, live WebSocket synchronization,
                and server-authoritative tournament rules.
              </p>

              <div className="matchmaking-card">
                <div className="tab-nav">
                  <button
                    type="button"
                    className={`tab-nav-btn ${landingTab === 'create' ? 'active' : ''}`}
                    onClick={() => setLandingTab('create')}
                  >
                    Create Private Room
                  </button>
                  <button
                    type="button"
                    className={`tab-nav-btn ${landingTab === 'join' ? 'active' : ''}`}
                    onClick={() => setLandingTab('join')}
                  >
                    Join with Code
                  </button>
                </div>

                <div className="input-group">
                  <label className="input-label">Your Display Name</label>
                  <input
                    className="royal-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={16}
                    placeholder="Enter your name"
                    autoFocus
                  />
                </div>

                {landingTab === 'join' && (
                  <div className="input-group">
                    <label className="input-label">6-Character Room Code</label>
                    <input
                      className="royal-input code-input"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="ROOM CODE"
                    />
                  </div>
                )}

                {landingTab === 'create' ? (
                  <button
                    type="button"
                    className="cta-button"
                    disabled={!canJoin}
                    onClick={create}
                  >
                    <span>Create Private Salon</span> <span>👑</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cta-button"
                    disabled={!canJoin || roomInput.trim().length !== 6}
                    onClick={join}
                  >
                    <span>Enter Room Table</span> <span>⚔️</span>
                  </button>
                )}

                {message && <p className="text-amber-400 text-xs text-center">{message}</p>}
              </div>
            </div>

            <div className="landing-board-wrapper">
              <LandingBoard2D />
            </div>
          </section>
        </div>
      </main>
    );
  }

  // =========================================================================
  // VIEW 2: PRIVATE WAITING ROOM / LOBBY
  // =========================================================================
  if (snapshot.status === 'lobby') {
    return (
      <main>
        {renderHeader(`LOBBY · ${snapshot.players.length}/4 SEATS FILLED`)}
        <div className="lobby-container">
          <div className="lobby-head-card">
            <div>
              <span className="hero-eyebrow">PRIVATE SALON LOBBY</span>
              <div className="room-code-tag">ROOM #{snapshot.roomCode}</div>
              <p className="hero-lede">
                Can start as soon as 2 players join. Empty seats are skipped automatically.
              </p>
            </div>
            <div className="room-actions">
              <button type="button" className="btn-secondary" onClick={copyInvite}>
                🔗 Copy Invite Link
              </button>
              <button type="button" className="btn-secondary" onClick={copyCode}>
                📋 Copy Code
              </button>
            </div>
          </div>

          <div className="slots-grid">
            {[0, 1, 2, 3].map((seat) => {
              const player = snapshot.players.find((p) => p.seat === seat);
              const color = ['red', 'green', 'yellow', 'blue'][seat];
              return (
                <div key={seat} className={`royal-slot-card ${player ? 'occupied' : ''}`}>
                  <div className={`slot-avatar ${player ? color : 'empty'}`}>
                    {player ? initials(player.name) : seat + 1}
                  </div>
                  <div className="slot-info">
                    <span className="slot-name">
                      {player ? player.name : `Seat ${seat + 1} (Available)`}
                      {player?.id === sessionId ? ' · YOU' : ''}
                    </span>
                    <span className="slot-status">
                      {player
                        ? `${player.id === snapshot.host ? '👑 HOST · ' : ''}${
                            player.connected ? 'CONNECTED & READY' : 'RECONNECTING'
                          }`
                        : 'Skipped if match starts with 2 or 3 players'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lobby-footer-bar">
            <span className="font-mono text-sm text-amber-200">
              {snapshot.players.length}/4 Players · {snapshot.players.filter((p) => p.connected).length} Connected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="cta-button"
                style={{ width: 'auto', padding: '10px 24px' }}
                onClick={start}
                disabled={
                  starting ||
                  snapshot.host !== sessionId ||
                  snapshot.players.length < 2 ||
                  snapshot.players.length > 4 ||
                  snapshot.players.some((p) => !p.connected)
                }
              >
                {starting
                  ? 'Starting match…'
                  : snapshot.host === sessionId
                  ? snapshot.players.length >= 2
                    ? `Start game (${snapshot.players.length} Players)`
                    : 'Start game (min 2 players)'
                  : 'Waiting for Host to start…'}
              </button>
              <button type="button" className="btn-secondary" onClick={leave}>
                Leave Salon
              </button>
            </div>
          </div>
          {message && <p className="text-amber-400 text-xs text-center">{message}</p>}
        </div>
      </main>
    );
  }

  // =========================================================================
  // VIEW 3: MATCH COMPLETE / VICTORY PODIUM
  // =========================================================================
  if (snapshot.status === 'finished') {
    const victoryPlayers = snapshot.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      seat: p.seat,
      tokensHome: snapshot.tokens[p.seat]?.filter((t) => t.kind === 'home' && t.progress === 6).length || 0,
    }));

    return (
      <main>
        {renderHeader(`MATCH FINISHED · ROOM #${snapshot.roomCode}`)}
        <VictoryPodium
          roomCode={snapshot.roomCode}
          winnerSeat={snapshot.winner ?? 0}
          players={victoryPlayers}
          sessionId={sessionId}
          hostId={snapshot.host}
          rematching={rematching}
          message={message}
          onRematch={rematch}
          onLeave={leave}
        />
      </main>
    );
  }

  // =========================================================================
  // VIEW 4: ACTIVE 2D GAME ARENA
  // =========================================================================
  return (
    <main>
      {renderHeader(`ROOM #${snapshot.roomCode} · 2D ROYAL ARENA`)}

      <div className="game-screen-wrapper">
        {/* Floating Top Turn Status Banner */}
        <div className="turn-status-banner">
          <div className={`turn-headline ${isMyTurn ? 'your-turn' : ''}`}>
            <span>⚜</span>
            {isMyTurn ? (
              snapshot.dice === null ? (
                <span>YOUR TURN! Roll the dice.</span>
              ) : legal.length > 0 ? (
                <span>Select a glowing pawn to move {snapshot.dice} spaces.</span>
              ) : (
                <span>No legal moves for roll of {snapshot.dice}. Passing turn…</span>
              )
            ) : (
              <span>Waiting for {activePlayer?.name || 'Player'} ({activePlayer?.color?.toUpperCase()})…</span>
            )}
          </div>
          <button type="button" className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={leave}>
            Exit Table
          </button>
        </div>

        <div className="game-main-stage">
          {/* Main 2D Board Center Stage */}
          <div className="flex flex-col items-center gap-3">
            <div className="game-board">
              <Board2D
                players={snapshot.players}
                tokens={snapshot.tokens}
                currentPlayer={snapshot.currentPlayer}
                localSeat={localSeat}
                diceDisplay={rolling ? lastDice : snapshot.dice}
                legal={legal}
                onTokenClick={moveToken}
              />
            </div>

            {/* Accessible Mobile Bottom Sheet Token Picker */}
            {legal.length > 0 && isMyTurn && (
              <div className="mobile-token-picker-drawer w-full max-w-[680px]">
                <span className="picker-title">CHOOSE A PAWN TO ADVANCE:</span>
                <div className="picker-cards">
                  {legal.map((tokenIdx) => {
                    const t = snapshot.tokens[localSeat]?.[tokenIdx];
                    const label =
                      t?.kind === 'base'
                        ? `Pawn ${tokenIdx + 1} (Deploy)`
                        : t?.kind === 'home'
                        ? `Pawn ${tokenIdx + 1} (Home run)`
                        : `Pawn ${tokenIdx + 1} (Advance ${snapshot.dice})`;
                    return (
                      <button
                        key={tokenIdx}
                        type="button"
                        className="picker-btn"
                        onClick={() => {
                          AudioEngine.playHop();
                          moveToken(tokenIdx);
                        }}
                      >
                        <span className="text-amber-300">♟</span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right/Side Control Panel */}
          <aside className="side-panel">
            {/* Dedicated Tactile Dice Roller */}
            <div className="matchmaking-card flex flex-col items-center p-4">
              <span className="hero-eyebrow text-center mb-2">ROYAL DICE TRAY</span>
              <DiceRoller
                value={rolling ? lastDice : snapshot.dice}
                rolling={rolling}
                canRoll={isMyTurn && snapshot.dice === null}
                onRoll={rollDice}
                playerColor={activePlayer?.color}
                timeLeft={turnTimeLeft}
                maxTime={15}
              />
            </div>

            {/* Players HUD List */}
            <div className="flex flex-col gap-2">
              <span className="hero-eyebrow">SEAT TELEMETRY</span>
              {snapshot.players.map((p) => {
                const isActive = p.seat === snapshot.currentPlayer;
                const homeTokens =
                  snapshot.tokens[p.seat]?.filter((t) => t.kind === 'home' && t.progress === 6).length || 0;
                return (
                  <div key={p.id} className={`player-hud-card ${isActive ? 'active-turn' : ''}`}>
                    <div className="hud-player-info">
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{
                          background: colorHex[p.color] || '#aaa',
                          boxShadow: isActive ? `0 0 10px ${colorHex[p.color]}` : 'none',
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-white">
                          {p.name}
                          {p.id === sessionId ? ' (YOU)' : ''}
                        </span>
                        <span className="text-[10px] text-amber-200/80 font-mono">
                          {p.connected ? 'ONLINE' : 'RECONNECTING'}
                        </span>
                      </div>
                    </div>
                    <span className="hud-tokens-gauge">{homeTokens}/4 HOME</span>
                  </div>
                );
              })}
            </div>

            {message && <p className="text-amber-400 text-xs text-center p-2">{message}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
