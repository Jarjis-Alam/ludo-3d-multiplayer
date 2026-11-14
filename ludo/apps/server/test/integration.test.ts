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
});
