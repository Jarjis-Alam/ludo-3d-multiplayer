import { createHmac, randomBytes, randomInt } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  initialState,
  startGame,
  roll,
  moveToken,
  forfeitTurn,
  type GameState,
  type Player,
  type PlayerIndex,
  type TokenPosition,
  legalTokens,
  absoluteCell,
  SAFE_CELLS,
  DEFAULT_TURN_DURATION_MS,
  TURN_DURATION_OPTIONS,
} from '@ludo/game-engine';
import type { Persistence, PersistedRoom } from './persistence.js';

const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const SESSION_GRACE_MS = 60_000;
const MAX_PROCESSED_ACTIONS = 2_000;
const MAX_HISTORY_SNAPSHOTS = 100;
const SESSION_SECRET = process.env.SESSION_SECRET || 'ludo-secret-session-key-development';

export type RoomPlayer = Player & { connected: boolean; socketId?: string; lastSeenAt: number };

/** Per-match counters for the victory screen. They live on the room, not in the engine. */
export type MatchStats = {
  startedAt: number;
  finishedAt?: number;
  /** Dice rolls, i.e. turns taken. */
  rolls: number;
  captures: number;
  /** Moves that landed on a safe cell where no capture can happen. */
  safeMoves: number;
};

const makeMatchStats = (): MatchStats => ({ startedAt: Date.now(), rolls: 0, captures: 0, safeMoves: 0 });

export type RoomSnapshot = GameState & {
  roomCode: string;
  host: string;
  invitationPath: string;
  players: RoomPlayer[];
  /** Server wall clock at snapshot time; clients pair it with turnExpiresAt to ignore device clock skew. */
  serverNow: number;
  matchStats: MatchStats;
};
type Session = { id: string; name: string; tokenHash: string; roomCode?: string };
export type ActionResult = {
  ok: boolean;
  error?: string;
  version?: number;
  value?: number;
  state?: RoomSnapshot;
  history?: RoomSnapshot[];
  reconnected?: boolean;
  roomCode?: string;
  autoMoved?: boolean;
  autoToken?: number;
  autoReason?: 'single' | 'timeout';
};
export type LudoServiceOptions = {
  invitationOrigin?: string;
  sessionGraceMs?: number;
};
type Room = {
  code: string;
  host: string;
  players: Map<string, RoomPlayer>;
  state: GameState;
  expiryTimers: Map<string, NodeJS.Timeout>;
  turnTimer?: NodeJS.Timeout;
  turnTimerVersion?: number;
  actionTail: Promise<void>;
  processedActions: Map<string, ActionResult>;
  snapshotHistory: Map<number, RoomSnapshot>;
  matchStats: MatchStats;
};
export type ActionEnvelope = {
  roomCode?: string;
  actionId?: string;
  token?: number;
  expectedVersion?: number;
  clientVersion?: number;
  deterministicDice?: number;
};

const cleanName = (value: unknown) => String(value ?? '').trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 16);
const makeCode = () => randomBytes(3).toString('hex').toUpperCase();
const hashToken = (token: string) => createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
const isValidCode = (code: string) => /^[A-Z0-9]{6}$/.test(code);

const actionIdOf = (value: unknown): string | undefined => {
  if (typeof value === 'object' && value !== null && typeof (value as ActionEnvelope).actionId === 'string') {
    return (value as ActionEnvelope).actionId!.slice(0, 100);
  }
  return undefined;
};

const roomCodeOf = (value: unknown): string => {
  if (typeof value === 'string') return value.trim().toUpperCase();
  if (typeof value === 'object' && value !== null) {
    return String((value as ActionEnvelope).roomCode || '').trim().toUpperCase();
  }
  return '';
};

export class LudoService {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, Session>();
  private readonly socketSessions = new Map<string, Session>();
  private readonly socketRateLimits = new Map<string, { count: number; resetAt: number }>();
  private readonly failedJoins = new Map<string, { count: number; lockedUntil: number }>();
  private readonly pendingPersistence = new Set<Promise<unknown>>();
  private io?: Server;
  private readonly invitationOrigin: string;
  private readonly sessionGraceMs: number;

  constructor(private readonly persistence: Persistence, originOrOptions: string | LudoServiceOptions = 'http://localhost:5173') {
    if (typeof originOrOptions === 'string') {
      this.invitationOrigin = originOrOptions;
      this.sessionGraceMs = SESSION_GRACE_MS;
    } else {
      this.invitationOrigin = originOrOptions.invitationOrigin ?? 'http://localhost:5173';
      this.sessionGraceMs = originOrOptions.sessionGraceMs ?? SESSION_GRACE_MS;
    }
  }

