import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import { legalTokens } from '@ludo/game-engine';
import './style.css';

// Lazy-loaded 3D components for bundle optimization
const GameBoard = React.lazy(() => import('./GameBoard'));
const LandingBoard = React.lazy(() => import('./LandingBoard'));

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
  red: '#e94b4b',
  green: '#36b96b',
  yellow: '#f4c542',
  blue: '#4389e8',
};

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function App() {
  const [name, setName] = useState('');
  const [roomInput, setRoomInput] = useState(new URLSearchParams(location.search).get('room') || '');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [lastDice, setLastDice] = useState<number | null>(null);
  const canJoin = name.trim().length > 0 && name.trim().length <= 16;

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
    socket.emit('create_room', { name }, (result: any) => {
      if (!result.ok) return setMessage(result.error);
      localStorage.setItem('ludo-room', result.roomCode);
      setSnapshot(result.state);
      setMessage('Room created. Invite three friends.');
    });
  };

  const join = () => {
    connect();
    socket.emit('join_room', { roomCode: roomInput, name }, (result: any) => {
      if (!result.ok) return setMessage(result.error);
      localStorage.setItem('ludo-room', result.roomCode);
      setSnapshot(result.state);
      setMessage('Joined the private table.');
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

  const start = () =>
    snapshot &&
    socket.emit('start_game', { roomCode: snapshot.roomCode, actionId: `start_${Date.now()}` }, (result: any) => {
      if (!result.ok) setMessage(result.error);
      else if (result.state) setSnapshot(result.state);
    });

  const rematch = () =>
    snapshot &&
    socket.emit(
      'request_rematch',
      { roomCode: snapshot.roomCode, actionId: `rematch_${snapshot.version}_${Date.now()}` },
      (result: any) => {
        if (!result.ok) setMessage(result.error);
        else if (result.state) setSnapshot(result.state);
      }
    );

  const copyInvite = () =>
    snapshot && navigator.clipboard?.writeText(`${location.origin}/?room=${snapshot.roomCode}`);

  const localSeat = snapshot?.players.find((player) => player.id === sessionId)?.seat ?? -1;
  const activePlayer = snapshot?.players[snapshot.currentPlayer];
  const legal = useMemo(
    () =>
      snapshot && snapshot.dice !== null && localSeat === snapshot.currentPlayer
        ? legalTokens(snapshot as any, localSeat as any, snapshot.dice)
        : [],
    [snapshot, localSeat]
  );

  const rollDice = () => {
    if (!snapshot) return;
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
        window.setTimeout(() => setRolling(false), 650);
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

  if (!snapshot)
    return (
      <main>
        <header>
          <div className="brand">
            LUDO<span>•</span>
          </div>
          <div className="badge">PRIVATE TABLE · 4 PLAYERS</div>
        </header>
        <section className="hero">
          <div className="copy">
            <p className="eyebrow">YOUR TABLE, ANYWHERE</p>
            <h1>
              Four friends.
              <br />
              <i>One perfect roll.</i>
            </h1>
            <p className="lede">
              A private, server-authoritative Ludo table built for reliable play across four separate devices.
            </p>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Enter your name" />
            <div className="actions">
              <button disabled={!canJoin} onClick={create}>
                Create private room
              </button>
              <div className="join">
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ROOM CODE"
                />
                <button disabled={!canJoin || roomInput.length !== 6} onClick={join}>
                  Join
                </button>
              </div>
            </div>
            {message && <p className="message">{message}</p>}
          </div>
          <div className="board">
            <Suspense fallback={<div className="board-loading">Loading 3D Board…</div>}>
              <LandingBoard />
            </Suspense>
          </div>
        </section>
        <footer>
          <span>Engine-first multiplayer Ludo</span>
          <span>Server state · Session token only in browser storage</span>
        </footer>
      </main>
    );

  if (snapshot.status === 'lobby')
    return (
      <main>
        <header>
          <div className="brand">
            LUDO<span>•</span>
          </div>
          <div className="badge">PRIVATE LOBBY · {connected ? 'CONNECTED' : 'RECONNECTING'}</div>
        </header>
        <section className="lobby">
          <div className="lobby-head">
            <div>
              <p className="eyebrow">PRIVATE LOBBY</p>
              <h1>
                Room <i>{snapshot.roomCode}</i>
              </h1>
              <p className="lede">Share the code or invitation link. Start when all four connected seats are ready.</p>
            </div>
            <div className="room-actions">
              <button onClick={copyInvite}>Copy invitation link</button>
              <button className="secondary" onClick={() => navigator.clipboard?.writeText(snapshot.roomCode)}>
                Copy code
              </button>
            </div>
          </div>
          <div className="slots">
            {[0, 1, 2, 3].map((seat) => {
              const player = snapshot.players.find((p) => p.seat === seat);
              return (
                <div className={`slot ${player?.color || ''}`} key={seat}>
                  {player ? (
                    <>
                      <div className="avatar">{initials(player.name)}</div>
                      <div>
                        <strong>{player.name}</strong>
                        <small>
                          {player.id === snapshot.host ? 'HOST · ' : ''}
                          {player.connected ? 'CONNECTED' : 'RECONNECTING'}
                        </small>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="avatar empty">{seat + 1}</div>
                      <div>
                        <strong>Open seat</strong>
                        <small>INVITE A FRIEND</small>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="lobby-footer">
            <span>{snapshot.players.filter((p) => p.connected).length}/4 connected</span>
            <div className="actions">
              <button
                onClick={start}
                disabled={
                  snapshot.host !== sessionId ||
                  snapshot.players.length !== 4 ||
                  snapshot.players.some((p) => !p.connected)
                }
              >
                Start game
              </button>
              <button className="secondary" onClick={leave}>
                Leave room
              </button>
            </div>
          </div>
          {message && <p className="message">{message}</p>}
        </section>
      </main>
    );

  if (snapshot.status === 'finished')
    return (
      <main>
        <header>
          <div className="brand">
            LUDO<span>•</span>
          </div>
          <div className="badge">MATCH COMPLETE · ROOM {snapshot.roomCode}</div>
        </header>
        <section className="results">
          <p className="eyebrow">VICTORY</p>
          <h1>
            <i>{snapshot.players[snapshot.winner ?? 0]?.name}</i> wins
          </h1>
          <p className="lede">All four tokens reached home. The table is ready for another match.</p>
          <div className="standings">
            {snapshot.players.map((player, index) => (
              <div className="standing" key={player.id}>
                <span className="rank">{index + 1}</span>
                <span className="standing-dot" style={{ background: colorHex[player.color] }} />
                <strong>{player.name}</strong>
                <span>
                  {snapshot.tokens[player.seat]?.filter((token) => token.kind === 'home').length}/4 home
                </span>
              </div>
            ))}
          </div>
          <div className="actions">
            <button onClick={rematch} disabled={snapshot.host !== sessionId || snapshot.players.some((p) => !p.connected)}>
              Play rematch
            </button>
            <button className="secondary" onClick={leave}>
              Return to lobby
            </button>
          </div>
          {message && <p className="message">{message}</p>}
        </section>
      </main>
    );

  return (
    <main>
      <header>
        <div className="brand">
          LUDO<span>•</span>
        </div>
        <div className="badge">
          ROOM {snapshot.roomCode} · {connected ? 'CONNECTED' : 'RECONNECTING'}
        </div>
      </header>
      <section className="game">
        <div className="game-head">
          <div>
            <p className="eyebrow">TURN · {activePlayer?.name || 'PLAYER'}</p>
            <h2>{snapshot.dice ? `Dice shows ${snapshot.dice}` : `Roll for ${activePlayer?.name}`}</h2>
          </div>
          <div className="actions">
            <button
              onClick={rollDice}
              disabled={rolling || snapshot.currentPlayer !== localSeat || snapshot.dice !== null}
            >
              {rolling ? 'Rolling…' : 'Roll dice'}
            </button>
            <button className="secondary" onClick={leave}>
              Exit room
            </button>
          </div>
        </div>
        <div className="game-layout">
          <div>
            <div className="game-board">
              <Suspense fallback={<div className="board-loading">Loading 3D Board…</div>}>
                <GameBoard
                  snapshot={snapshot}
                  localSeat={localSeat}
                  rolling={rolling}
                  diceDisplay={rolling ? lastDice : snapshot.dice}
                  legal={legal}
                  onTokenClick={moveToken}
                />
              </Suspense>
              <div className="turn">
                {snapshot.dice
                  ? `Select a highlighted token · ${message || 'legal moves glow'}`
                  : message || 'The server controls turns and dice'}
              </div>
            </div>

            {/* Accessible mobile touch token picker */}
            {legal.length > 0 && localSeat === snapshot.currentPlayer && (
              <div className="mobile-token-picker">
                <span className="picker-label">Tap board or choose token below:</span>
                <div className="token-actions">
                  {legal.map((tokenIdx) => {
                    const t = snapshot.tokens[localSeat]?.[tokenIdx];
                    const label =
                      t?.kind === 'base'
                        ? `Token ${tokenIdx + 1} (Deploy)`
                        : t?.kind === 'home'
                        ? `Token ${tokenIdx + 1} (Home lane)`
                        : `Token ${tokenIdx + 1} (Move)`;
                    return (
                      <button key={tokenIdx} onClick={() => moveToken(tokenIdx)}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="players-panel">
            <p className="eyebrow">PLAYERS</p>
            {snapshot.players.map((player) => (
              <div
                className={`player-card ${player.seat === snapshot.currentPlayer ? 'active' : ''}`}
                key={player.id}
              >
                <span className="player-dot" style={{ background: colorHex[player.color] }} />
                <div>
                  <strong>
                    {player.name}
                    {player.id === sessionId ? ' · YOU' : ''}
                  </strong>
                  <small>
                    {player.connected ? 'CONNECTED' : 'RECONNECTING'} ·{' '}
                    {snapshot.tokens[player.seat]?.filter((token) => token.kind === 'home').length || 0}/4 HOME
                  </small>
                </div>
              </div>
            ))}
            <p className="rules-note">
              Click a glowing token or use the buttons below the board. A six grants another roll; the server
              automatically passes when no moves are legal.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
