import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import { legalTokens } from '@ludo/game-engine';
import { AudioEngine } from './AudioEngine';
import { Board2D } from './Board2D';
import { LandingBoard2D } from './LandingBoard2D';
import { DiceFaceSVG, DiceRoller } from './DiceRoller';
import { ShareModal } from './ShareModal';
import { SettingsModal } from './SettingsModal';
import { ActivityFeed, ActivityItem } from './ActivityFeed';
import { VictoryPodium } from './VictoryPodium';
import { GameBackground } from './GameBackground';
import { PlayerAvatar } from './PlayerAvatar';
import { RoomInfoBar } from './RoomInfoBar';
import { TurnIndicatorBar } from './TurnIndicatorBar';
import './style.css';

const socket: Socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  auth: { sessionToken: localStorage.getItem('ludo-session') || '' },
});

type Token = { kind: 'base' | 'path' | 'home'; progress: number };
type ClientPlayer = { id: string; name: string; color: string; seat: number; connected?: boolean };

type LastNotice = {
  type: 'timeout' | 'three_sixes' | 'auto_pass' | 'extra_turn';
  seat: number;
  message: string;
  timestamp: number;
  dice?: number;
};

type Snapshot = {
  roomCode: string;
  status: 'lobby' | 'playing' | 'finished';
  players: ClientPlayer[];
  currentPlayer: number;
  dice: number | null;
  turnExpiresAt: number;
  tokens: Token[][];
  winner: number | null;
  rankings?: number[];
  host: string;
  version: number;
  lastNotice?: LastNotice;
};

const colorHex: Record<string, string> = {
  red: '#ED3945',
  green: '#08A66A',
  yellow: '#FFAA13',
  blue: '#3978F6',
};

const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (style === 'light') navigator.vibrate(10);
      else if (style === 'medium') navigator.vibrate(25);
      else if (style === 'heavy') navigator.vibrate(45);
      else if (style === 'success') navigator.vibrate([20, 40, 20]);
      else if (style === 'warning') navigator.vibrate([30, 50, 30]);
    } catch {
      // Ignore vibration errors
    }
  }
};

/**
 * Desktop Side Panel Player Telemetry Card
 */
