import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import { legalTokens } from '@ludo/game-engine';
import { Board2D } from './Board2D';
import { LandingBoard2D } from './LandingBoard2D';
import { DiceRoller, MiniDiceCube, DiceFaceSVG } from './DiceRoller';
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
  turnExpiresAt?: number | null;
  turnDurationMs?: number;
  lastNotice?: { type: string; message: string; seat: number; playerName?: string; dice?: number; timestamp: number } | null;
};

const socket: Socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  auth: { sessionToken: localStorage.getItem('ludo-session') || '' },
});

const colorHex: Record<string, string> = {
  red: '#e63946',
  green: '#059669',
  yellow: '#f59e0b',
  blue: '#2563eb',
};

function initials(name: string) {
  return (name || 'PL').slice(0, 2).toUpperCase();
}

interface PlayerTelemetryCardProps {
  player: ClientPlayer;
  isLocal: boolean;
  isHost: boolean;
  isActiveTurn: boolean;
  dice: number | null;
  tokens: Array<{ kind: 'base' | 'path' | 'home'; progress: number }>;
  turnTimeLeft: number;
}

const PlayerTelemetryCard: React.FC<PlayerTelemetryCardProps> = ({
  player,
  isLocal,
  isHost,
  isActiveTurn,
  dice,
  tokens = [],
  turnTimeLeft,
}) => {
  const finishedCount = tokens.filter((t) => t.kind === 'home' && t.progress >= 6).length;
  const onBoardCount = tokens.filter((t) => t.kind === 'path' || (t.kind === 'home' && t.progress < 6)).length;
  const inYardCount = tokens.filter((t) => t.kind === 'base').length;

  return (
    <div
      className={`player-hud-card ${isActiveTurn ? 'active-turn' : ''}`}
      style={{
        borderLeft: `4px solid ${colorHex[player.color] || 'var(--accent-gold)'}`,
      }}
    >
      <div className="hud-card-top">
        <div className="hud-avatar-wrapper">
          <div
            className="hud-avatar"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${colorHex[player.color] || '#444'} 0%, #0d1e3a 100%)`,
            }}
          >
            {initials(player.name)}
          </div>
          {isHost && (
            <span className="hud-crown-badge" title="Room Host">
              👑
            </span>
          )}
        </div>

        <div className="hud-player-meta">
          <div className="hud-name-row">
            <span className="hud-name">{player.name}</span>
            {isLocal && <span className="hud-you-tag">YOU</span>}
          </div>
          <div className="hud-sub-row">
            <span className={`seat-pill seat-pill-${player.color}`}>
              {player.color.toUpperCase()}
            </span>
            <span className={player.connected ? 'conn-status-online' : 'conn-status-reconnecting'}>
              <span className={`status-dot-mini ${player.connected ? 'online' : 'reconnecting'}`} />
              <span>{player.connected ? 'ONLINE' : 'RECONNECTING'}</span>
            </span>
          </div>
        </div>

        {isActiveTurn && (
          <div className="hud-turn-badge animate-pulse">
            <span>{dice === null ? '🎲 ROLL' : `🎲 ${dice} · MOVE`}</span>
            <span className="ml-1 opacity-80">{turnTimeLeft}s</span>
          </div>
        )}
      </div>

      {/* Visual 4-Pawn Progress Gauge */}
      <div className="token-pips-row">
        <div className="token-pips-list" title={`${finishedCount} Finished, ${onBoardCount} on track, ${inYardCount} in yard`}>
          {[0, 1, 2, 3].map((idx) => {
            const t = tokens[idx];
            if (!t || t.kind === 'base') {
              return (
                <div key={idx} className="token-pip-slot base" title={`Pawn ${idx + 1}: In Yard`}>
                  <span>○</span>
                </div>
              );
            }
            if (t.kind === 'home') {
              if (t.progress >= 6) {
                return (
                  <div key={idx} className="token-pip-slot goal" title={`Pawn ${idx + 1}: Reached Home Goal!`}>
                    <span>★</span>
                  </div>
                );
              }
              return (
                <div key={idx} className="token-pip-slot home" title={`Pawn ${idx + 1}: Home Lane (Step ${t.progress + 1})`}>
                  <span>▲</span>
                </div>
              );
            }
            return (
              <div key={idx} className="token-pip-slot track" title={`Pawn ${idx + 1}: On Track`}>
                <span>♟</span>
              </div>
            );
          })}
        </div>
        <div className="hud-tokens-summary">
          <span>{finishedCount}/4 HOME</span>
        </div>
      </div>
    </div>
  );
};

