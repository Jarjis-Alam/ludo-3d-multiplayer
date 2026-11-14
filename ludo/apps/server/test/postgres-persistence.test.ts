import { describe, expect, it, afterEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { Pool } from 'pg';
import { createLudoServer } from '../src/index.js';
import { PostgresPersistence } from '../src/persistence.js';

const DB_URL = process.env.DATABASE_URL || 'postgresql:///ludo_db';
type Client = { socket: Socket; token: string; playerId: string };
const clients: Socket[] = [];

async function makeClient(url: string, token?: string): Promise<Client> {
  const socket = connect(url, {
    autoConnect: false,
    auth: token ? { sessionToken: token } : {},
  });
  clients.push(socket);
  const sessionPromise = new Promise<{ sessionToken: string; playerId: string }>((resolve) => {
    socket.once('session', resolve);
  });
  socket.connect();
  const session = await sessionPromise;
  return { socket, token: session.sessionToken, playerId: session.playerId };
}

function emit(socket: Socket, event: string, ...args: any[]): Promise<any> {
  return new Promise((resolve) => socket.emit(event, ...args, resolve));
}

afterEach(() => {
  for (const socket of clients.splice(0)) {
    socket.disconnect();
  }
});

describe('PostgreSQL Session and Room Persistence Recovery', () => {
  it('persists guest sessions to PostgreSQL and recovers after backend restart', async () => {
    const pool = new Pool({ connectionString: DB_URL });
    const persistence1 = new PostgresPersistence(pool);
    const server1 = await createLudoServer(persistence1);
    await new Promise<void>((res) => server1.httpServer.listen(0, res));
    const url1 = `http://127.0.0.1:${(server1.httpServer.address() as any).port}`;

    // Create 4 clients on server1
    const [c0, c1, c2, c3] = await Promise.all([
      makeClient(url1), makeClient(url1), makeClient(url1), makeClient(url1)
    ]);
    await server1.service.flushPersistence();

    // Save tokens and playerIds
    const tokens = [c0.token, c1.token, c2.token, c3.token];
    const playerIds = [c0.playerId, c1.playerId, c2.playerId, c3.playerId];

    // Check PostgreSQL database has 4 sessions recorded in player_sessions table
    const dbSessions = await pool.query('SELECT id, username FROM player_sessions WHERE id = ANY($1)', [playerIds]);
    expect(dbSessions.rows).toHaveLength(4);

    // Create room and join
    const created = await emit(c0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(c1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(c2.socket, 'join_room', { roomCode: code, name: 'Charlie' });
    await emit(c3.socket, 'join_room', { roomCode: code, name: 'Dave' });

    // Start game
    const started = await emit(c0.socket, 'start_game', { roomCode: code });
    expect(started.ok).toBe(true);
    expect(started.version).toBe(1);

    // Roll dice on server 1
    const rollRes = await emit(c0.socket, 'roll_dice', { roomCode: code });
    expect(rollRes.ok).toBe(true);
    const versionBeforeRestart = rollRes.version;
    await server1.service.flushPersistence();

    // Check game_rooms in database
    const dbRoom = await pool.query('SELECT status, snapshot FROM game_rooms WHERE room_code = $1', [code]);
    expect(dbRoom.rows).toHaveLength(1);
    expect(dbRoom.rows[0].status).toBe('playing');
    expect(dbRoom.rows[0].snapshot.state.version).toBe(versionBeforeRestart);

    // DISCONNECT all clients and SHUT DOWN server 1
    for (const socket of clients.splice(0)) socket.disconnect();
    await server1.service.flushPersistence();
    await new Promise<void>((res) => server1.io.close(() => res()));
    await new Promise<void>((res) => server1.httpServer.close(() => res()));

    // START SERVER 2 pointing to the same Postgres database
    const persistence2 = new PostgresPersistence(pool);
    const server2 = await createLudoServer(persistence2);
    await new Promise<void>((res) => server2.httpServer.listen(0, res));
    const url2 = `http://127.0.0.1:${(server2.httpServer.address() as any).port}`;

    // Reconnect client 0 and client 1 with their saved sessionTokens
    const c0New = await makeClient(url2, tokens[0]);
    const c1New = await makeClient(url2, tokens[1]);
    await server2.service.flushPersistence();

    // Sessions must match original playerIds from database
    expect(c0New.playerId).toBe(playerIds[0]);
    expect(c1New.playerId).toBe(playerIds[1]);

    // Reconnect to the active room
    const syncRes = await emit(c0New.socket, 'request_game_state', code);
    expect(syncRes.ok).toBe(true);
    expect(syncRes.version).toBe(versionBeforeRestart);
    expect(syncRes.state.status).toBe('playing');
    expect(syncRes.state.players.find((p: any) => p.id === playerIds[0]).seat).toBe(0);
    expect(syncRes.state.players.find((p: any) => p.id === playerIds[1]).seat).toBe(1);

    await server2.service.flushPersistence();
    await new Promise<void>((res) => server2.io.close(() => res()));
    await new Promise<void>((res) => server2.httpServer.close(() => res()));
    await pool.end();
  }, 15000);
});
