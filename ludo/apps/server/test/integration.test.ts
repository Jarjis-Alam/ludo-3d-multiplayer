import { describe, expect, it, afterEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createLudoServer, parseOrigin } from '../src/index.js';

type Client = { socket: Socket; token: string; playerId: string };
const clients: Socket[] = [];
async function client(url: string): Promise<Client> {
  const socket = connect(url, { autoConnect: false }); clients.push(socket);
  const session = new Promise<{ sessionToken: string; playerId: string }>((resolve) => socket.once('session', resolve));
  socket.connect(); const value = await session; return { socket, token: value.sessionToken, playerId: value.playerId };
}
function event(socket: Socket, name: string) { return new Promise<any>((resolve) => socket.once(name, resolve)); }

afterEach(() => { for (const socket of clients.splice(0)) socket.disconnect(); });

describe('four-player multiplayer', () => {
  it('creates a room, fills four seats, rejects a fifth and synchronizes lobby updates', async () => {
    const server = await createLudoServer(); await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const address = server.httpServer.address(); const url = `http://127.0.0.1:${(address as any).port}`;
    const [a, b, c, d, e] = await Promise.all([client(url), client(url), client(url), client(url), client(url)]);
    const created = new Promise<any>((resolve) => a.socket.emit('create_room', { name: 'Alice' }, resolve)); const room = await created;
    expect(room.ok).toBe(true); expect(room.state.players).toHaveLength(1);
    const joins = await Promise.all([['Bob', b], ['Cara', c], ['Drew', d]].map(([name, item]) => new Promise<any>((resolve) => (item as Client).socket.emit('join_room', { roomCode: room.roomCode, name }, resolve))));
    expect(joins.every((result) => result.ok)).toBe(true);
    const lastJoin = joins.find((j) => j.state.players.length === 4) ?? joins[2];
    expect(lastJoin.state.players.map((p: any) => p.color)).toEqual(['red', 'green', 'yellow', 'blue']);
    const full = await new Promise<any>((resolve) => e.socket.emit('join_room', { roomCode: room.roomCode, name: 'Eve' }, resolve)); expect(full).toEqual({ ok: false, error: 'Room is full' });
    server.httpServer.close();
  });

  it('enforces host-only start and synchronizes the first authoritative roll', async () => {
    const server = await createLudoServer(); await new Promise<void>((resolve) => server.httpServer.listen(0, resolve)); const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;
    const players = await Promise.all([0, 1, 2, 3].map(() => client(url))); const room = await new Promise<any>((resolve) => players[0].socket.emit('create_room', { name: 'Host' }, resolve));
    for (let i = 1; i < players.length; i++) await new Promise((resolve) => players[i].socket.emit('join_room', { roomCode: room.roomCode, name: `P${i}` }, resolve));
    const denied = await new Promise<any>((resolve) => players[1].socket.emit('start_game', room.roomCode, resolve)); expect(denied).toEqual({ ok: false, error: 'Host only' });
    const startedEvents = players.slice(1).map((p) => event(p.socket, 'game_started')); const started = new Promise<any>((resolve) => players[0].socket.emit('start_game', room.roomCode, resolve)); expect((await started).ok).toBe(true); await Promise.all(startedEvents); const invalidRoll = await new Promise<any>((resolve) => players[1].socket.emit('roll_dice', room.roomCode, resolve)); expect(invalidRoll).toEqual({ ok: false, error: 'cannot roll now' });
    const updateEvent = event(players[2].socket, 'room_state'); const roll = new Promise<any>((resolve) => players[0].socket.emit('roll_dice', room.roomCode, resolve)); const update = await updateEvent; const result = await roll; expect(result.ok).toBe(true); expect(update.version).toBe(2); expect(update.dice === null || (update.dice >= 1 && update.dice <= 6)).toBe(true);
    server.httpServer.close();
  });

  it('reconnects a disconnected player to the same reserved seat and state', async () => {
    const server = await createLudoServer(); await new Promise<void>((resolve) => server.httpServer.listen(0, resolve)); const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;
    const [host, guest] = await Promise.all([client(url), client(url)]); const room = await new Promise<any>((resolve) => host.socket.emit('create_room', { name: 'Host' }, resolve)); await new Promise((resolve) => guest.socket.emit('join_room', { roomCode: room.roomCode, name: 'Guest' }, resolve)); const originalId = guest.playerId;
    guest.socket.disconnect(); await new Promise((resolve) => setTimeout(resolve, 30)); const resumed = connect(url, { auth: { sessionToken: guest.token }, autoConnect: false }); clients.push(resumed); const resumedSession = event(resumed, 'session'); resumed.connect(); await resumedSession; const state = event(resumed, 'state'); resumed.emit('request_game_state', room.roomCode); const snapshot = await state; expect(snapshot.players.find((p: any) => p.id === originalId).seat).toBe(1); expect(snapshot.players.find((p: any) => p.id === originalId).connected).toBe(true); server.httpServer.close();
  });

  it('enforces CORS origin parsing and strictly rejects wildcard in production', () => {
    // Default fallback
    expect(parseOrigin()).toBe('http://localhost:5173');

    // Single exact origin
    expect(parseOrigin('https://ludo-multiplayer.vercel.app')).toBe('https://ludo-multiplayer.vercel.app');

    // Comma-separated origins (production + local dev)
    expect(parseOrigin('https://ludo.vercel.app, http://localhost:5173')).toEqual([
      'https://ludo.vercel.app',
      'http://localhost:5173',
    ]);

    // Wildcard rejected in production
    const oldEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => parseOrigin('*')).toThrowError(/CLIENT_ORIGIN="\*" is prohibited in production/);
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });

  it('prevents starting with fewer than 2 players, then starts cleanly with 2 players', async () => {
    const server = await createLudoServer();
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [host, guest] = await Promise.all([client(url), client(url)]);
    const room = await new Promise<any>((resolve) => host.socket.emit('create_room', { name: 'Host' }, resolve));
    expect(room.ok).toBe(true);

    // Host tries to start alone with 1 player -> rejected
    const aloneStart = await new Promise<any>((resolve) => host.socket.emit('start_game', room.roomCode, resolve));
    expect(aloneStart).toEqual({ ok: false, error: 'Need at least 2 players to start' });

    // Guest joins room -> 2 players present
    const joinResult = await new Promise<any>((resolve) => guest.socket.emit('join_room', { roomCode: room.roomCode, name: 'Guest' }, resolve));
    expect(joinResult.ok).toBe(true);
    expect(joinResult.state.players).toHaveLength(2);

    // Host starts match with 2 players -> succeeds
    const guestStartedEvent = event(guest.socket, 'game_started');
    const startResult = await new Promise<any>((resolve) => host.socket.emit('start_game', room.roomCode, resolve));
    expect(startResult.ok).toBe(true);
    expect(startResult.state.status).toBe('playing');
    expect(startResult.state.currentPlayer).toBe(0);
    const guestSnap = await guestStartedEvent;
    expect(guestSnap.status).toBe('playing');
    expect(guestSnap.tokens[0]).toHaveLength(4);
    expect(guestSnap.tokens[1]).toHaveLength(4);
    expect(guestSnap.tokens[2]).toHaveLength(0);
    expect(guestSnap.tokens[3]).toHaveLength(0);

    // Allow any buffered start_game events to flush before attaching listener for roll
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Turn alternation in 2-player match:
    // Host rolls non-6 with all in base -> passes turn directly to Guest (seat 1), skipping seats 2 and 3
    const rollGuestEvent = event(guest.socket, 'room_state');
    const rollHost = await new Promise<any>((resolve) => host.socket.emit('roll_dice', { roomCode: room.roomCode, deterministicDice: 4 }, resolve));
    expect(rollHost.ok).toBe(true);
    expect(rollHost.state.currentPlayer).toBe(1);
    const guestStateAfterPass = await rollGuestEvent;
    expect(guestStateAfterPass.currentPlayer).toBe(1);

    // Guest rolls non-6 -> passes turn directly back to Host (seat 0)
    const rollHostEvent = event(host.socket, 'room_state');
    const rollGuest = await new Promise<any>((resolve) => guest.socket.emit('roll_dice', { roomCode: room.roomCode, deterministicDice: 2 }, resolve));
    expect(rollGuest.ok).toBe(true);
    expect(rollGuest.state.currentPlayer).toBe(0);
    const hostStateAfterPass = await rollHostEvent;
    expect(hostStateAfterPass.currentPlayer).toBe(0);

    server.httpServer.close();
  });

  it('runs a 3-player match with turn rotation skipping the empty 4th seat', async () => {
    const server = await createLudoServer();
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2] = await Promise.all([client(url), client(url), client(url)]);
    const room = await new Promise<any>((resolve) => p0.socket.emit('create_room', { name: 'P0' }, resolve));
    await new Promise<any>((resolve) => p1.socket.emit('join_room', { roomCode: room.roomCode, name: 'P1' }, resolve));
    const join2 = await new Promise<any>((resolve) => p2.socket.emit('join_room', { roomCode: room.roomCode, name: 'P2' }, resolve));
    expect(join2.state.players).toHaveLength(3);

    const start = await new Promise<any>((resolve) => p0.socket.emit('start_game', room.roomCode, resolve));
    expect(start.ok).toBe(true);
    expect(start.state.currentPlayer).toBe(0);

    // P0 rolls 3 -> auto-pass to P1 (seat 1)
    const roll0 = await new Promise<any>((resolve) => p0.socket.emit('roll_dice', { roomCode: room.roomCode, deterministicDice: 3 }, resolve));
    expect(roll0.state.currentPlayer).toBe(1);

    // P1 rolls 2 -> auto-pass to P2 (seat 2)
    const roll1 = await new Promise<any>((resolve) => p1.socket.emit('roll_dice', { roomCode: room.roomCode, deterministicDice: 2 }, resolve));
    expect(roll1.state.currentPlayer).toBe(2);

    // P2 rolls 5 -> auto-pass directly back to P0 (seat 0), skipping seat 3!
    const roll2 = await new Promise<any>((resolve) => p2.socket.emit('roll_dice', { roomCode: room.roomCode, deterministicDice: 5 }, resolve));
    expect(roll2.state.currentPlayer).toBe(0);

    server.httpServer.close();
  });
});
