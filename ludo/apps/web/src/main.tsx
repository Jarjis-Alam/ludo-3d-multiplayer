import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import { DEFAULT_TURN_DURATION_MS, legalTokens, TURN_DURATION_OPTIONS } from '@ludo/game-engine';
import { AudioEngine } from './AudioEngine';
import { Board2D } from './Board2D';
import { LandingBoard2D } from './LandingBoard2D';
import { DiceFaceSVG, DiceRoller } from './DiceRoller';
import { ShareModal } from './ShareModal';
import { SettingsModal } from './SettingsModal';
import { ActivityFeed, ActivityItem } from './ActivityFeed';
import { VictoryPodium } from './VictoryPodium';
import { EliminationOverlay } from './EliminationOverlay';
import type { EliminationEvent } from './EliminationOverlay';
import { GameBackground } from './GameBackground';
import { PlayerAvatar } from './PlayerAvatar';
import { RoomInfoBar } from './RoomInfoBar';
import { TurnIndicatorBar } from './TurnIndicatorBar';
import {
  BellIcon,
  BookIcon,
  BoltIcon,
  ChatIcon,
  ChevronDownIcon,
  CloseIcon,
  FeedIcon,
  GamepadIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  LayersIcon,
  LinkIcon,
  PlayersIcon,
  PlayTriangleIcon,
  PlusIcon,
  ShieldIcon,
  SpeakerIcon,
  TrophyIcon,
} from './AppIcons';
import { Modal } from './Modal';
import type { TurnPhase } from './TurnIndicatorBar';
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
  turnExpiresAt: number | null;
  /** Server clock at snapshot time; absent on legacy/mock snapshots. */
  serverNow?: number;
  /** Turn clock the host picked in the lobby, in ms; absent on legacy/mock snapshots. */
  turnDurationMs?: number;
  /** Per-match counters for the victory screen; absent on legacy/mock snapshots. */
  matchStats?: {
    startedAt: number;
    finishedAt?: number;
    rolls: number;
    captures: number;
    safeMoves: number;
  };
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

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

/**
 * Holds a screen wake lock for the duration of a live match so a phone does not
 * sleep mid-turn. The lock is released when the match ends or the page is hidden,
 * and re-acquired when the page becomes visible again (browsers drop the lock on
 * their own when a page is backgrounded). Unsupported or denied requests are
 * ignored — the match plays normally without it.
 */
function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || typeof document === 'undefined') return;
    const wakeLock = (
      navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      try {
        const lock = await wakeLock.request('screen');
        if (disposed) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener?.('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Denied, unsupported or battery-saver mode: keep playing without it.
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
        return;
      }
      // Release explicitly on hide; browsers also drop the lock on their own.
      const lock = sentinel;
      sentinel = null;
      if (lock) {
        try {
          void lock.release();
        } catch {
          // Already released by the browser.
        }
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      const lock = sentinel;
      sentinel = null;
      if (lock) {
        try {
          void lock.release();
        } catch {
          // Already released by the browser.
        }
      }
    };
  }, [active]);
}

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
  expanded: boolean;
  onToggleExpanded: () => void;
}

const MobilePlayerRibbon: React.FC<MobilePlayerRibbonProps> = ({
  players,
  currentPlayer,
  localSeat,
  tokens,
  turnTimeLeft,
  expanded,
  onToggleExpanded,
}) => {
  return (
    <div
      className={`mobile-player-ribbon ${expanded ? '' : 'ribbon-compact'}`}
      role="region"
      aria-label="Active players turn status"
    >
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
              size={28}
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
      <button
        type="button"
        className="ribbon-expand-btn"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse player details' : 'Expand player details'}
        title={expanded ? 'Compact players' : 'Show player details'}
      >
        {expanded ? '▴' : '▾'}
      </button>
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
      {/* Center Elevated Violet Dice Well */}
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

      {/* One consolidated control row: large targets, even spacing, safe-area aware */}
      <div className="dock-controls-row">
        <button
          type="button"
          className="dock-icon-btn btn-chat"
          onClick={onOpenActivity}
          title="Chat & Activity"
          aria-label="Chat"
        >
          <ChatIcon size={20} />
        </button>
        <button
          type="button"
          className="dock-icon-btn btn-players"
          onClick={onOpenShare}
          title="Players & Share"
          aria-label="Players"
        >
          <PlayersIcon size={20} />
        </button>
      </div>
    </div>
  );
};