interface MobilePlayerRibbonProps {
  players: ClientPlayer[];
  currentPlayer: number;
  localSeat: number;
  tokens: Array<Array<{ kind: 'base' | 'path' | 'home'; progress: number }>>;
  turnTimeLeft: number;
}

const MobilePlayerRibbon: React.FC<MobilePlayerRibbonProps> = ({
  players,
  currentPlayer,
  localSeat,
  tokens,
  turnTimeLeft,
}) => {
  return (
    <div className="mobile-player-ribbon" role="region" aria-label="Active players turn status">
      {players.map((p) => {
        const isActive = p.seat === currentPlayer;
        const playerTokens = tokens[p.seat] || [];
        const finished = playerTokens.filter((t) => t.kind === 'home' && t.progress >= 6).length;
        const isLocal = p.seat === localSeat;
        const isUrgent = isActive && turnTimeLeft <= 5 && turnTimeLeft > 0;

        return (
          <div
            key={p.id}
            className={`mobile-player-chip ${isActive ? 'chip-active-turn' : ''} ${isUrgent ? 'chip-urgent' : ''} ${
              !p.connected ? 'chip-offline' : ''
            }`}
            style={{
              borderColor: isActive ? colorHex[p.color] || 'var(--accent-gold)' : undefined,
            }}
          >
            <div
              className="chip-avatar"
              style={{
                backgroundColor: colorHex[p.color] || '#444',
              }}
            >
              {initials(p.name)}
            </div>
            <div className="chip-meta">
              <span className="chip-name">
                {p.name.length > 7 ? `${p.name.slice(0, 6)}…` : p.name}
                {isLocal ? ' (YOU)' : ''}
              </span>
              <span className="chip-score">{finished}/4 🏁</span>
            </div>
            {isActive && (
              <span className={`chip-timer-badge ${isUrgent ? 'timer-urgent' : ''}`}>
                {turnTimeLeft}s
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface MobileBottomDockProps {
  isMyTurn: boolean;
  dice: number | null;
  displayDice: number | null;
  rolling: boolean;
  isMoving: boolean;
  turnTimeLeft: number;
  legal: number[];
  tokens: Array<Array<{ kind: 'base' | 'path' | 'home'; progress: number }>>;
  localSeat: number;
  activePlayer?: ClientPlayer;
  activityNotice?: string | null;
  lastNotice?: { type: string; message: string; timestamp: number } | null;
  onRoll: () => void;
  onMoveToken: (tokenIdx: number) => void;
}

const MobileBottomDock: React.FC<MobileBottomDockProps> = ({
  isMyTurn,
  dice,
  displayDice,
  rolling,
  isMoving,
  turnTimeLeft,
  legal,
  tokens,
  localSeat,
  activePlayer,
  activityNotice,
  lastNotice,
  onRoll,
}) => {
  const isUrgent = turnTimeLeft <= 5 && turnTimeLeft > 0;
  const isRecentNotice = lastNotice && Date.now() - (lastNotice.timestamp || 0) < 4000;
  const canRoll = isMyTurn && dice === null && !rolling && !isMoving;
  const currentDiceValue = dice ?? displayDice ?? 6;

  // Determine prominent contextual message
  let contextMessage: string;
  let contextType: 'action' | 'waiting' | 'notice' | 'bonus' = 'waiting';

  if (isRecentNotice && lastNotice?.message && lastNotice.type === 'extra_turn') {
    contextMessage = lastNotice.message;
    contextType = 'bonus';
  } else if (activityNotice) {
    contextMessage = activityNotice;
    contextType = 'notice';
  } else if (isRecentNotice && lastNotice?.message) {
    contextMessage = lastNotice.message;
    contextType = 'notice';
  } else if (isMyTurn) {
    if (dice === null) {
      contextMessage = 'Your turn — Tap to roll!';
      contextType = 'action';
    } else if (dice === 6) {
      contextMessage = 'Bonus turn! Rolled a 6 — Choose a pawn';
      contextType = 'bonus';
    } else if (legal.length > 0) {
      contextMessage = `You rolled ${dice} — Choose a pawn to advance`;
      contextType = 'action';
    } else {
      contextMessage = `No legal moves for roll of ${dice} — turn passed`;
      contextType = 'notice';
    }
  } else {
    contextMessage = `Waiting for ${activePlayer?.name || 'Player'} (${activePlayer?.color?.toUpperCase() || ''})…`;
    contextType = 'waiting';
  }

  return (
    <div className="mobile-bottom-dock" role="region" aria-label="Game controls">
      {/* Unified Cohesive Mobile Control Card */}
      <div className={`mobile-unified-control-card ${canRoll ? 'card-active-turn' : ''} ${isUrgent && isMyTurn ? 'card-urgent' : ''}`}>
        {/* 1. Contextual Status Directive */}
        <div className={`mobile-control-directive ${contextType}`}>
          <span className="directive-icon">
            {contextType === 'bonus' ? '✨' : contextType === 'action' ? '👉' : contextType === 'notice' ? 'ℹ️' : '⏳'}
          </span>
          <span className="directive-text">{contextMessage}</span>
          {turnTimeLeft > 0 && (
            <span className={`directive-timer ${isUrgent ? 'timer-urgent' : ''}`}>
              {turnTimeLeft}s
            </span>
          )}
        </div>

        {/* 2. Central Dice Tray Area */}
        <div className="mobile-central-dice-area">
          <button
            type="button"
            className={`mobile-central-dice-btn ${rolling ? 'rolling-tumbling' : ''} ${canRoll ? 'can-roll-pulse' : 'disabled'} ${dice === 6 ? 'dice-is-six' : ''}`}
            onClick={() => {
              if (canRoll) onRoll();
            }}
            disabled={!canRoll}
            aria-label={canRoll ? 'Tap to roll dice' : `Dice value ${currentDiceValue}`}
            title={canRoll ? 'Tap to roll dice' : `Dice: ${currentDiceValue}`}
          >
            <DiceFaceSVG value={currentDiceValue} size={62} />
            <div className={`dice-corner-badge ${currentDiceValue === 6 ? 'badge-six' : ''}`}>
              {currentDiceValue}
            </div>
          </button>
        </div>

        {/* 3. Prominent "TAP TO ROLL" Button Directly Below the Dice */}
        <div className="mobile-roll-action-group">
          <button
            type="button"
            className={`mobile-prominent-roll-btn ${canRoll ? 'btn-can-roll' : 'btn-disabled'} ${isUrgent && canRoll ? 'btn-urgent-pulse' : ''}`}
            onClick={onRoll}
            disabled={!canRoll}
          >
            {rolling ? (
              <span className="animate-pulse">🎲 ROLLING…</span>
            ) : canRoll ? (
              <span>🎲 TAP TO ROLL {isUrgent ? `(${turnTimeLeft}s)` : ''}</span>
            ) : isMyTurn && dice !== null ? (
              <span>👉 CHOOSE A PAWN ({dice})</span>
            ) : (
              <span>⏳ WAITING FOR {activePlayer?.name?.toUpperCase() || 'PLAYER'} ({turnTimeLeft}s)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [name, setName] = useState(localStorage.getItem('ludo_player_name') || '');
  const [roomInput, setRoomInput] = useState(new URLSearchParams(location.search).get('room') || '');
  const [landingTab, setLandingTab] = useState<'create' | 'join'>('create');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [lastDice, setLastDice] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isMuted, setIsMuted] = useState(AudioEngine.isMuted());
  const [turnTimeLeft, setTurnTimeLeft] = useState(15);
  const [activityNotice, setActivityNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const canJoin = name.trim().length > 0 && name.trim().length <= 16;

  // Persist player name locally
  useEffect(() => {
    if (name.trim()) {
      localStorage.setItem('ludo_player_name', name.trim());
    }
  }, [name]);

  // Synchronized server-authoritative turn timer countdown
  useEffect(() => {
    if (snapshot?.status === 'playing') {
      const updateCountdown = () => {
        if (!snapshot.turnExpiresAt) {
          setTurnTimeLeft(15);
          return;
        }
        const diffMs = snapshot.turnExpiresAt - Date.now();
        const remSec = Math.max(0, Math.ceil(diffMs / 1000));
        setTurnTimeLeft(remSec);
      };
      updateCountdown();
      const interval = setInterval(updateCountdown, 250);
      return () => clearInterval(interval);
    }
  }, [snapshot?.status, snapshot?.turnExpiresAt, snapshot?.currentPlayer, snapshot?.version]);

  // Synchronize lastDice with snapshot whenever a dice roll occurs or is reported in state/notice
  useEffect(() => {
    if (snapshot?.dice !== null && snapshot?.dice !== undefined) {
      setLastDice(snapshot.dice);
    } else if (snapshot?.lastNotice && typeof (snapshot.lastNotice as any).dice === 'number') {
      setLastDice((snapshot.lastNotice as any).dice);
    }
  }, [snapshot?.dice, snapshot?.lastNotice]);

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
      setIsMoving(false);
    };
    const onDiceRolled = (data: {
      seat: number;
      playerName: string;
      value: number;
      hasLegalMoves: boolean;
      isExtraTurn: boolean;
    }) => {
      setRolling(true);
      AudioEngine.playDiceRoll();
      setLastDice(data.value);

      window.setTimeout(() => {
        setRolling(false);
        if (data.value === 6) {
          AudioEngine.playSix();
          triggerHaptic('success');
        }

        const isMe = data.seat === localSeat;
        let noticeText = '';
        if (isMe) {
          if (data.value === 6) {
            noticeText = '🎉 YOU ROLLED A 6! Bonus roll awarded — Select a glowing pawn.';
          } else if (data.hasLegalMoves) {
            noticeText = `🎲 YOU ROLLED A ${data.value}! Tap a glowing pawn on the board.`;
          } else {
            noticeText = `⚠️ YOU ROLLED A ${data.value} with no legal moves. Passing turn…`;
          }
        } else {
          if (data.value === 6) {
            noticeText = `🎉 ${data.playerName} rolled a 6! (Bonus roll awarded)`;
          } else if (data.hasLegalMoves) {
            noticeText = `🎲 ${data.playerName} rolled a ${data.value}.`;
          } else {
            noticeText = `⚠️ ${data.playerName} rolled a ${data.value} with no legal moves. Passing turn…`;
          }
        }
        setActivityNotice(noticeText);
        setTimeout(() => {
          setActivityNotice((cur) => (cur === noticeText ? null : cur));
        }, 3500);
      }, 450);
    };
    const onTimeout = (data: any) => {
      AudioEngine.playTimeout();
      const name = data.timedOutPlayer || 'Player';
      setActivityNotice(`⏰ ${name} timed out! Turn forfeited.`);
      setTimeout(() => setActivityNotice(null), 4000);
    };
    const onConnect = () => {
      setConnected(true);
      setMessage('');
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
    const onConnectError = () => {
      setConnected(false);
      setMessage('Connecting to game server… (Free-tier instances may take ~30s to wake up)');
    };

    socket.on('session', onSession);
    socket.on('lobby_updated', onState);
    socket.on('room_state', onState);
    socket.on('game_started', onState);
    socket.on('rematch_started', onState);
    socket.on('state', onState);
    socket.on('dice_rolled', onDiceRolled);
    socket.on('turn_timeout', onTimeout);
    socket.on('player_disconnected', onState);
    socket.on('player_reconnected', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // Auto-connect on mount so page refreshes recover session and active match
    if (!socket.connected) {
      socket.connect();
    }
    if (typeof window !== 'undefined') {
      (window as any).__SET_MOCK_SNAPSHOT__ = (s: Snapshot) => {
        setSessionId(s.players[0]?.id || 'p1');
        setSnapshot(s);
      };
      (window as any).__GET_SNAPSHOT__ = () => snapshotRef.current;
      (window as any).__SOCKET__ = socket;
    }
    return () => {
      socket.off('session', onSession);
      socket.off('lobby_updated', onState);
      socket.off('room_state', onState);
      socket.off('game_started', onState);
      socket.off('rematch_started', onState);
      socket.off('state', onState);
      socket.off('dice_rolled', onDiceRolled);
      socket.off('turn_timeout', onTimeout);
      socket.off('player_disconnected', onState);
      socket.off('player_reconnected', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  const connect = () => {
    if (!socket.connected) socket.connect();
  };

  const create = () => {
    if (isCreating) return;
    if (!canJoin) {
      setMessage('Please enter a display name (1–16 characters).');
      return;
    }
    setIsCreating(true);
    setMessage('Creating private room…');
    connect();

    const timeout = window.setTimeout(() => {
      setIsCreating(false);
      setMessage('Connecting to server… (Cold-start backend may take 20-30s. Please try again in a moment)');
    }, 10000);

    socket.emit('create_room', { name: name.trim() }, (result: any) => {
      clearTimeout(timeout);
      setIsCreating(false);
      if (!result?.ok) {
        setMessage(result?.error || 'Failed to create room. Please try again.');
        return;
      }
      localStorage.setItem('ludo-room', result.roomCode);
      setSnapshot(result.state);
      setMessage('Room created. Invite friends to join.');
    });
  };

  const join = () => {
    if (isJoining) return;
    if (!canJoin) {
      setMessage('Please enter your display name.');
      return;
    }
    if (roomInput.trim().length !== 6) {
      setMessage('Please enter a valid 6-character room code.');
      return;
    }
    setIsJoining(true);
    setMessage('Entering salon table…');
    connect();

    const timeout = window.setTimeout(() => {
      setIsJoining(false);
      setMessage('Connecting to server… Please verify code and try again.');
    }, 10000);

    socket.emit('join_room', { roomCode: roomInput.trim().toUpperCase(), name: name.trim() }, (result: any) => {
      clearTimeout(timeout);
      setIsJoining(false);
      if (!result?.ok) {
        setMessage(result?.error || 'Unable to join room. Verify the code.');
        return;
      }
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

  function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'light') navigator.vibrate(15);
        else if (type === 'medium') navigator.vibrate(30);
        else if (type === 'success') navigator.vibrate([25, 40, 25]);
      } catch {}
    }
  }

  const copyInvite = () => {
    if (!snapshot) return;
    navigator.clipboard?.writeText(`${location.origin}/?room=${snapshot.roomCode}`);
    setCopiedInvite(true);
    triggerHaptic('light');
    setMessage('Invite link copied to clipboard!');
    setTimeout(() => {
      setCopiedInvite(false);
      setMessage('');
    }, 2500);
  };

  const copyCode = () => {
    if (!snapshot) return;
    navigator.clipboard?.writeText(snapshot.roomCode);
    setCopiedCode(true);
    triggerHaptic('light');
    setMessage('Room code copied to clipboard!');
    setTimeout(() => {
      setCopiedCode(false);
      setMessage('');
    }, 2500);
  };

  const toggleSound = () => {
    const muted = AudioEngine.toggleMute();
    setIsMuted(muted);
    triggerHaptic('light');
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
    triggerHaptic('medium');
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
        if (result.value === 6) {
          AudioEngine.playSix();
          triggerHaptic('success');
        }
        if (result.state) setSnapshot(result.state);
        window.setTimeout(() => setRolling(false), 550);
      }
    );
  };

  const moveToken = (token: number) => {
    if (!snapshot || isMoving || !legal.includes(token)) return;
    setIsMoving(true);
    triggerHaptic('light');
    const currentToken = snapshot.tokens[localSeat]?.[token];
    const isDeploy = currentToken?.kind === 'base';
    const actionId = `move_${snapshot.version}_${token}_${Date.now()}`;
    socket.emit(
      'move_token',
      { roomCode: snapshot.roomCode, token, actionId, expectedVersion: snapshot.version },
      (result: any) => {
        setIsMoving(false);
        if (!result?.ok) {
          setMessage(result?.error || 'That pawn cannot move');
          if (result?.state) setSnapshot(result.state);
        } else {
          setMessage('');
          if (isDeploy) {
            AudioEngine.playExit();
            triggerHaptic('success');
          } else {
            AudioEngine.playHop();
          }
          if (result?.state) setSnapshot(result.state);
        }
      }
    );
  };

  // Header Component
  const renderHeader = (badgeText: string, actions?: React.ReactNode) => (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-logo">
          LUDO<span>•</span>
        </div>
        <div className="header-status-badge">
          <span className={`status-dot ${connected ? '' : 'reconnecting'}`} />
          <span className="header-badge-text">{badgeText}</span>
        </div>
      </div>
      <div className="header-controls">
        {actions}
        <button
          type="button"
          className="sound-toggle-btn"
          onClick={toggleSound}
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        {snapshot && snapshot.status !== 'lobby' && (
          <button
            type="button"
            className="btn-header-exit"
            onClick={leave}
            title="Exit Game"
          >
            Exit
          </button>
        )}
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
                    onClick={() => {
                      setLandingTab('create');
                      setMessage('');
                    }}
                  >
                    Create Private Room
                  </button>
                  <button
                    type="button"
                    className={`tab-nav-btn ${landingTab === 'join' ? 'active' : ''}`}
                    onClick={() => {
                      setLandingTab('join');
                      setMessage('');
                    }}
                  >
                    Join with Code
                  </button>
                </div>

                <div className="input-group">
                  <label className="input-label">Your Display Name</label>
                  <input
                    className="royal-input"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (message) setMessage('');
                    }}
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
                      onChange={(e) => {
                        setRoomInput(e.target.value.toUpperCase());
                        if (message) setMessage('');
                      }}
                      maxLength={6}
                      placeholder="ROOM CODE"
                    />
                  </div>
                )}

                {landingTab === 'create' ? (
                  <button
                    type="button"
                    className="cta-button"
                    disabled={!canJoin || isCreating}
                    onClick={create}
                  >
                    {isCreating ? (
                      <>
                        <span className="animate-spin inline-block mr-2">◌</span>
                        <span>Creating Salon…</span>
                      </>
                    ) : (
                      <>
                        <span>Create Private Salon</span> <span>👑</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cta-button"
                    disabled={!canJoin || roomInput.trim().length !== 6 || isJoining}
                    onClick={join}
                  >
                    {isJoining ? (
                      <>
                        <span className="animate-spin inline-block mr-2">◌</span>
                        <span>Entering Salon…</span>
                      </>
                    ) : (
                      <>
                        <span>Enter Room Table</span> <span>⚔️</span>
                      </>
                    )}
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
          rankings={snapshot.rankings || []}
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
  const roomActions = (
    <div
      className="header-room-pill"
      onClick={copyCode}
      title="Tap to copy Room Code"
      role="button"
      tabIndex={0}
    >
      <span className="room-pill-icon">📋</span>
      <span className="room-pill-code">#{snapshot.roomCode}</span>
      {copiedCode && <span className="room-pill-feedback">COPIED!</span>}
    </div>
  );

  const displayDiceValue = rolling ? lastDice : (snapshot.dice ?? lastDice);

  return (
    <main className="game-screen-main">
      {renderHeader(`ROOM #${snapshot.roomCode} · 2D ROYAL ARENA`, roomActions)}

      <div className="game-screen-wrapper">
        {/* Mobile Horizontal Player Ribbon (Hidden on Desktop >= 1024px) */}
        <MobilePlayerRibbon
          players={snapshot.players}
          currentPlayer={snapshot.currentPlayer}
          localSeat={localSeat}
          tokens={snapshot.tokens}
          turnTimeLeft={turnTimeLeft}
        />

        {/* Desktop-only Turn Status Banner (Hidden on Mobile < 1024px) */}
        <div
          className={`turn-status-banner desktop-only ${isMyTurn ? 'banner-my-turn' : ''} ${
            turnTimeLeft <= 5 && turnTimeLeft > 0 ? 'banner-urgent' : ''
          }`}
        >
          <div className="turn-headline">
            <span className="turn-insignia">⚜</span>
            {activityNotice ? (
              <span className="turn-notice-flash animate-pulse">{activityNotice}</span>
            ) : snapshot.lastNotice && Date.now() - (snapshot.lastNotice.timestamp || 0) < 4000 ? (
              <span className="turn-notice-flash">
                {snapshot.lastNotice.type === 'timeout' && '⏰ '}
                {snapshot.lastNotice.type === 'three_sixes' && '⚠️ '}
                {snapshot.lastNotice.type === 'auto_pass' && '⏭️ '}
                {snapshot.lastNotice.type === 'extra_turn' && '✨ '}
                {snapshot.lastNotice.message}
              </span>
            ) : isMyTurn ? (
              snapshot.dice === null ? (
                <span className="turn-text-highlight">
                  YOUR TURN: Tap the dice in the tray to roll!
                  {turnTimeLeft <= 5 && turnTimeLeft > 0 && (
                    <span className="timer-urgent-pill ml-2">⏳ {turnTimeLeft}s left</span>
                  )}
                </span>
              ) : snapshot.dice === 6 ? (
                <span className="turn-text-highlight">
                  🎉 ROLLED A 6! Deploy from yard or advance 6 (Bonus Roll awarded!). Select a glowing pawn.
                  {turnTimeLeft <= 5 && turnTimeLeft > 0 && (
                    <span className="timer-urgent-pill ml-2">⏳ {turnTimeLeft}s left</span>
                  )}
                </span>
              ) : legal.length > 0 ? (
                <span className="turn-text-highlight">
                  YOUR TURN: Select a glowing pawn to move {snapshot.dice}{' '}
                  {snapshot.dice === 1 ? 'space' : 'spaces'}.
                  {turnTimeLeft <= 5 && turnTimeLeft > 0 && (
                    <span className="timer-urgent-pill ml-2">⏳ {turnTimeLeft}s left</span>
                  )}
                </span>
              ) : (
                <span>No legal moves for roll of {snapshot.dice}. Passing turn…</span>
              )
            ) : (
              <span>
                Waiting for <strong className="text-white">{activePlayer?.name || 'Player'}</strong> (
                <span style={{ color: colorHex[activePlayer?.color || 'red'] }}>
                  {activePlayer?.color?.toUpperCase()}
                </span>
                )…
                <span className="opacity-80 text-xs ml-2 font-mono">({turnTimeLeft}s)</span>
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            onClick={leave}
          >
            Exit Table
          </button>
        </div>

        <div className="game-main-stage">
          {/* Main 2D Board Stage */}
          <div className="board-column">
            <div className="game-board-container">
              <Board2D
                players={snapshot.players}
                tokens={snapshot.tokens}
                currentPlayer={snapshot.currentPlayer}
                localSeat={localSeat}
                diceDisplay={displayDiceValue}
                legal={legal}
                isMoving={isMoving}
                onTokenClick={moveToken}
              />
            </div>

            {/* Mobile Bottom Dock (Thumb-reachable, rendered below board on mobile) */}
            <MobileBottomDock
              isMyTurn={isMyTurn}
              dice={snapshot.dice}
              displayDice={displayDiceValue}
              rolling={rolling}
              isMoving={isMoving}
              turnTimeLeft={turnTimeLeft}
              legal={legal}
              tokens={snapshot.tokens}
              localSeat={localSeat}
              activePlayer={activePlayer}
              activityNotice={activityNotice}
              lastNotice={snapshot.lastNotice}
              onRoll={rollDice}
              onMoveToken={moveToken}
            />
          </div>

          {/* Desktop Right Side Control & Telemetry Panel (Hidden on Mobile < 1024px) */}
          <aside className="side-panel desktop-only">
            {/* Dedicated Tactile Royal Dice Tray */}
            <div className="dice-tray-card">
              <span className="hero-eyebrow text-center mb-1">ROYAL DICE TRAY</span>
              <DiceRoller
                value={displayDiceValue}
                activeDice={snapshot.dice}
                rolling={rolling}
                canRoll={isMyTurn && snapshot.dice === null}
                isMyTurn={isMyTurn}
                onRoll={rollDice}
                playerColor={activePlayer?.color}
                playerName={activePlayer?.name}
                timeLeft={turnTimeLeft}
                maxTime={15}
              />
            </div>

            {/* Players HUD / Telemetry List */}
            <div className="telemetry-section">
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="hero-eyebrow">SEAT TELEMETRY</span>
                <span className="text-[10px] font-mono text-amber-300/80">
                  {snapshot.players.length}/4 ACTIVE
                </span>
              </div>

              <div className="telemetry-list">
                {snapshot.players.map((p) => {
                  const isActive = p.seat === snapshot.currentPlayer;
                  return (
                    <PlayerTelemetryCard
                      key={p.id}
                      player={p}
                      isLocal={p.id === sessionId}
                      isHost={p.id === snapshot.host}
                      isActiveTurn={isActive}
                      dice={snapshot.dice}
                      tokens={snapshot.tokens[p.seat] || []}
                      turnTimeLeft={turnTimeLeft}
                    />
                  );
                })}
              </div>
            </div>

            {message && <p className="text-amber-400 text-xs text-center p-2">{message}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