  public trackPersistence<T>(promise: Promise<T>): Promise<T> {
    const p = promise.then(() => undefined, () => undefined);
    this.pendingPersistence.add(p);
    p.finally(() => this.pendingPersistence.delete(p));
    return promise;
  }

  public async flushPersistence(): Promise<void> {
    while (this.pendingPersistence.size > 0) {
      await Promise.all([...this.pendingPersistence]);
    }
  }

  public close(): void {
    for (const room of this.rooms.values()) {
      if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = undefined;
      }
      for (const timer of room.expiryTimers.values()) {
        clearTimeout(timer);
      }
      room.expiryTimers.clear();
    }
  }

  async init() {
    await this.persistence.init();
    if (this.persistence.loadSessions) {
      const savedSessions = await this.persistence.loadSessions();
      for (const s of savedSessions) {
        this.sessions.set(s.tokenHash, s);
      }
    }
    for (const saved of await this.persistence.loadRooms()) {
      const players = new Map(saved.players.map((player) => [player.id, { ...player, connected: false, lastSeenAt: Date.now() }]));
      const room: Room = {
        code: saved.code,
        host: saved.host,
        players,
        state: saved.state,
        expiryTimers: new Map(),
        actionTail: Promise.resolve(),
        processedActions: new Map(),
        snapshotHistory: new Map(),
        matchStats: makeMatchStats(),
      };
      this.recordSnapshot(room);
      this.rooms.set(saved.code, room);
    }
  }

  private checkRateLimit(socketId: string, maxPerSec = process.env.NODE_ENV === 'test' ? 1000 : 35): boolean {
    const now = Date.now();
    const record = this.socketRateLimits.get(socketId);
    if (!record || now > record.resetAt) {
      this.socketRateLimits.set(socketId, { count: 1, resetAt: now + 1000 });
      return true;
    }
    record.count++;
    return record.count <= maxPerSec;
  }

  private checkRoomAbuse(socketId: string): { allowed: boolean; message?: string } {
    const now = Date.now();
    const rec = this.failedJoins.get(socketId);
    if (rec && now < rec.lockedUntil) {
      return { allowed: false, message: 'Too many failed join attempts. Please wait.' };
    }
    return { allowed: true };
  }

  private recordFailedJoin(socketId: string) {
    const now = Date.now();
    const rec = this.failedJoins.get(socketId) || { count: 0, lockedUntil: 0 };
    rec.count++;
    if (rec.count >= 10) {
      rec.lockedUntil = now + 30_000;
      rec.count = 0;
    }
    this.failedJoins.set(socketId, rec);
  }

  private snapshot(room: Room): RoomSnapshot {
    return {
      ...room.state,
      roomCode: room.code,
      host: room.host,
      invitationPath: `${this.invitationOrigin}/?room=${room.code}`,
      players: [...room.players.values()],
      serverNow: Date.now(),
      matchStats: room.matchStats,
    };
  }

  private recordSnapshot(room: Room): RoomSnapshot {
    const snap = this.snapshot(room);
    room.snapshotHistory.set(snap.version, snap);
    while (room.snapshotHistory.size > MAX_HISTORY_SNAPSHOTS) {
      const oldest = room.snapshotHistory.keys().next().value;
      if (oldest !== undefined) room.snapshotHistory.delete(oldest);
    }
    return snap;
  }

  private async save(room: Room) {
    await this.trackPersistence(
      this.persistence.saveRoom({
        code: room.code,
        host: room.host,
        players: [...room.players.values()].map(({ connected, socketId, lastSeenAt, ...player }) => player),
        state: room.state,
      })
    );
  }

  private sendError(ack: ((value: ActionResult) => void) | undefined, error: string, isObjectCall = false, room?: Room) {
    if (isObjectCall && room) {
      ack?.({ ok: false, error, version: room.state.version, state: this.snapshot(room) });
    } else {
      ack?.({ ok: false, error });
    }
  }

  private emitRoom(io: Server | undefined, room: Room, event = 'room_state', extraPayload?: Record<string, unknown>) {
    const targetIo = io || this.io;
    const snap = this.recordSnapshot(room);
    if (targetIo) {
      if (extraPayload) {
        targetIo.to(room.code).emit(event, { ...snap, state: snap, ...extraPayload });
      } else {
        targetIo.to(room.code).emit(event, snap);
      }
      if (event !== 'room_state') {
        targetIo.to(room.code).emit('room_state', snap);
      }
    }
  }

  private attach(socket: Socket, session: Session, room: Room) {
    const player = room.players.get(session.id);
    if (!player) return false;
    const wasDisconnected = !player.connected;
    player.connected = true;
    player.socketId = socket.id;
    player.lastSeenAt = Date.now();
    session.roomCode = room.code;
    socket.join(room.code);
    this.socketSessions.set(socket.id, session);

    const pendingExpiry = room.expiryTimers.get(session.id);
    if (pendingExpiry) {
      clearTimeout(pendingExpiry);
      room.expiryTimers.delete(session.id);
    }

    // If the active player reconnects during grace, restore a valid turn window
    // so they can act on their preserved state instead of timing out immediately.
    if (wasDisconnected && room.state.status === 'playing' && room.state.currentPlayer === player.seat) {
      const duration = room.state.turnDurationMs || DEFAULT_TURN_DURATION_MS;
      const now = Date.now();
      if (!room.state.turnExpiresAt || room.state.turnExpiresAt <= now + 500 || room.state.turnExpiresAt > now + duration) {
        room.state.turnExpiresAt = now + duration;
        this.resetTurnTimer(room);
      }
    }
    return true;
  }

  private async session(socket: Socket): Promise<Session> {
    const rawToken = String(socket.handshake.auth?.sessionToken || '').trim();
    let session: Session | null = null;
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      session = this.sessions.get(tokenHash) || null;
      if (!session && this.persistence.loadSession) {
        const persisted = await this.persistence.loadSession(tokenHash);
        if (persisted) {
          session = { id: persisted.id, name: persisted.name, tokenHash: persisted.tokenHash };
          this.sessions.set(session.tokenHash, session);
        }
      }
    }
    if (!session) {
      const newToken = randomBytes(24).toString('hex');
      const tokenHash = hashToken(newToken);
      session = { id: randomBytes(8).toString('hex'), name: 'Guest', tokenHash };
      this.sessions.set(session.tokenHash, session);
      await this.trackPersistence(this.persistence.saveSession(session)).catch(() => {});
      socket.emit('session', { sessionToken: newToken, playerId: session.id, name: session.name });
    } else {
      socket.emit('session', { sessionToken: rawToken, playerId: session.id, name: session.name });
    }
    this.socketSessions.set(socket.id, session);
    return session;
  }

  private queueAction(room: Room, actionId: string | undefined, action: () => Promise<ActionResult>): Promise<ActionResult> {
    const run = room.actionTail.then(async () => {
      if (actionId) {
        const previous = room.processedActions.get(actionId);
        if (previous) return previous;
      }
      try {
        const result = await action();
        if (actionId) {
          room.processedActions.set(actionId, result);
          while (room.processedActions.size > MAX_PROCESSED_ACTIONS) {
            const oldest = room.processedActions.keys().next().value;
            if (oldest !== undefined) room.processedActions.delete(oldest);
          }
        }
        return result;
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    });
    room.actionTail = run.then(() => undefined, () => undefined);
    return run;
  }

  private resetTurnTimer(room: Room) {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = undefined;
    }
    if (room.state.status !== 'playing') {
      return;
    }

    const expectedVersion = room.state.version;
    room.turnTimerVersion = expectedVersion;
    const now = Date.now();
    const duration = room.state.turnDurationMs || (Number(process.env.TURN_TIMEOUT_SECONDS || 30) * 1000);
    const deadline = room.state.turnExpiresAt ?? (now + duration);
    const delayMs = Math.max(0, deadline - now);

    room.turnTimer = setTimeout(() => {
      this.handleTurnTimeout(room.code, expectedVersion).catch(() => {});
    }, delayMs);
  }

  public async forceTurnTimeout(roomCode: string): Promise<ActionResult> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Room not found' };
    return this.handleTurnTimeout(roomCode, room.state.version);
  }

  public setRoomTurnDuration(roomCode: string, durationMs: number): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.state.turnDurationMs = durationMs;
      if (room.state.status === 'playing') {
        room.state.turnExpiresAt = Date.now() + durationMs;
        this.resetTurnTimer(room);
        this.emitRoom(this.io, room);
      }
    }
  }

  private recordMoveStats(
    room: Room,
    seat: PlayerIndex,
    token: number,
    result: { captured: boolean }
  ) {
    const stats = room.matchStats;
    if (!stats) return;
    if (result.captured) stats.captures += 1;
    const landed = room.state.tokens[seat]?.[token];
    if (landed?.kind === 'path' && SAFE_CELLS.has(absoluteCell(seat, landed.progress))) {
      stats.safeMoves += 1;
    }
    if (room.state.status === 'finished' && !stats.finishedAt) {
      stats.finishedAt = Date.now();
    }
  }

  private pickRandomLegalToken(state: GameState, seat: PlayerIndex, dice: number): { token: number; legalCount: number } | null {
    const legal = legalTokens(state, seat, dice);
    if (legal.length === 0) return null;
    if (legal.length === 1) return { token: legal[0], legalCount: 1 };
    return { token: legal[randomInt(0, legal.length)], legalCount: legal.length };
  }

  private getTimeoutTargetSeats(room: Room): PlayerIndex[] {
    const finishedSet = new Set(room.state.rankings || []);
    const connectedSeats = [...room.players.values()]
      .filter((p) => p.connected && !finishedSet.has(p.seat))
      .map((p) => p.seat);
    const allOccupiedSeats = [...room.players.values()]
      .filter((p) => !finishedSet.has(p.seat))
      .map((p) => p.seat);
    return connectedSeats.length > 0 ? connectedSeats : allOccupiedSeats;
  }

  private async executeAuthoritativeMove(
    room: Room,
    seat: PlayerIndex,
    token: number,
    options?: { autoReason?: 'single' | 'timeout' }
  ): Promise<ActionResult> {
    if (room.state.status !== 'playing') {
      return { ok: false, error: 'Game is not active', version: room.state.version, state: this.snapshot(room) };
    }
    if (room.state.currentPlayer !== seat) {
      return { ok: false, error: 'not your turn', version: room.state.version, state: this.snapshot(room) };
    }
    if (room.state.rankings && room.state.rankings.includes(seat)) {
      return { ok: false, error: 'Player already finished', version: room.state.version, state: this.snapshot(room) };
    }
    const activeDice = room.state.dice;
    if (activeDice === null) {
      return { ok: false, error: 'No active dice', version: room.state.version, state: this.snapshot(room) };
    }

    const legal = legalTokens(room.state, seat, activeDice);
    if (!Number.isInteger(token) || !legal.includes(token)) {
      return { ok: false, error: 'illegal token move', version: room.state.version, state: this.snapshot(room) };
    }

    const playerName = [...room.players.values()].find((p) => p.seat === seat)?.name || `Player ${seat + 1}`;
    const moveResult = moveToken(room.state, seat, token, activeDice);
    room.state = moveResult.state;

    if (options?.autoReason && !moveResult.winner && !moveResult.finished) {
      room.state = {
        ...room.state,
        lastNotice:
          options.autoReason === 'single'
            ? {
                type: 'auto_move',
                autoReason: 'single',
                message: 'Only one legal move — moving automatically.',
                seat,
                playerName,
                dice: activeDice,
                timestamp: Date.now(),
              }
            : {
                type: 'timeout',
                autoReason: 'timeout',
                message: "Time's up! A random legal move was selected.",
                seat,
                playerName,
                dice: activeDice,
                timestamp: Date.now(),
              },
      };
    }

    this.recordMoveStats(room, seat, token, moveResult);
    this.resetTurnTimer(room);
    await this.save(room);

    this.emitRoom(this.io, room, 'token_moved', {
      seat,
      playerName,
      token,
      dice: activeDice,
      captured: moveResult.captured,
      capturedSeat: moveResult.capturedSeat,
      winner: moveResult.winner,
      finished: moveResult.finished,
      pawnReachedHome: moveResult.pawnReachedHome,
      rank: moveResult.rank,
      auto: Boolean(options?.autoReason),
      ...(options?.autoReason ? { autoReason: options.autoReason } : {}),
    });

    return {
      ok: true,
      version: room.state.version,
      state: this.snapshot(room),
      ...(options?.autoReason ? { autoMoved: true, autoToken: token, autoReason: options.autoReason } : {}),
    };
  }

  private async forfeitActiveTurn(
    room: Room,
    timedOutSeat: PlayerIndex,
    timedOutPlayerName: string
  ): Promise<ActionResult> {
    const previousDice = room.state.dice;
    const targetSeats = this.getTimeoutTargetSeats(room);
    room.state = forfeitTurn(room.state, targetSeats, Date.now());
    this.resetTurnTimer(room);
    await this.save(room);

    this.emitRoom(this.io, room, 'turn_timeout', {
      timedOutSeat,
      timedOutPlayer: timedOutPlayerName,
      hadRolled: previousDice !== null,
      previousDice,
      autoMoved: false,
      nextPlayerSeat: room.state.currentPlayer,
    });

    return { ok: true, version: room.state.version, autoMoved: false, state: this.snapshot(room) };
  }

  private async handleTurnTimeout(roomCode: string, expectedVersion: number): Promise<ActionResult> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Room not found' };

    return this.queueAction(room, undefined, async () => {
      if (room.state.status !== 'playing' || room.state.version !== expectedVersion) {
        return { ok: false, error: 'Stale timer' };
      }

      const timedOutSeat = room.state.currentPlayer;
      const finishedSet = new Set(room.state.rankings || []);
      const timedOutPlayer = [...room.players.values()].find((p) => p.seat === timedOutSeat);
      const timedOutPlayerName = timedOutPlayer?.name || `Player ${timedOutSeat + 1}`;

      // Ineligible or removed players cannot receive automated token moves; advance cleanly.
      if (!timedOutPlayer || finishedSet.has(timedOutSeat)) {
        return this.forfeitActiveTurn(room, timedOutSeat, timedOutPlayerName);
      }

      // Apply reconnect grace before taking automated action on a disconnected player's turn.
      if (!timedOutPlayer.connected) {
        const now = Date.now();
        const graceEndsAt = timedOutPlayer.lastSeenAt + this.sessionGraceMs;
        if (now < graceEndsAt) {
          room.state.turnExpiresAt = graceEndsAt;
          this.resetTurnTimer(room);
          return {
            ok: false,
            error: 'Player disconnected within grace period',
            version: room.state.version,
            state: this.snapshot(room),
          };
        }
        return this.forfeitActiveTurn(room, timedOutSeat, timedOutPlayerName);
      }

      const previousDice = room.state.dice;
      const pick = previousDice !== null ? this.pickRandomLegalToken(room.state, timedOutSeat, previousDice) : null;
      if (previousDice !== null && pick !== null) {
        try {
          const moveResult = await this.executeAuthoritativeMove(room, timedOutSeat, pick.token, {
            autoReason: 'timeout',
          });
          if (moveResult.ok) {
            this.emitRoom(this.io, room, 'turn_timeout', {
              timedOutSeat,
              timedOutPlayer: timedOutPlayerName,
              hadRolled: true,
              previousDice,
              autoMoved: true,
              autoToken: pick.token,
              autoReason: 'timeout',
              legalCount: pick.legalCount,
              nextPlayerSeat: room.state.currentPlayer,
            });
            return moveResult;
          }
        } catch {
          // Fall through to the forfeit path if the auto move could not be applied.
        }
      }

      return this.forfeitActiveTurn(room, timedOutSeat, timedOutPlayerName);
    });
  }

  bind(io: Server) {
    this.io = io;
    // Resume timers for any active games recovered from persistence
    for (const room of this.rooms.values()) {
      if (room.state.status === 'playing') {
        this.resetTurnTimer(room);
      }
    }

    io.on('connection', (socket) => {
      const sessionPromise = this.session(socket);

      socket.on('create_room', async (payload: { name?: string } | string, ack?: (value: unknown) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const session = await sessionPromise;
        const name = cleanName(typeof payload === 'string' ? payload : payload?.name) || 'Guest';
        session.name = name;
        this.trackPersistence(this.persistence.touchSession(session.id, name)).catch(() => {});

        let code = makeCode();
        while (this.rooms.has(code)) code = makeCode();

        const player: RoomPlayer = { id: session.id, name, color: COLORS[0], seat: 0, connected: true, socketId: socket.id, lastSeenAt: Date.now() };
        const room: Room = {
          code,
          host: session.id,
          players: new Map([[session.id, player]]),
          state: initialState([player]),
          expiryTimers: new Map(),
          turnTimer: undefined,
          turnTimerVersion: undefined,
          actionTail: Promise.resolve(),
          processedActions: new Map(),
          snapshotHistory: new Map(),
          matchStats: makeMatchStats(),
        };
        this.rooms.set(code, room);
        session.roomCode = code;
        socket.join(code);
        this.recordSnapshot(room);
        await this.save(room);
        ack?.({ ok: true, roomCode: code, state: this.snapshot(room) });
        this.emitRoom(io, room, 'lobby_updated');
      });

      socket.on('join_room', async (payload: { roomCode?: string; name?: string }, ack?: (value: unknown) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const abuseCheck = this.checkRoomAbuse(socket.id);
        if (!abuseCheck.allowed) return this.sendError(ack, abuseCheck.message!);

        const session = await sessionPromise;
        const code = String(payload?.roomCode || '').trim().toUpperCase();
        if (!isValidCode(code)) {
          this.recordFailedJoin(socket.id);
          return this.sendError(ack, 'Invalid room code');
        }

        const room = this.rooms.get(code);
        if (!room) {
          this.recordFailedJoin(socket.id);
          return this.sendError(ack, 'Room not found');
        }

        const name = cleanName(payload?.name) || 'Guest';
        session.name = name;
        this.trackPersistence(this.persistence.touchSession(session.id, name)).catch(() => {});

        if (room.players.has(session.id)) {
          this.attach(socket, session, room);
          await this.save(room);
          this.emitRoom(io, room, 'player_reconnected');
          return ack?.({ ok: true, roomCode: code, state: this.snapshot(room), reconnected: true });
        }

        if (room.state.status !== 'lobby') return this.sendError(ack, 'Game already started');
        if (room.players.size >= MAX_PLAYERS) return this.sendError(ack, 'Room is full');

        const takenSeats = new Set([...room.players.values()].map((p) => p.seat));
        let seat: PlayerIndex = 0;
        for (let s = 0; s < MAX_PLAYERS; s++) {
          if (!takenSeats.has(s as PlayerIndex)) {
            seat = s as PlayerIndex;
            break;
          }
        }
        const player: RoomPlayer = { id: session.id, name, color: COLORS[seat], seat, connected: true, socketId: socket.id, lastSeenAt: Date.now() };
        room.players.set(session.id, player);
        // Rebuilding the lobby state must keep the host's chosen turn clock.
        room.state = initialState([...room.players.values()], room.state.version, room.state.turnDurationMs);
        this.attach(socket, session, room);
        this.recordSnapshot(room);
        await this.save(room);
        ack?.({ ok: true, roomCode: code, state: this.snapshot(room) });
        this.emitRoom(io, room, 'lobby_updated');
      });

      socket.on('leave_room', async (roomCode: string, ack?: (value: unknown) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const session = await sessionPromise;
        const code = String(roomCode || '').trim().toUpperCase();
        const room = this.rooms.get(code);
        if (!room) return this.sendError(ack, 'Room not found');

        await this.queueAction(room, undefined, async () => {
          room.players.delete(session.id);
          session.roomCode = undefined;
          socket.leave(room.code);

          if (room.players.size === 0) {
            if (room.turnTimer) {
              clearTimeout(room.turnTimer);
              room.turnTimer = undefined;
            }
            for (const timer of room.expiryTimers.values()) {
              clearTimeout(timer);
            }
            room.expiryTimers.clear();
            this.rooms.delete(room.code);
            await this.trackPersistence(this.persistence.deleteRoom(room.code));
          } else {
            const leavingTimer = room.expiryTimers.get(session.id);
            if (leavingTimer) {
              clearTimeout(leavingTimer);
              room.expiryTimers.delete(session.id);
            }
            if (room.host === session.id) room.host = [...room.players.keys()][0];
            if (room.state.status === 'lobby') {
              // Rebuilding the lobby state must keep the host's chosen turn clock.
        room.state = initialState([...room.players.values()], room.state.version, room.state.turnDurationMs);
            }
            this.recordSnapshot(room);
            await this.save(room);
            this.emitRoom(io, room, 'lobby_updated');
          }
          ack?.({ ok: true });
          return { ok: true };
        });
      });

      // Host picks how long each turn runs; it lives on the room state so joins,
      // leaves, rematches and reconnects all reuse the same clock.
      socket.on(
        'set_turn_duration',
        async (payload: { roomCode?: string; seconds?: number }, ack?: (value: ActionResult) => void) => {
          if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
          const session = await sessionPromise;
          const code = String(payload?.roomCode || '').trim().toUpperCase();
          const room = this.rooms.get(code);
          if (!room) return this.sendError(ack, 'Room not found');

          const seconds = Number(payload?.seconds);
          if (!TURN_DURATION_OPTIONS.includes(seconds as (typeof TURN_DURATION_OPTIONS)[number])) {
            return this.sendError(ack, 'Turn clock must be 15, 30 or 60 seconds');
          }

          const result = await this.queueAction(room, undefined, async () => {
            if (room.host !== session.id) return { ok: false, error: 'Host only' };
            if (room.state.status !== 'lobby') return { ok: false, error: 'Match already started' };
            room.state.turnDurationMs = seconds * 1000;
            await this.save(room);
            this.emitRoom(io, room, 'lobby_updated');
            return { ok: true, version: room.state.version, state: this.snapshot(room) };
          });

          ack?.(result);
        }
      );

      socket.on('start_game', async (payload: string | ActionEnvelope, ack?: (value: ActionResult) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const session = await sessionPromise;
        const code = roomCodeOf(payload);
        const room = this.rooms.get(code);
        if (!room) return this.sendError(ack, 'Room not found');

        const isObj = typeof payload === 'object';
        const actionId = actionIdOf(payload);

        const result = await this.queueAction(room, actionId, async () => {
          if (room.host !== session.id) return { ok: false, error: 'Host only' };
          if (room.players.size < MIN_PLAYERS) {
            return { ok: false, error: 'Need at least 2 players to start' };
          }
          if (room.players.size > MAX_PLAYERS) {
            return { ok: false, error: 'Room is full' };
          }
          if ([...room.players.values()].some((p) => !p.connected)) {
            return { ok: false, error: 'All players must be connected' };
          }
          if (room.state.status !== 'lobby') {
            return { ok: false, error: 'Game already started' };
          }
          const currentVer = room.state.version;
          room.state = startGame({
            ...initialState([...room.players.values()], currentVer, room.state.turnDurationMs),
            players: [...room.players.values()],
            version: currentVer,
          });
          room.matchStats = makeMatchStats();
          this.resetTurnTimer(room);
          await this.save(room);
          this.emitRoom(io, room, 'game_started');
          return { ok: true, version: room.state.version, state: this.snapshot(room) };
        });

        if (!result.ok && !isObj) {
          ack?.({ ok: false, error: result.error });
        } else {
          ack?.(result);
        }
      });

      socket.on('request_rematch', async (payload: string | ActionEnvelope, ack?: (value: ActionResult) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const session = await sessionPromise;
        const code = roomCodeOf(payload);
        const room = this.rooms.get(code);
        if (!room) return this.sendError(ack, 'Room not found');

        const isObj = typeof payload === 'object';
        const actionId = actionIdOf(payload);

        const result = await this.queueAction(room, actionId, async () => {
          if (room.host !== session.id) return { ok: false, error: 'Host only' };
          if (room.state.status !== 'finished') return { ok: false, error: 'Match is not finished' };
          if (room.players.size < MIN_PLAYERS || room.players.size > MAX_PLAYERS) {
            return { ok: false, error: 'Need at least 2 players to rematch' };
          }
          if ([...room.players.values()].some((p) => !p.connected)) {
            return { ok: false, error: 'All players must be connected' };
          }

          // MONOTONIC VERSION PRESERVATION: Keep current room version so rematch continues sequence
          const currentVer = room.state.version;
          room.state = startGame({
            ...initialState([...room.players.values()], currentVer, room.state.turnDurationMs),
            players: [...room.players.values()],
            version: currentVer,
          });
          room.matchStats = makeMatchStats();

          this.resetTurnTimer(room);
          await this.save(room);
          this.emitRoom(io, room, 'rematch_started');
          return { ok: true, version: room.state.version, state: this.snapshot(room) };
        });

        if (!result.ok && !isObj) {
          ack?.({ ok: false, error: result.error });
        } else {
          ack?.(result);
        }
      });

      socket.on('roll_dice', async (payload: string | ActionEnvelope, ack?: (value: ActionResult) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const session = await sessionPromise;
        const code = roomCodeOf(payload);
        const room = this.rooms.get(code);
        const player = room?.players.get(session.id);
        const isObj = typeof payload === 'object';
        if (!room || !player) return this.sendError(ack, 'Not in room', isObj, room);

        const envelope = isObj ? (payload as ActionEnvelope) : undefined;
        const actionId = actionIdOf(payload);

        const result = await this.queueAction(room, actionId, async () => {
          // Version gap or stale client check
          if (envelope?.expectedVersion !== undefined && envelope.expectedVersion !== room.state.version) {
            return {
              ok: false,
              error: 'Version mismatch',
              version: room.state.version,
              state: this.snapshot(room),
            };
          }

          if (room.state.rankings && room.state.rankings.includes(player.seat)) {
            return isObj
              ? { ok: false, error: 'Player already finished', version: room.state.version, state: this.snapshot(room) }
              : { ok: false, error: 'Player already finished' };
          }

          if (room.state.currentPlayer !== player.seat || room.state.status !== 'playing' || room.state.dice !== null) {
            return isObj
              ? { ok: false, error: 'cannot roll now', version: room.state.version, state: this.snapshot(room) }
              : { ok: false, error: 'cannot roll now' };
          }

          const allowDeterministicDice = process.env.NODE_ENV === 'test' && typeof envelope?.deterministicDice === 'number';
          const value = allowDeterministicDice && envelope!.deterministicDice! >= 1 && envelope!.deterministicDice! <= 6
            ? envelope!.deterministicDice!
            : randomInt(1, 7);

          try {
            room.state = roll(room.state, player.seat, value);
            room.matchStats.rolls += 1;
            const postRollLegal =
              room.state.status === 'playing' && room.state.dice !== null
                ? legalTokens(room.state, player.seat, room.state.dice)
                : [];
            const willAutoMove = postRollLegal.length === 1;

            this.resetTurnTimer(room);
            await this.save(room);
            this.emitRoom(io, room, 'dice_rolled', {
              seat: player.seat,
              playerName: player.name,
              value,
              hasLegalMoves: postRollLegal.length > 0,
              legalCount: postRollLegal.length,
              autoMoved: willAutoMove,
              ...(willAutoMove ? { autoToken: postRollLegal[0], autoReason: 'single' } : {}),
              isExtraTurn: value === 6,
            });

            if (willAutoMove) {
              const autoResult = await this.executeAuthoritativeMove(room, player.seat, postRollLegal[0], {
                autoReason: 'single',
              });
              if (autoResult.ok) {
                return { ...autoResult, value };
              }
            }

            return { ok: true, value, version: room.state.version, state: this.snapshot(room) };
          } catch (error) {
            return isObj
              ? { ok: false, error: (error as Error).message, version: room.state.version, state: this.snapshot(room) }
              : { ok: false, error: (error as Error).message };
          }
        });

        ack?.(result);
      });

      socket.on('move_token', async (payload: ActionEnvelope, ack?: (value: ActionResult) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const session = await sessionPromise;
        const code = roomCodeOf(payload);
        const room = this.rooms.get(code);
        const player = room?.players.get(session.id);
        const isObj = typeof payload === 'object';
        if (!room || !player) return this.sendError(ack, 'Not in room', isObj, room);

        const actionId = actionIdOf(payload);

        const result = await this.queueAction(room, actionId, async () => {
          if (payload.expectedVersion !== undefined && payload.expectedVersion !== room.state.version) {
            return {
              ok: false,
              error: 'Version mismatch',
              version: room.state.version,
              state: this.snapshot(room),
            };
          }

          try {
            const res = await this.executeAuthoritativeMove(room, player.seat, Number(payload.token));
            if (!res.ok && !isObj) {
              return { ok: false, error: res.error };
            }
            return res;
          } catch (error) {
            return isObj
              ? { ok: false, error: (error as Error).message, version: room.state.version, state: this.snapshot(room) }
              : { ok: false, error: (error as Error).message };
          }
        });

        ack?.(result);
      });

      socket.on('request_game_state', async (payload: string | { roomCode: string; sinceVersion?: number }, ack?: (value: ActionResult) => void) => {
        if (!this.checkRateLimit(socket.id)) return this.sendError(ack, 'Rate limit exceeded');
        const session = await sessionPromise;
        const code = roomCodeOf(payload);
        const room = this.rooms.get(code);
        if (room && this.attach(socket, session, room)) {
          const snap = this.snapshot(room);
          socket.emit('state', snap);
          socket.emit('room_state', snap);
          socket.to(room.code).emit('player_reconnected', snap);

          let history: RoomSnapshot[] | undefined;
          if (typeof payload === 'object' && typeof payload.sinceVersion === 'number') {
            history = [];
            for (let v = payload.sinceVersion + 1; v <= snap.version; v++) {
              const h = room.snapshotHistory.get(v);
              if (h) history.push(h);
            }
          }

          ack?.({ ok: true, version: snap.version, state: snap, history });
        } else {
          this.sendError(ack, 'Not in room');
        }
      });

      socket.on('disconnect', async () => {
        this.socketRateLimits.delete(socket.id);
        this.failedJoins.delete(socket.id);

        const current = (await sessionPromise) || this.socketSessions.get(socket.id);
        if (!current?.roomCode) return;
        const room = this.rooms.get(current.roomCode);
        const player = room?.players.get(current.id);
        if (!room || !player || player.socketId !== socket.id) return;

        player.connected = false;
        player.socketId = undefined;
        player.lastSeenAt = Date.now();

        if (room.host === current.id) {
          const connected = [...room.players.values()].find((candidate) => candidate.connected);
          if (connected) room.host = connected.id;
        }

        await this.save(room);
        this.emitRoom(io, room, 'player_disconnected');

        const existingExpiry = room.expiryTimers.get(current.id);
        if (existingExpiry) clearTimeout(existingExpiry);

        const disconnectAt = player.lastSeenAt;
        const expiryTimer = setTimeout(async () => {
          await this.queueAction(room, undefined, async () => {
            room.expiryTimers.delete(current.id);
            const currentPlayer = room.players.get(current.id);
            if (!currentPlayer || currentPlayer.connected || currentPlayer.lastSeenAt !== disconnectAt) {
              return { ok: false, error: 'Player reconnected' };
            }

            const removedSeat = currentPlayer.seat;
            const removedName = currentPlayer.name;
            room.players.delete(current.id);

            if (room.state.status === 'lobby') {
              // Rebuilding the lobby state must keep the host's chosen turn clock.
              room.state = initialState([...room.players.values()], room.state.version, room.state.turnDurationMs);
            }

            if (room.players.size === 0) {
              if (room.turnTimer) {
                clearTimeout(room.turnTimer);
                room.turnTimer = undefined;
              }
              for (const t of room.expiryTimers.values()) clearTimeout(t);
              room.expiryTimers.clear();
              this.rooms.delete(room.code);
              await this.trackPersistence(this.persistence.deleteRoom(room.code));
              return { ok: true };
            }

            if (room.state.status === 'playing' && room.state.currentPlayer === removedSeat) {
              return this.forfeitActiveTurn(room, removedSeat, removedName);
            }

            await this.save(room);
            this.emitRoom(io, room, room.state.status === 'lobby' ? 'lobby_updated' : 'room_state');
            return { ok: true, version: room.state.version, state: this.snapshot(room) };
          });
        }, this.sessionGraceMs);

        room.expiryTimers.set(current.id, expiryTimer);
      });
    });
  }
}