const PlayerTelemetryCard: React.FC<{
  player: ClientPlayer;
  isLocal: boolean;
  isHost: boolean;
  isActiveTurn: boolean;
  dice: number | null;
  tokens: Token[];
  turnTimeLeft: number;
}> = ({ player, isLocal, isHost, isActiveTurn, dice, tokens, turnTimeLeft }) => {
  const finishedCount = tokens.filter((t) => t.kind === 'home' && t.progress >= 6).length;
  const isUrgent = isActiveTurn && turnTimeLeft <= 5 && turnTimeLeft > 0;

  return (
    <div
      className={`player-hud-card ${isActiveTurn ? 'active-turn' : ''} ${
        isUrgent ? 'urgent-border' : ''
      } ${!player.connected ? 'player-disconnected' : ''}`}
      style={{
        borderColor: isActiveTurn ? 'var(--accent-violet, #7650F5)' : undefined,
      }}
    >
      <div className="hud-card-top-row">
        <PlayerAvatar
          seat={player.seat}
          name={player.name}
          size={38}
          isHost={isHost}
        />

        <div className="hud-identity">
          <div className="hud-name-row">
            <span className="hud-player-name">{player.name}</span>
            {isLocal && <span className="hud-badge-local">YOU</span>}
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
          <div className="turn-timer-chip-yellow">
            <span>⏱ {turnTimeLeft}s</span>
          </div>
        )}
      </div>

      {/* Visual 4-Pawn Progress Dots */}
      <div className="token-pips-row">
        <div className="token-pips-list">
          {[0, 1, 2, 3].map((idx) => {
            const t = tokens[idx];
            const isHome = t && t.kind === 'home' && t.progress >= 6;
            return (
              <span
                key={idx}
                className={`master-token-dot ${isHome ? 'dot-finished' : 'dot-active'}`}
                style={{
                  backgroundColor: isHome ? colorHex[player.color] || '#ED3945' : 'rgba(255, 255, 255, 0.25)',
                }}
              />
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

/**
 * Mobile Horizontal Player Ribbon
 * Recreating the compact horizontal player cards row from the master screenshot.
 */
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
            className={`master-player-card ${isActive ? 'card-active-glow' : ''} ${
              !p.connected ? 'chip-offline' : ''
            }`}
          >
            <PlayerAvatar
              seat={p.seat}
              name={p.name}
              size={32}
              isHost={p.seat === 0}
            />

            <div className="master-card-info">
              <span className="master-card-name" title={p.name}>
                {p.name}{isLocal ? ' (You)' : ''}
              </span>
              <div className="master-card-progress">
                <span className="master-home-text">{finished}/4</span>
                <div className="master-token-dots">
                  {[0, 1, 2, 3].map((idx) => {
                    const t = playerTokens[idx];
                    const isHome = t && t.kind === 'home' && t.progress >= 6;
                    return (
                      <span
                        key={idx}
                        className="master-token-dot"
                        style={{
                          backgroundColor: isHome
                            ? colorHex[p.color] || '#ED3945'
                            : 'rgba(255, 255, 255, 0.25)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {!p.connected && <span className="chip-offline-badge">OFFLINE</span>}

            {/* Bright Yellow Timer Badge when it is this player's active turn */}
            {isActive && p.connected && (
              <div className={`master-turn-badge-yellow ${isUrgent ? 'badge-urgent-pulse' : ''}`}>
                <span className="badge-clock-icon">⏱</span>
                <span>{turnTimeLeft}s</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Mobile Bottom Controls Area
 * Recreating the elevated violet dome stage, tactile ivory dice,
 * massive golden-yellow TAP TO ROLL button, and flanking chat/activity controls.
 */
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
  lastNotice?: LastNotice | null;
  unreadCount?: number;
  onRoll: () => void;
  onMoveToken: (tokenIdx: number) => void;
  onOpenShare: () => void;
  onOpenActivity: () => void;
}

const MobileBottomDock: React.FC<MobileBottomDockProps> = ({
  isMyTurn,
  dice,
  displayDice,
  rolling,
  isMoving,
  turnTimeLeft,
  legal = [],
  activePlayer,
  lastNotice,
  unreadCount = 5,
  onRoll,
  onOpenShare,
  onOpenActivity,
}) => {
  const isUrgent = turnTimeLeft <= 5 && turnTimeLeft > 0;
  const canRoll = isMyTurn && dice === null && !rolling && !isMoving;
  const currentDiceValue = dice ?? displayDice ?? 6;

  let contextMessage = '';
  let contextType = 'normal';
  if (lastNotice && Date.now() - lastNotice.timestamp < 6000) {
    contextMessage = lastNotice.message;
    contextType = lastNotice.type === 'extra_turn' ? 'bonus' : 'notice';
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
    contextMessage = `Waiting for ${activePlayer?.name || 'Player'}…`;
    contextType = 'waiting';
  }

  return (
    <div className="master-bottom-dock mobile-bottom-dock" role="region" aria-label="Game controls">
      {/* Contextual Status Directive */}
      <div className={`mobile-control-directive ${contextType} sr-only`} aria-live="polite">
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
      {/* Flanking Left Controls */}
      <div className="dock-flank dock-flank-left">
        <button
          type="button"
          className="dock-icon-btn btn-chat"
          onClick={onOpenActivity}
          title="Chat & Activity"
          aria-label="Chat"
        >
          <span>💬</span>
        </button>
        <button
          type="button"
          className="dock-icon-btn btn-players"
          onClick={onOpenShare}
          title="Players & Share"
          aria-label="Players"
        >
          <span>👥</span>
        </button>
      </div>

      {/* Center Elevated Violet Dome Stage with Tactile Ivory Dice */}
      <div className="dock-center-stage mobile-unified-control-card">
        <div className={`master-dice-elevated-mound mobile-central-dice-area ${canRoll ? 'mound-glow-active' : ''}`}>
          {/* Action Sparkle Lines */}
          {canRoll && (
            <div className="dice-action-sparkles" aria-hidden="true">
              <span className="sparkle-ray ray-1" />
              <span className="sparkle-ray ray-2" />
              <span className="sparkle-ray ray-3" />
            </div>
          )}

          <button
            type="button"
            className={`master-tactile-dice-btn ${rolling ? 'rolling-tumbling' : ''} ${
              canRoll ? 'can-roll-pulse' : 'disabled'
            }`}
            onClick={() => {
              if (canRoll) onRoll();
            }}
            disabled={!canRoll}
            aria-label={canRoll ? 'Tap to roll dice' : `Dice value ${currentDiceValue}`}
            title={canRoll ? 'Tap to roll dice' : `Dice: ${currentDiceValue}`}
          >
            <DiceFaceSVG value={currentDiceValue} size={64} />
          </button>
        </div>

        {/* Massive Golden-Yellow TAP TO ROLL Primary Button */}
        <button
          type="button"
          className={`master-tap-roll-btn mobile-prominent-roll-btn ${canRoll ? 'btn-can-roll' : 'btn-disabled'} ${
            isUrgent && canRoll ? 'btn-urgent-pulse' : ''
          }`}
          onClick={onRoll}
          disabled={!canRoll}
        >
          {rolling ? (
            <span className="animate-pulse">🎲 ROLLING…</span>
          ) : canRoll ? (
            <span>🎲 TAP TO ROLL</span>
          ) : isMyTurn && dice !== null ? (
            <span>👉 CHOOSE A PAWN ({dice})</span>
          ) : (
            <span>⏳ WAITING FOR {activePlayer?.name?.toUpperCase() || 'PLAYER'}</span>
          )}
        </button>
      </div>

      {/* Flanking Right Controls */}
      <div className="dock-flank dock-flank-right">
        <button
          type="button"
          className="dock-activity-pill-btn btn-feed"
          onClick={onOpenActivity}
          title="Match Activity Feed"
          aria-label="Activity Feed"
        >
          <span className="activity-icon">≣</span>
          <span className="activity-label">Activity</span>
          <span className="activity-unread-badge">{unreadCount}</span>
        </button>
      </div>
    </div>
  );
};

function App() {
  const [name, setName] = useState(localStorage.getItem('ludo_player_name') || '');
  const [roomInput, setRoomInput] = useState(new URLSearchParams(location.search).get('room') || '');
  const [landingTab, setLandingTab] = useState<'create' | 'join'>(() => {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).get('room') ? 'join' : 'create';
  });
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(() => {
    const saved = localStorage.getItem('ludo_haptic_enabled');
    return saved === null ? true : saved === 'true';
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem('ludo_reduced_motion');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const canJoin = name.trim().length > 0 && name.trim().length <= 16;

  // Persist player name locally
  useEffect(() => {
    if (name.trim()) {
      localStorage.setItem('ludo_player_name', name.trim());
    }
  }, [name]);

  const toggleSound = () => {
    const muted = AudioEngine.toggleMute();
    setIsMuted(muted);
  };

  const toggleHaptic = () => {
    const next = !hapticEnabled;
    setHapticEnabled(next);
    localStorage.setItem('ludo_haptic_enabled', String(next));
    if (next) triggerHaptic('light');
  };

  const toggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    localStorage.setItem('ludo_reduced_motion', String(next));
  };

  const addActivityItem = (item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    setActivityLog((prev) => [
      {
        ...item,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      },
      ...prev.slice(0, 39),
    ]);
  };

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

      const pColor = snapshotRef.current?.players.find((p) => p.seat === data.seat)?.color;
      addActivityItem({
        type: data.value === 6 ? 'bonus' : 'dice',
        icon: data.value === 6 ? '🎉' : '🎲',
        message: data.value === 6
          ? `${data.playerName} rolled a 6! (Bonus roll awarded)`
          : !data.hasLegalMoves
            ? `${data.playerName} rolled a ${data.value} (No legal moves)`
            : `${data.playerName} rolled a ${data.value}`,
        seat: data.seat,
        color: pColor,
      });

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
    const onTokenMoved = (data: {
      seat: number;
      playerName: string;
      token: number;
      captured: boolean;
      winner: boolean;
      finished: boolean;
      pawnReachedHome: boolean;
      rank?: number;
    }) => {
      const pColor = snapshotRef.current?.players.find((p) => p.seat === data.seat)?.color;
      if (data.captured) {
        AudioEngine.playCapture();
        triggerHaptic('medium');
        addActivityItem({
          type: 'capture',
          icon: '⚔️',
          message: `${data.playerName} captured an opponent's pawn! (Bonus turn)`,
          seat: data.seat,
          color: pColor,
        });
      } else if (data.winner || data.finished) {
        AudioEngine.playWin();
        triggerHaptic('success');
        addActivityItem({
          type: 'finish',
          icon: '🏆',
          message: `${data.playerName} finished all 4 pawns (Rank #${data.rank || 1})!`,
          seat: data.seat,
          color: pColor,
        });
      } else if (data.pawnReachedHome) {
        AudioEngine.playHome();
        triggerHaptic('success');
        addActivityItem({
          type: 'home',
          icon: '🎯',
          message: `${data.playerName}'s pawn entered home goal!`,
          seat: data.seat,
          color: pColor,
        });
      } else {
        const prevTokens = snapshotRef.current?.tokens;
        const wasInYard = prevTokens && prevTokens[data.seat]?.[data.token]?.kind === 'base';
        if (wasInYard) {
          AudioEngine.playMove();
          addActivityItem({
            type: 'deploy',
            icon: '🚀',
            message: `${data.playerName} deployed pawn to start.`,
            seat: data.seat,
            color: pColor,
          });
        } else {
          AudioEngine.playMove();
          addActivityItem({
            type: 'move',
            icon: '♟️',
            message: `${data.playerName} moved pawn.`,
            seat: data.seat,
            color: pColor,
          });
        }
      }
    };
    const onTimeout = (data: any) => {
      AudioEngine.playTimeout();
      const name = data.timedOutPlayer || 'Player';
      setActivityNotice(`⏰ ${name} timed out! Turn forfeited.`);
      setTimeout(() => setActivityNotice(null), 4000);
      addActivityItem({
        type: 'timeout',
        icon: '⏰',
        message: `${name} timed out! Turn forfeited.`,
        seat: data.seat,
      });
    };
    const onPlayerDisconnect = (data: Snapshot) => {
      onState(data);
      addActivityItem({
        type: 'disconnect',
        icon: '📡',
        message: 'A player disconnected (waiting for reconnect).',
      });
    };
    const onPlayerReconnect = (data: Snapshot) => {
      onState(data);
      addActivityItem({
        type: 'reconnect',
        icon: '🟢',
        message: 'A player reconnected to the match.',
      });
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
      setMessage('Connecting to game server…');
    };

    socket.on('session', onSession);
    socket.on('lobby_updated', onState);
    socket.on('room_state', onState);
    socket.on('game_started', onState);
    socket.on('rematch_started', onState);
    socket.on('state', onState);
    socket.on('dice_rolled', onDiceRolled);
    socket.on('token_moved', onTokenMoved);
    socket.on('turn_timeout', onTimeout);
    socket.on('player_disconnected', onPlayerDisconnect);
    socket.on('player_reconnected', onPlayerReconnect);
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
      socket.off('token_moved', onTokenMoved);
      socket.off('turn_timeout', onTimeout);
      socket.off('player_disconnected', onPlayerDisconnect);
      socket.off('player_reconnected', onPlayerReconnect);
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
      setMessage('Connecting to server… Please try again in a moment');
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

  const copyCode = () => {
    if (!snapshot) return;
    navigator.clipboard?.writeText(snapshot.roomCode);
    setCopiedCode(true);
    triggerHaptic('light');
    setMessage('Room code copied to clipboard!');
    setTimeout(() => {
      setCopiedCode(false);
      setMessage('');
    }, 2000);
  };

  const copyInvite = () => {
    if (!snapshot) return;
    const url = `${window.location.origin}?room=${snapshot.roomCode}`;
    navigator.clipboard?.writeText(url);
    setCopiedInvite(true);
    triggerHaptic('light');
    setMessage('Invite link copied!');
    setTimeout(() => {
      setCopiedInvite(false);
      setMessage('');
    }, 2000);
  };

  const localPlayer = snapshot?.players.find((p) => p.id === sessionId);
  const localSeat = localPlayer?.seat ?? -1;
  const isMyTurn = snapshot ? snapshot.status === 'playing' && snapshot.currentPlayer === localSeat : false;
  const activePlayer = snapshot?.players.find((p) => p.seat === snapshot.currentPlayer);

  const legal = useMemo(
    () =>
      snapshot && snapshot.dice !== null && localSeat === snapshot.currentPlayer
        ? legalTokens(snapshot as any, localSeat as any, snapshot.dice)
        : [],
    [snapshot, localSeat]
  );

  /**
   * Master Design Top Header
   * Matching 3-color clover logo + LUDO + MULTIPLAYER pill + circular controls.
   */
  const renderHeader = (actions?: React.ReactNode) => (
    <>
      <header className="master-app-header app-header">
        <div className="master-brand-area brand-wrapper">
          {/* 3-Color Clover Formation Dots */}
          <div className="ludo-clover-dots" aria-hidden="true">
            <span className="clover-dot dot-coral" />
            <span className="clover-dot dot-emerald" />
            <span className="clover-dot dot-amber" />
          </div>

          <span className="master-brand-title brand-logo">LUDO</span>
          <span className="master-badge-multiplayer">MULTIPLAYER</span>
        </div>

        {/* Circular Icon Action Controls */}
        <div className="header-controls">
          {actions}

          <button
            type="button"
            className="master-circle-btn sound-toggle-btn"
            onClick={toggleSound}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <span>{isMuted ? '🔇' : '🔊'}</span>
          </button>

          <button
            type="button"
            className="master-circle-btn btn-settings"
            onClick={() => {
              triggerHaptic('light');
              setSettingsModalOpen(true);
            }}
            title="Game Settings"
            aria-label="Settings"
          >
            <span>⚙️</span>
          </button>

          {snapshot && (
            <button
              type="button"
              className="master-circle-btn btn-share"
              onClick={() => {
                triggerHaptic('light');
                setShareModalOpen(true);
              }}
              title="Share Room / QR"
              aria-label="Share Room"
            >
              <span>🔗</span>
            </button>
          )}

          {snapshot && (
            <button
              type="button"
              className="master-circle-btn btn-feed"
              onClick={() => {
                triggerHaptic('light');
                setActivityFeedOpen((prev) => !prev);
              }}
              title="Match Activity Feed"
              aria-label="Activity Feed"
            >
              <span>📜</span>
              {activityLog.length > 0 && (
                <span className="activity-unread-badge">{activityLog.length}</span>
              )}
            </button>
          )}

          {snapshot && snapshot.status !== 'lobby' && (
            <button
              type="button"
              className="master-exit-btn btn-header-exit"
              onClick={leave}
              title="Exit Match"
            >
              Exit Table
            </button>
          )}
        </div>
      </header>

      {!connected && (
        <div className="reconnect-floating-banner" role="alert">
          <span className="reconnect-spinner" />
          <span>Reconnecting to game server… Actions locked.</span>
        </div>
      )}
    </>
  );

  const renderModals = () => (
    <>
      {snapshot && (
        <ShareModal
          roomCode={snapshot.roomCode}
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          triggerHaptic={triggerHaptic}
        />
      )}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        soundEnabled={!isMuted}
        onToggleSound={toggleSound}
        hapticEnabled={hapticEnabled}
        onToggleHaptic={toggleHaptic}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={toggleReducedMotion}
        onLeaveMatch={() => {
          setSettingsModalOpen(false);
          leave();
        }}
        triggerHaptic={triggerHaptic}
      />
      <ActivityFeed
        items={activityLog}
        isOpen={activityFeedOpen}
        onToggle={() => setActivityFeedOpen((prev) => !prev)}
        onClose={() => setActivityFeedOpen(false)}
      />
    </>
  );

  // =========================================================================
  // VIEW 1: LANDING & MATCHMAKING
  // =========================================================================
  if (!snapshot) {
    return (
      <GameBackground>
        <main className={`landing-page-root ${reducedMotion ? 'reduced-motion' : ''}`}>
          {renderHeader()}
          <div className="landing-stage">
            <section className="landing-content-grid">
              {/* Left Column: Hero Storytelling & Table Console */}
              <div className="hero-column">
                <div className="hero-badge-eyebrow">
                  <span className="eyebrow-insignia">🎲</span>
                  <span>ONLINE MULTIPLAYER ARENA</span>
                </div>

                <h1 className="hero-headline">
                  ROLL THE DICE.<br />
                  <span className="hero-headline-accent">RULE THE BOARD.</span>
                </h1>

                <p className="hero-subtitle">
                  Your friends, your private table. Classic 4-player Ludo online with server-authoritative rules and instant zero-install play.
                </p>

                {/* Table Entry Console */}
                <div className="table-entry-card master-card">
                  <div className="table-entry-header">
                    <div className="table-entry-tab-group" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={landingTab === 'create'}
                        className={`table-tab-pill ${landingTab === 'create' ? 'active' : ''}`}
                        onClick={() => {
                          triggerHaptic('light');
                          setLandingTab('create');
                          setMessage('');
                        }}
                      >
                        <span className="pill-icon">👑</span>
                        <span>Create Private Table</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={landingTab === 'join'}
                        className={`table-tab-pill ${landingTab === 'join' ? 'active' : ''}`}
                        onClick={() => {
                          triggerHaptic('light');
                          setLandingTab('join');
                          setMessage('');
                        }}
                      >
                        <span className="pill-icon">🔑</span>
                        <span>Join With Code</span>
                      </button>
                    </div>
                  </div>

                  <div className="table-entry-body">
                    {/* Player Display Name */}
                    <div className="table-input-block">
                      <label className="table-input-label" htmlFor="player-name-input">
                        <span>YOUR GUEST NAME</span>
                        <span className="label-aux">1–16 characters</span>
                      </label>
                      <div className="table-input-row-with-avatar">
                        <div className="table-avatar-preview" title="Your Character">
                          <PlayerAvatar seat={0} name={name || 'Player'} size={44} />
                        </div>
                        <div className="table-input-container">
                          <span className="input-prefix-icon">👤</span>
                          <input
                            id="player-name-input"
                            className="royal-input table-name-input"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if (message) setMessage('');
                            }}
                            maxLength={16}
                            placeholder="Enter your name"
                            autoFocus
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Room Code (Visible when in Join tab) */}
                    {landingTab === 'join' && (
                      <div className="table-input-block">
                        <label className="table-input-label" htmlFor="room-code-input">
                          <span>6-DIGIT ROOM CODE</span>
                          <span className="label-aux">From room invitation</span>
                        </label>
                        <div className="table-input-container">
                          <span className="input-prefix-icon">#</span>
                          <input
                            id="room-code-input"
                            className="royal-input code-input table-code-input"
                            value={roomInput}
                            onChange={(e) => {
                              setRoomInput(e.target.value.toUpperCase());
                              if (message) setMessage('');
                            }}
                            maxLength={6}
                            placeholder="ROOM CODE"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    )}

                    {/* Primary Golden-Yellow Action Buttons */}
                    {landingTab === 'create' ? (
                      <button
                        type="button"
                        className="cta-button table-cta-btn primary-game-btn"
                        disabled={!canJoin || isCreating}
                        onClick={create}
                      >
                        {isCreating ? (
                          <>
                            <span className="animate-spin inline-block mr-2">◌</span>
                            <span>Creating Table…</span>
                          </>
                        ) : (
                          <>
                            <span>Create Private Salon</span>
                            <span className="cta-symbol">👑</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cta-button table-cta-btn primary-game-btn"
                        disabled={!canJoin || roomInput.trim().length !== 6 || isJoining}
                        onClick={join}
                      >
                        {isJoining ? (
                          <>
                            <span className="animate-spin inline-block mr-2">◌</span>
                            <span>Entering Table…</span>
                          </>
                        ) : (
                          <>
                            <span>Enter Room Table</span>
                            <span className="cta-symbol">⚔️</span>
                          </>
                        )}
                      </button>
                    )}

                    {message && <div className="table-error-banner">{message}</div>}

                    {/* Trust Badges */}
                    <div className="table-specs-row">
                      <span className="spec-item"><span className="spec-check">✓</span> 2 to 4 Players</span>
                      <span className="spec-item"><span className="spec-check">✓</span> Private Invitations</span>
                      <span className="spec-item"><span className="spec-check">✓</span> Zero Downloads</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Authentic 15x15 Tabletop Board Showcase */}
              <div className="board-column">
                <LandingBoard2D />
              </div>
            </section>
          </div>
          {renderModals()}
        </main>
      </GameBackground>
    );
  }

  // =========================================================================
  // VIEW 2: PRIVATE WAITING ROOM / LOBBY
  // =========================================================================
  if (snapshot.status === 'lobby') {
    return (
      <GameBackground>
        <main className={`lobby-page-root ${reducedMotion ? 'reduced-motion' : ''}`}>
          {renderHeader()}
          <div className="lobby-container">
            <div className="lobby-head-card master-card">
              <div>
                <span className="hero-eyebrow">PRIVATE GAME LOBBY</span>
                <div className="room-code-tag">ROOM #{snapshot.roomCode}</div>
                <p className="hero-lede">
                  Starts automatically with 2–4 players. Empty seats are skipped gracefully.
                </p>
              </div>
              <div className="room-actions">
                <button type="button" className="secondary-violet-btn" onClick={copyInvite}>
                  🔗 Copy Invite
                </button>
                <button type="button" className="secondary-violet-btn" onClick={copyCode}>
                  📋 Copy Code
                </button>
                <button type="button" className="secondary-violet-btn btn-share" onClick={() => setShareModalOpen(true)}>
                  📱 QR Code
                </button>
              </div>
            </div>

            {/* 4 Player Slots in Master Design Aesthetic */}
            <div className="slots-grid">
              {[0, 1, 2, 3].map((seat) => {
                const player = snapshot.players.find((p) => p.seat === seat);
                return (
                  <div key={seat} className={`royal-slot-card master-slot-card ${player ? 'occupied' : 'vacant'}`}>
                    {player ? (
                      <PlayerAvatar
                        seat={seat}
                        name={player.name}
                        size={52}
                        isHost={player.id === snapshot.host}
                      />
                    ) : (
                      <div className="slot-empty-avatar">
                        <span>+</span>
                      </div>
                    )}
                    <div className="slot-info">
                      <span className="slot-name">
                        {player ? player.name : `Seat ${seat + 1} (Available)`}
                        {player?.id === sessionId ? ' (You)' : ''}
                      </span>
                      <span className="slot-status">
                        {player
                          ? `${player.id === snapshot.host ? '👑 HOST · ' : ''}${
                              player.connected ? 'ONLINE & READY' : 'RECONNECTING'
                            }`
                          : 'Tap Invite Link to invite friends'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lobby-footer-bar">
              <span className="lobby-seats-count font-mono text-sm text-amber-200">
                {snapshot.players.length}/4 Players · {snapshot.players.filter((p) => p.connected).length} Connected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="primary-game-btn lobby-start-btn"
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
                <button type="button" className="secondary-violet-btn" onClick={leave}>
                  Leave Lobby
                </button>
              </div>
            </div>
            {message && <p className="text-amber-400 text-xs text-center">{message}</p>}
          </div>
          {renderModals()}
        </main>
      </GameBackground>
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
      <main className={reducedMotion ? 'reduced-motion' : ''}>
        {renderHeader()}
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
        {renderModals()}
      </main>
    );
  }

  // =========================================================================
  // VIEW 4: ACTIVE 2D GAME ARENA (DIRECT MATCH SCREENSHOT RECREATION)
  // =========================================================================
  const displayDiceValue = rolling ? lastDice : (snapshot.dice ?? lastDice);

  return (
    <GameBackground>
      <main className={`game-screen-main ${reducedMotion ? 'reduced-motion' : ''}`}>
        {renderHeader()}

        <div className="game-screen-wrapper">
          {/* Recreated Room Information Bar from Master Screenshot */}
          <RoomInfoBar
            roomCode={snapshot.roomCode}
            playerCount={snapshot.players.length}
            maxPlayers={4}
            latency={42}
            copied={copiedCode}
            onCopy={copyCode}
          />

          {/* Recreated Mobile Horizontal Player Ribbon */}
          <MobilePlayerRibbon
            players={snapshot.players}
            currentPlayer={snapshot.currentPlayer}
            localSeat={localSeat}
            tokens={snapshot.tokens}
            turnTimeLeft={turnTimeLeft}
          />

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
                  reducedMotion={reducedMotion}
                />
              </div>

              {/* Recreated Turn Indicator Bar Directly Below Board */}
              <TurnIndicatorBar
                playerName={activePlayer?.name || 'Player'}
                isMyTurn={isMyTurn}
                timeLeft={turnTimeLeft}
                maxTime={15}
                diceValue={snapshot.dice}
                hasLegalMoves={legal.length > 0}
              />

              {/* Master Recreated Bottom Gameplay Controls (Mobile Bottom Dock) */}
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
                unreadCount={activityLog.length || 5}
                onRoll={rollDice}
                onMoveToken={moveToken}
                onOpenShare={() => setShareModalOpen(true)}
                onOpenActivity={() => setActivityFeedOpen((prev) => !prev)}
              />
            </div>

            {/* Desktop Right Side Control & Telemetry Panel (Hidden on Mobile < 1024px) */}
            <aside className="side-panel desktop-only">
              {/* Dedicated Tactile Royal Dice Tray */}
              <div className="dice-tray-card master-card">
                <span className="hero-eyebrow text-center mb-1">TACTILE DICE TRAY</span>
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
              <div className="telemetry-section master-card">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="hero-eyebrow">SEAT TELEMETRY</span>
                  <span className="text-[11px] font-mono text-amber-300">
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

        {renderModals()}
      </main>
    </GameBackground>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
