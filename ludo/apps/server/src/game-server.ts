import { createHmac, randomBytes, randomInt } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { initialState, startGame, roll, moveToken, type GameState, type Player, type PlayerIndex, legalTokens } from '@ludo/game-engine';
import type { Persistence, PersistedRoom } from './persistence.js';

const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
const MAX_PLAYERS = 4;
const SESSION_GRACE_MS = 60_000;
const MAX_PROCESSED_ACTIONS = 2_000;
const MAX_HISTORY_SNAPSHOTS = 100;
const SESSION_SECRET = process.env.SESSION_SECRET || 'ludo-secret-session-key-development';

export type RoomPlayer = Player & { connected: boolean; socketId?: string; lastSeenAt: number };
export type RoomSnapshot = GameState & { roomCode: string; host: string; invitationPath: string; players: RoomPlayer[] };
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
};
type Room = {
  code: string;
  host: string;
  players: Map<string, RoomPlayer>;
  state: GameState;
  expiry?: NodeJS.Timeout;
  actionTail: Promise<void>;
  processedActions: Map<string, ActionResult>;
  snapshotHistory: Map<number, RoomSnapshot>;
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

  constructor(private readonly persistence: Persistence, private readonly invitationOrigin = 'http://localhost:5173') {}

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
        actionTail: Promise.resolve(),
        processedActions: new Map(),
        snapshotHistory: new Map(),
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
    await this.trackPersistence(this.persistence.saveRoom({
      code: room.code,
      host: room.host,
      players: [...room.players.values()].map(({ connected, socketId, lastSeenAt, ...player }) => player),
      state: room.state,
    }));
  }

  private sendError(ack: ((value: ActionResult) => void) | undefined, error: string, isObjectCall = false, room?: Room) {
    if (isObjectCall && room) {
      ack?.({ ok: false, error, version: room.state.version, state: this.snapshot(room) });
    } else {
      ack?.({ ok: false, error });
    }
  }

  private emitRoom(io: Server, room: Room, event = 'room_state') {
    const snap = this.recordSnapshot(room);
    io.to(room.code).emit(event, snap);
    if (event !== 'room_state') {
      io.to(room.code).emit('room_state', snap);
    }
  }

  private attach(socket: Socket, session: Session, room: Room) {
    const player = room.players.get(session.id);
    if (!player) return false;
    player.connected = true;
    player.socketId = socket.id;
    player.lastSeenAt = Date.now();
    session.roomCode = room.code;
    socket.join(room.code);
    this.socketSessions.set(socket.id, session);
    if (room.expiry) {
      clearTimeout(room.expiry);
      room.expiry = undefined;
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

  bind(io: Server) {
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
          expiry: undefined,
          actionTail: Promise.resolve(),
          processedActions: new Map(),
          snapshotHistory: new Map(),
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

        const seat = room.players.size as PlayerIndex;
        const player: RoomPlayer = { id: session.id, name, color: COLORS[seat], seat, connected: true, socketId: socket.id, lastSeenAt: Date.now() };
        room.players.set(session.id, player);
        room.state = initialState([...room.players.values()]);
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
            this.rooms.delete(room.code);
            await this.trackPersistence(this.persistence.deleteRoom(room.code));
          } else {
            if (room.host === session.id) room.host = [...room.players.keys()][0];
            room.state = { ...room.state, players: [...room.players.values()] };
            this.recordSnapshot(room);
            await this.save(room);
            this.emitRoom(io, room, 'lobby_updated');
          }
          ack?.({ ok: true });
          return { ok: true };
        });
      });

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
          if (room.players.size !== MAX_PLAYERS || [...room.players.values()].some((p) => !p.connected)) {
            return { ok: false, error: 'Four connected players required' };
          }
          if (room.state.status !== 'lobby') {
            return { ok: false, error: 'Game already started' };
          }
          room.state = startGame({ ...room.state, players: [...room.players.values()] });
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
          if (room.players.size !== MAX_PLAYERS || [...room.players.values()].some((p) => !p.connected)) {
            return { ok: false, error: 'Four connected players required' };
          }

          // MONOTONIC VERSION PRESERVATION: Keep current room version so rematch continues sequence
          const currentVer = room.state.version;
          room.state = startGame({
            ...initialState([...room.players.values()], currentVer),
            players: [...room.players.values()],
            version: currentVer,
          });

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
            await this.save(room);
            this.emitRoom(io, room);
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

          if (room.state.dice === null) {
            return isObj
              ? { ok: false, error: 'No active dice', version: room.state.version, state: this.snapshot(room) }
              : { ok: false, error: 'No active dice' };
          }

          const token = Number(payload.token);
          const legal = legalTokens(room.state, player.seat, room.state.dice);
          if (!legal.includes(token)) {
            return isObj
              ? { ok: false, error: 'illegal token move', version: room.state.version, state: this.snapshot(room) }
              : { ok: false, error: 'illegal token move' };
          }

          try {
            room.state = moveToken(room.state, player.seat, token, room.state.dice).state;
            await this.save(room);
            this.emitRoom(io, room);
            return { ok: true, version: room.state.version, state: this.snapshot(room) };
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

        room.expiry = setTimeout(async () => {
          const currentPlayer = room.players.get(current.id);
          if (currentPlayer && !currentPlayer.connected) {
            room.players.delete(current.id);
            room.state = { ...room.state, players: [...room.players.values()] };
            await this.save(room);
            this.emitRoom(io, room, 'lobby_updated');
          }
        }, SESSION_GRACE_MS);
      });
    });
  }
}