function App() {
  const [name, setName] = useState(localStorage.getItem('ludo_player_name') || '');
  const [roomInput, setRoomInput] = useState(new URLSearchParams(location.search).get('room') || '');
  /** Which homepage entry sheet is open, if any. An invite link opens join. */
  const [entryMode, setEntryMode] = useState<'create' | 'join' | null>(() =>
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('room') ? 'join' : null
  );
  /** Homepage info sheets: the rules recap and the leaderboard placeholder. */
  const [infoSheet, setInfoSheet] = useState<'rules' | 'leaderboard' | null>(null);
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
  const [elimination, setElimination] = useState<EliminationEvent | null>(null);
  const eliminationTimerRef = useRef<number | null>(null);
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
  const [sfxVolume, setSfxVolume] = useState(() => AudioEngine.getVolume());
  const [captureHints, setCaptureHints] = useState(
    () => localStorage.getItem('ludo_capture_hints') === 'true'
  );
  // Names are always shown by default; phones hide the collapse control because
  // the ribbon already stacks into two rows there.
  const [ribbonExpanded, setRibbonExpanded] = useState(true);
  const [reconnectToast, setReconnectToast] = useState(false);
  const [restoringSession, setRestoringSession] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('ludo-room')
  );
  const [turnAnnouncement, setTurnAnnouncement] = useState('');

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const currentTurnRef = useRef<{ id: number; seat: number; name: string; dice: number } | null>(null);
  const turnSeqRef = useRef(0);
  const warnedTurnRef = useRef<string | null>(null);
  const wasDisconnectedRef = useRef(false);

  // Keep the phone awake for the whole live match; released on finish, hide or unmount.
  useScreenWakeLock(snapshot?.status === 'playing');

  // Never let a queued elimination clear timer outlive the screen.
  useEffect(
    () => () => {
      if (eliminationTimerRef.current) window.clearTimeout(eliminationTimerRef.current);
    },
    []
  );

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

  /**
   * Adds one timeline entry. Movement/capture events inherit the current roll so the
   * feed can group a real turn together; no turn is invented for independent events.
   */
  const addActivityItem = (item: Omit<ActivityItem, 'id' | 'time'>) => {
    const turn = currentTurnRef.current;
    const inheritsTurn =
      turn &&
      (item.type === 'deploy' ||
        item.type === 'move' ||
        item.type === 'capture' ||
        item.type === 'home' ||
        item.type === 'finish' ||
        item.type === 'bonus');
    setActivityLog((prev) => [
      {
        ...item,
        playerName: item.playerName ?? turn?.name,
        turnId: item.turnId ?? (inheritsTurn ? turn!.id : undefined),
        dice: item.dice ?? (inheritsTurn ? turn!.dice : undefined),
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: Date.now(),
      },
      ...prev.slice(0, 49),
    ]);
  };

  const toggleCaptureHints = () => {
    const next = !captureHints;
    setCaptureHints(next);
    localStorage.setItem('ludo_capture_hints', String(next));
    triggerHaptic('light');
  };

  const changeVolume = (volume: number) => {
    setSfxVolume(volume);
    AudioEngine.setVolume(volume);
  };

  // Never leave the restore skeleton up indefinitely if the socket stays silent
  useEffect(() => {
    if (!restoringSession) return;
    const timeout = window.setTimeout(() => setRestoringSession(false), 4500);
    return () => window.clearTimeout(timeout);
  }, [restoringSession]);

  // Synchronized server-authoritative turn timer countdown. The deadline comes from
  // the server and is paired with the snapshot's server clock, so device clock skew
  // cannot shift the countdown. If the timer reaches zero while the page was
  // suspended past the server's timeout, ask for the authoritative turn instead of
  // sitting at 0s.
  useEffect(() => {
    if (snapshot?.status !== 'playing') {
      setTurnTimeLeft(0);
      return;
    }

    const clockSkewMs = typeof snapshot.serverNow === 'number' ? snapshot.serverNow - Date.now() : 0;
    let lastResyncAt = 0;

    const updateCountdown = () => {
      if (typeof snapshot.turnExpiresAt !== 'number') {
        setTurnTimeLeft(0);
        return;
      }
      const remainingMs = snapshot.turnExpiresAt - (Date.now() + clockSkewMs);
      setTurnTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs <= 0 && socket.connected && Date.now() - lastResyncAt > 1500) {
        lastResyncAt = Date.now();
        socket.emit('request_game_state', snapshot.roomCode);
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [
    snapshot?.status,
    snapshot?.turnExpiresAt,
    snapshot?.serverNow,
    snapshot?.currentPlayer,
    snapshot?.version,
    snapshot?.roomCode,
  ]);

  // Locked phones suspend timers and sockets, so on return pull the authoritative
  // snapshot: the countdown, current turn and dice state must never be stale.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== 'visible') return;
      const roomCode = snapshotRef.current?.roomCode;
      if (!roomCode || !socket.connected) return;
      socket.emit('request_game_state', roomCode, (res: any) => {
        if (!res?.ok || !res.state) return;
        setSnapshot((prev) => (prev && res.state.version < prev.version ? prev : res.state));
      });
    };

    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    window.addEventListener('pageshow', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
      window.removeEventListener('pageshow', resync);
    };
  }, []);

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
      setRestoringSession(false);
      setEntryMode(null);
      setInfoSheet(null);
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
      turnSeqRef.current += 1;
      currentTurnRef.current = {
        id: turnSeqRef.current,
        seat: data.seat,
        name: data.playerName,
        dice: data.value,
      };
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
        playerName: data.playerName,
        turnId: turnSeqRef.current,
        dice: data.value,
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
      capturedSeat?: number;
      winner: boolean;
      finished: boolean;
      pawnReachedHome: boolean;
      rank?: number;
    }) => {
      const pColor = snapshotRef.current?.players.find((p) => p.seat === data.seat)?.color;
      if (data.captured) {
        AudioEngine.playCapture();
        triggerHaptic('heavy');
        const victim =
          typeof data.capturedSeat === 'number'
            ? snapshotRef.current?.players.find((p) => p.seat === data.capturedSeat)
            : undefined;
        const fallbackVictim = snapshotRef.current?.players.find((p) => p.seat !== data.seat);
        setElimination({
          id: Date.now() + Math.random(),
          attackerColor: pColor || 'red',
          victimColor: victim?.color || fallbackVictim?.color || 'blue',
          victimName: victim?.name,
        });
        if (eliminationTimerRef.current) window.clearTimeout(eliminationTimerRef.current);
        eliminationTimerRef.current = window.setTimeout(() => setElimination(null), 2300);
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
      const autoMoved = Boolean(data.autoMoved);
      const notice = autoMoved
        ? `⏰ ${name} ran out of time — the game played their pawn automatically.`
        : `⏰ ${name} timed out! Turn forfeited.`;
      setActivityNotice(notice);
      setTimeout(() => setActivityNotice(null), 4000);
      addActivityItem({
        type: 'timeout',
        icon: '⏰',
        message: autoMoved
          ? `${name} ran out of time — pawn moved automatically.`
          : `${name} timed out! Turn forfeited.`,
        seat: data.seat,
        playerName: name,
      });
      currentTurnRef.current = null;
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
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        setReconnectToast(true);
        window.setTimeout(() => setReconnectToast(false), 1600);
      }
      const savedRoom = localStorage.getItem('ludo-room');
      if (savedRoom) {
        socket.emit('request_game_state', savedRoom, (res: any) => {
          setRestoringSession(false);
          if (res?.ok && res.state) {
            setSnapshot(res.state);
          } else if (res && !res.ok) {
            localStorage.removeItem('ludo-room');
          }
        });
      } else {
        setRestoringSession(false);
      }
    };
    const onDisconnect = () => {
      wasDisconnectedRef.current = true;
      setConnected(false);
    };
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

  const openEntry = (mode: 'create' | 'join') => {
    triggerHaptic('light');
    setMessage('');
    setEntryMode(mode);
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
      setEntryMode(null);
      setInfoSheet(null);
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
      setEntryMode(null);
      setInfoSheet(null);
      setSnapshot(result.state);
      setMessage('Joined the royal salon.');
    });
  };

  const leave = () => {
    if (snapshot)
      socket.emit('leave_room', snapshot.roomCode, () => {
        localStorage.removeItem('ludo-room');
        setEntryMode(null);
        setInfoSheet(null);
        setShareModalOpen(false);
        setSettingsModalOpen(false);
        setActivityFeedOpen(false);
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

  // A stable click handler keeps the memoised board from re-rendering whenever
  // the parent updates (countdown, toasts, dice state).
  const moveTokenRef = useRef(moveToken);
  moveTokenRef.current = moveToken;
  const handleTokenClick = useCallback((token: number) => moveTokenRef.current(token), []);

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
  /** Turn clock length in seconds, shared by the lobby picker and the turn bar. */
  const turnSeconds = Math.round((snapshot?.turnDurationMs ?? DEFAULT_TURN_DURATION_MS) / 1000);
  const activePlayer = snapshot?.players.find((p) => p.seat === snapshot.currentPlayer);

  const legal = useMemo(
    () =>
      snapshot && snapshot.dice !== null && localSeat === snapshot.currentPlayer
        ? legalTokens(snapshot as any, localSeat as any, snapshot.dice)
        : [],
    [snapshot, localSeat]
  );

  // One restrained five-second warning per turn (only cues the local player)
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'playing') return;
    if (turnTimeLeft > 5 || turnTimeLeft <= 0) return;
    const key = `${snapshot.currentPlayer}-${snapshot.turnExpiresAt}`;
    if (warnedTurnRef.current === key) return;
    warnedTurnRef.current = key;
    if (snapshot.currentPlayer === localSeat) {
      AudioEngine.playWarningTick();
      if (hapticEnabled) triggerHaptic('warning');
    }
  }, [turnTimeLeft, snapshot, localSeat, hapticEnabled]);

  // Screen readers hear one announcement per turn, never one per socket snapshot
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'playing') return;
    if (snapshot.currentPlayer === localSeat) {
      setTurnAnnouncement(
        snapshot.lastNotice?.type === 'extra_turn' && snapshot.dice === null
          ? 'Your turn again. Extra roll awarded. Roll the dice.'
          : 'Your turn. Roll the dice.'
      );
    } else {
      const active = snapshot.players.find((p) => p.seat === snapshot.currentPlayer);
      setTurnAnnouncement(`${active?.name || 'Player'}'s turn.`);
    }
  }, [snapshot?.currentPlayer, snapshot?.turnExpiresAt, snapshot?.status, localSeat]);

  // Desktop keyboard controls: Space/R rolls, 1–4 select a legal pawn, Escape closes panels
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (settingsModalOpen || shareModalOpen || activityFeedOpen) return;
      if (!snapshot || snapshot.status !== 'playing') return;

      const key = e.key.toLowerCase();
      if ((key === ' ' || key === 'r') && isMyTurn && snapshot.dice === null && !rolling && !isMoving) {
        e.preventDefault();
        rollDice();
        return;
      }
      if (/^[1-4]$/.test(key) && isMyTurn && snapshot.dice !== null && !isMoving) {
        const tokenIdx = Number(key) - 1;
        if (legal.includes(tokenIdx)) {
          e.preventDefault();
          moveToken(tokenIdx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    snapshot,
    isMyTurn,
    rolling,
    isMoving,
    legal,
    settingsModalOpen,
    shareModalOpen,
    activityFeedOpen,
  ]);

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
            <SpeakerIcon muted={isMuted} />
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
            <GearIcon />
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
              <LinkIcon />
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
              <FeedIcon />
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
              aria-label="Exit Table"
            >
              <CloseIcon className="exit-icon" size={16} />
              <span className="exit-label">Exit Table</span>
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

      {reconnectToast && connected && (
        <div className="reconnect-success-toast" role="status">
          <span className="reconnect-success-icon">✓</span>
          <span>Reconnected — you're back at the table.</span>
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
        sfxVolume={sfxVolume}
        onVolumeChange={changeVolume}
        captureHints={captureHints}
        onToggleCaptureHints={toggleCaptureHints}
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
  // VIEW 0: RESTORING A SAVED TABLE (skeletons, no layout jump)
  // =========================================================================
  if (!snapshot && restoringSession) {
    return (
      <GameBackground dimmed>
        <main className="match-skeleton-page" aria-busy="true" aria-label="Restoring your match">
          {renderHeader()}
          <div className="match-skeleton">
            <div className="skeleton-info-bar skeleton-shimmer" />
            <div className="skeleton-ribbon">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton-player-card skeleton-shimmer" />
              ))}
            </div>
            <div className="skeleton-main">
              <div className="skeleton-board skeleton-shimmer" />
              <div className="skeleton-side">
                <div className="skeleton-panel skeleton-shimmer" />
                <div className="skeleton-panel skeleton-shimmer" />
              </div>
            </div>
          </div>
        </main>
      </GameBackground>
    );
  }

  // =========================================================================
  // VIEW 1: HOME (Rollverse landing)
  // =========================================================================
  if (!snapshot) {
    const entryTitle = entryMode === 'join' ? 'Join a Table' : 'Create Private Table';
    const entryBusy = entryMode === 'join' ? isJoining : isCreating;
    const entryReady = entryMode === 'join' ? canJoin && roomInput.trim().length === 6 : canJoin;

    return (
      <GameBackground>
        <main className={`rv-home ${reducedMotion ? 'reduced-motion' : ''}`}>
          <header className="rv-header">
            <button
              type="button"
              className="rv-brand"
              onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })}
              aria-label="Rollverse home"
            >
              <span className="rv-brand-mark" aria-hidden="true">
                <DiceFaceSVG value={5} size={26} />
              </span>
              <span className="rv-brand-name">ROLLVERSE</span>
            </button>

            <nav className="rv-nav" aria-label="Main">
              <button
                type="button"
                className="rv-nav-item is-active"
                aria-current="page"
                onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })}
              >
                <HomeIcon size={18} />
                Home
              </button>
              <button type="button" className="rv-nav-item" onClick={() => openEntry('create')}>
                <GamepadIcon size={18} />
                Play
              </button>
              <button
                type="button"
                className="rv-nav-item"
                onClick={() => setInfoSheet('leaderboard')}
              >
                <TrophyIcon size={18} />
                Leaderboard
              </button>
              <button type="button" className="rv-nav-item" onClick={() => setInfoSheet('rules')}>
                <BookIcon size={18} />
                How to Play
              </button>
            </nav>

            <div className="rv-header-actions">
              <button
                type="button"
                className="rv-icon-btn"
                onClick={toggleSound}
                aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
                title={isMuted ? 'Unmute sound' : 'Mute sound'}
              >
                <BellIcon size={20} />
                {!isMuted && <span className="rv-bell-dot" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="rv-avatar-btn"
                onClick={() => setSettingsModalOpen(true)}
                aria-label="Open settings"
                title="Settings"
              >
                <PlayerAvatar seat={0} name={name || 'Player'} size={34} />
                <ChevronDownIcon size={16} />
              </button>
            </div>
          </header>

          <section className="rv-hero">
            <div className="rv-hero-copy">
              <h1 className="rv-title">
                Classic Ludo.
                <br />
                <span>Multiplayer Fun.</span>
              </h1>
              <p className="rv-lede">
                Play Ludo with your friends online. Create private rooms, join with a code, and enjoy a
                smooth, real-time experience.
              </p>

              <div className="rv-cta-row">
                <button type="button" className="rv-btn rv-btn-primary" onClick={() => openEntry('create')}>
                  <PlayTriangleIcon size={18} />
                  Play Now
                </button>
                <button type="button" className="rv-btn rv-btn-ghost" onClick={() => openEntry('join')}>
                  <PlayersIcon size={20} />
                  Play with Friends
                </button>
              </div>

              <ul className="rv-features">
                <li>
                  <BoltIcon size={24} />
                  <span>
                    Real-time
                    <br />
                    Multiplayer
                  </span>
                </li>
                <li>
                  <ShieldIcon size={24} />
                  <span>
                    Private
                    <br />
                    Rooms
                  </span>
                </li>
                <li>
                  <GamepadIcon size={24} />
                  <span>
                    Classic
                    <br />
                    Rules
                  </span>
                </li>
              </ul>
            </div>

            <div className="rv-hero-art" aria-hidden="true">
              <span className="rv-ghost rv-ghost-a">
                <DiceFaceSVG value={6} size={150} />
              </span>
              <span className="rv-ghost rv-ghost-b">
                <DiceFaceSVG value={4} size={110} />
              </span>
              <span className="rv-glow rv-glow-a" />
              <span className="rv-glow rv-glow-b" />
              <svg className="rv-swoosh" viewBox="0 0 120 90" fill="none">
                <path d="M8 80C24 46 52 24 90 16" stroke="#FFD23F" strokeWidth="7" strokeLinecap="round" />
                <path
                  d="M30 86C44 58 66 40 96 32"
                  stroke="#FFD23F"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              </svg>
              <div className="rv-die">
                <DiceFaceSVG value={6} size={128} />
              </div>
              <div className="rv-board">
                <LandingBoard2D />
              </div>
            </div>
          </section>

          <section className="rv-bottom">
            <div className="rv-quickplay">
              <h2>Quick Play</h2>
              <p>Start a new game or join an existing one.</p>
              <div className="rv-quick-actions">
                <button
                  type="button"
                  className="rv-quick-card is-primary"
                  onClick={() => openEntry('create')}
                >
                  <span className="rv-quick-icon">
                    <PlusIcon size={22} />
                  </span>
                  <span className="rv-quick-text">
                    <strong>Create Private Table</strong>
                    <small>Host a room and invite friends</small>
                  </span>
                </button>
                <button type="button" className="rv-quick-card" onClick={() => openEntry('join')}>
                  <span className="rv-quick-icon">
                    <GridIcon size={22} />
                  </span>
                  <span className="rv-quick-text">
                    <strong>Join with Code</strong>
                    <small>Enter a room code to play</small>
                  </span>
                </button>
              </div>
            </div>

            <div className="rv-stats">
              <div className="rv-stat">
                <PlayersIcon size={26} />
                <strong>2 – 4</strong>
                <span>Players</span>
              </div>
              <span className="rv-stat-divider" aria-hidden="true" />
              <div className="rv-stat">
                <LayersIcon size={26} />
                <strong>Zero</strong>
                <span>Downloads</span>
              </div>
              <span className="rv-stat-divider" aria-hidden="true" />
              <div className="rv-stat">
                <BoltIcon size={26} />
                <strong>Instant</strong>
                <span>Play</span>
              </div>
            </div>
          </section>

          <Modal
            isOpen={entryMode !== null}
            onClose={() => setEntryMode(null)}
            title={entryTitle}
            eyebrow="ROLLVERSE TABLE"
            ariaLabel={entryTitle}
          >
            <div className="rv-entry">
              <label className="rv-field">
                <span>YOUR NAME</span>
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
                  autoComplete="off"
                />
              </label>

              {entryMode === 'join' && (
                <label className="rv-field">
                  <span>ROOM CODE</span>
                  <input
                    className="royal-input"
                    value={roomInput}
                    onChange={(e) => {
                      setRoomInput(e.target.value.toUpperCase());
                      if (message) setMessage('');
                    }}
                    maxLength={6}
                    placeholder="ABC123"
                    autoComplete="off"
                  />
                </label>
              )}

              {message && <div className="table-error-banner">{message}</div>}

              <button
                type="button"
                className="rv-btn rv-btn-primary rv-entry-submit"
                disabled={!entryReady || entryBusy}
                onClick={() => (entryMode === 'join' ? join() : create())}
              >
                {entryBusy
                  ? entryMode === 'join'
                    ? 'Entering Table…'
                    : 'Creating Table…'
                  : entryMode === 'join'
                    ? 'Join Table'
                    : 'Create Table'}
              </button>
            </div>
          </Modal>

          <Modal
            isOpen={infoSheet !== null}
            onClose={() => setInfoSheet(null)}
            title={infoSheet === 'leaderboard' ? 'Leaderboards' : 'How to Play'}
            eyebrow="ROLLVERSE"
            ariaLabel={infoSheet === 'leaderboard' ? 'Leaderboards' : 'How to Play'}
          >
            {infoSheet === 'leaderboard' ? (
              <p className="rv-info-text">
                Ranked boards arrive in the next update. Every table you create today is a private room
                shared by code, so your results stay with you.
              </p>
            ) : (
              <ol className="rv-info-list">
                <li>Roll a 6 to bring a pawn out of your yard onto its start cell.</li>
                <li>Land on an opponent and their pawn goes back to the yard — that earns you a bonus roll.</li>
                <li>A 6, a capture or getting a pawn home all grant another roll.</li>
                <li>The first player to bring all four pawns to the centre crown wins.</li>
                <li>Each turn runs on the table clock (30s by default) and auto-passes when it runs out.</li>
              </ol>
            )}
          </Modal>
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
              <div className="lobby-head-info">
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

            {message && <p className="lobby-message text-amber-400 text-xs text-center">{message}</p>}

            {/* Turn clock — the host picks it here so a table can play relaxed. */}
            <div className="lobby-turn-clock master-card">
              <span className="lobby-turn-clock-label">TURN CLOCK</span>
              <div className="lobby-turn-clock-options" role="group" aria-label="Turn time limit">
                {TURN_DURATION_OPTIONS.map((seconds) => {
                  const isActive = turnSeconds === seconds;
                  return (
                    <button
                      key={seconds}
                      type="button"
                      className={`lobby-turn-option ${isActive ? 'is-active' : ''}`}
                      aria-pressed={isActive}
                      disabled={snapshot.host !== sessionId}
                      onClick={() => {
                        socket.emit(
                          'set_turn_duration',
                          { roomCode: snapshot.roomCode, seconds },
                          (result: any) => {
                            if (result?.state) setSnapshot(result.state);
                            if (!result?.ok) {
                              setMessage(result?.error || 'Could not change the turn clock');
                            }
                          }
                        );
                      }}
                    >
                      {seconds}s
                    </button>
                  );
                })}
              </div>
              <span className="lobby-turn-clock-hint">
                {snapshot.host === sessionId
                  ? 'Seconds per turn before it auto-passes'
                  : 'The host sets the turn clock'}
              </span>
            </div>

            <div className="lobby-footer-bar">
              <span className="lobby-seats-count font-mono text-sm text-amber-200">
                {snapshot.players.length}/4 Players · {snapshot.players.filter((p) => p.connected).length} Connected
              </span>
              <div className="lobby-footer-actions">
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
          stats={snapshot.matchStats ?? null}
          onRematch={rematch}
          onLeave={leave}
          onShare={() => setShareModalOpen(true)}
        />
        {renderModals()}
      </main>
    );
  }

  // =========================================================================
  // VIEW 4: ACTIVE 2D GAME ARENA (DIRECT MATCH SCREENSHOT RECREATION)
  // =========================================================================
  const displayDiceValue = rolling ? lastDice : (snapshot.dice ?? lastDice);

  const recentNotice =
    snapshot.lastNotice && Date.now() - snapshot.lastNotice.timestamp < 6000 ? snapshot.lastNotice : null;
  let turnPhase: TurnPhase = 'waiting';
  let turnNoticeMessage: string | null = null;
  if (isMyTurn) {
    if (snapshot.dice === null) {
      turnPhase = recentNotice?.type === 'extra_turn' ? 'extra' : 'roll';
    } else if (legal.length > 0) {
      turnPhase = 'select';
    } else {
      turnPhase = 'passed';
    }
  } else if (
    recentNotice?.type === 'extra_turn' &&
    recentNotice.seat === snapshot.currentPlayer &&
    snapshot.dice === null
  ) {
    turnPhase = 'extra';
  } else if (
    recentNotice &&
    (recentNotice.type === 'timeout' || recentNotice.type === 'auto_pass' || recentNotice.type === 'three_sixes')
  ) {
    turnPhase = 'notice';
    turnNoticeMessage = recentNotice.message;
  }

  // Empty seats are surfaced once on the room bar, and that pill opens the
  // invite sheet that fills them.
  const seatsLeft = Math.max(0, 4 - snapshot.players.length);

  return (
    <GameBackground dimmed>
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
            openSeats={seatsLeft}
            onInvite={() => setShareModalOpen(true)}
          />

          {/* Recreated Mobile Horizontal Player Ribbon */}
          <MobilePlayerRibbon
            players={snapshot.players}
            currentPlayer={snapshot.currentPlayer}
            localSeat={localSeat}
            tokens={snapshot.tokens}
            turnTimeLeft={turnTimeLeft}
            expanded={ribbonExpanded}
            onToggleExpanded={() => setRibbonExpanded((prev) => !prev)}
          />

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {turnAnnouncement}
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
                  onTokenClick={handleTokenClick}
                  reducedMotion={reducedMotion}
                  showCaptureHints={captureHints}
                />
              </div>

              <div className="board-under-rail">
              {/* Landscape keeps player identity and progress visible without the ribbon */}
              <div className="landscape-seat-strip" aria-label="Players and progress">
                {snapshot.players.map((p) => {
                  const home = (snapshot.tokens[p.seat] || []).filter(
                    (t) => t.kind === 'home' && t.progress >= 6
                  ).length;
                  return (
                    <div
                      key={p.id}
                      className={`landscape-seat ${p.seat === snapshot.currentPlayer ? 'is-active' : ''} ${
                        !p.connected ? 'is-offline' : ''
                      }`}
                    >
                      <PlayerAvatar seat={p.seat} name={p.name} size={24} isHost={p.id === snapshot.host} />
                      <span className="landscape-seat-name">{p.name}</span>
                      <span className="landscape-seat-home">{home}/4</span>
                    </div>
                  );
                })}
              </div>

              {/* Turn state bar: roll, select, extra turn, timeout */}
              <TurnIndicatorBar
                playerName={activePlayer?.name || 'Player'}
                seat={snapshot.currentPlayer}
                isMyTurn={isMyTurn}
                timeLeft={turnTimeLeft}
                maxTime={turnSeconds}
                diceValue={snapshot.dice}
                hasLegalMoves={legal.length > 0}
                phase={turnPhase}
                noticeMessage={turnNoticeMessage}
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
                onRoll={rollDice}
                onMoveToken={moveToken}
                onOpenShare={() => setShareModalOpen(true)}
                onOpenActivity={() => setActivityFeedOpen((prev) => !prev)}
              />
              </div>
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
                  maxTime={turnSeconds}
                />
              </div>

              {/* Players HUD / Telemetry List */}
              <div className="telemetry-section master-card">
                <div className="telemetry-section-head">
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

        {elimination && (
          <EliminationOverlay
            key={elimination.id}
            event={elimination}
            reducedMotion={reducedMotion}
          />
        )}

        {renderModals()}
      </main>
    </GameBackground>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
