import { describe, expect, it, afterEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createLudoServer } from '../src/index.js';
import { legalTokens, type GameState } from '@ludo/game-engine';

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

function onceEvent(socket: Socket, event: string): Promise<any> {
  return new Promise((resolve) => socket.once(event, resolve));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  for (const socket of clients.splice(0)) {
    socket.disconnect();
  }
});

describe('Multiplayer Synchronization & Hardening Suite', () => {
  it('suppresses duplicate actions with unique actionId and preserves idempotency', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2, p3] = await Promise.all([
      makeClient(url), makeClient(url), makeClient(url), makeClient(url)
    ]);

    const created = await emit(p0.socket, 'create_room', { name: 'Host' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'P1' });
    await emit(p2.socket, 'join_room', { roomCode: code, name: 'P2' });
    await emit(p3.socket, 'join_room', { roomCode: code, name: 'P3' });

    await emit(p0.socket, 'start_game', { roomCode: code, actionId: 'start_1' });

    // p0 rolls dice with actionId 'roll_dup_1'
    const roll1 = await emit(p0.socket, 'roll_dice', { roomCode: code, actionId: 'roll_dup_1' });
    expect(roll1.ok).toBe(true);
    const firstVer = roll1.version;
    const firstVal = roll1.value;

    // Resend the exact same roll action with the same actionId
    const rollDup = await emit(p0.socket, 'roll_dice', { roomCode: code, actionId: 'roll_dup_1' });
    expect(rollDup.ok).toBe(true);
    expect(rollDup.version).toBe(firstVer);
    expect(rollDup.value).toBe(firstVal);

    server.httpServer.close();
  });

  it('rejects stale client actions when expectedVersion does not match room version', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2, p3] = await Promise.all([
      makeClient(url), makeClient(url), makeClient(url), makeClient(url)
    ]);

    const created = await emit(p0.socket, 'create_room', { name: 'Host' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'P1' });
    await emit(p2.socket, 'join_room', { roomCode: code, name: 'P2' });
    await emit(p3.socket, 'join_room', { roomCode: code, name: 'P3' });

    await emit(p0.socket, 'start_game', { roomCode: code, actionId: 'start_1' });

    // Roll with stale expectedVersion 999
    const staleRoll = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      actionId: 'roll_stale',
      expectedVersion: 999,
    });
    expect(staleRoll.ok).toBe(false);
    expect(staleRoll.error).toBe('Version mismatch');
    expect(staleRoll.version).toBe(1);

    server.httpServer.close();
  });

  it('detects concurrent action attempts and serializes them atomically', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2, p3] = await Promise.all([
      makeClient(url), makeClient(url), makeClient(url), makeClient(url)
    ]);

    const created = await emit(p0.socket, 'create_room', { name: 'Host' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'P1' });
    await emit(p2.socket, 'join_room', { roomCode: code, name: 'P2' });
    await emit(p3.socket, 'join_room', { roomCode: code, name: 'P3' });

    await emit(p0.socket, 'start_game', { roomCode: code, actionId: 'start_1' });

    // Send two rolls from p0 concurrently
    const [res1, res2] = await Promise.all([
      emit(p0.socket, 'roll_dice', { roomCode: code, actionId: 'concurrent_roll_1' }),
      emit(p0.socket, 'roll_dice', { roomCode: code, actionId: 'concurrent_roll_2' }),
    ]);

    // Exactly one should succeed, the other should fail because dice !== null or not player's turn
    const successes = [res1, res2].filter((r) => r.ok);
    const failures = [res1, res2].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe('cannot roll now');

    server.httpServer.close();
  });

  it('allows client to recover missed snapshots through request_game_state with history', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2, p3] = await Promise.all([
      makeClient(url), makeClient(url), makeClient(url), makeClient(url)
    ]);

    const created = await emit(p0.socket, 'create_room', { name: 'Host' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'P1' });
    await emit(p2.socket, 'join_room', { roomCode: code, name: 'P2' });
    await emit(p3.socket, 'join_room', { roomCode: code, name: 'P3' });

    await emit(p0.socket, 'start_game', { roomCode: code, actionId: 'start_1' });

    // Perform a few actions
    await emit(p0.socket, 'roll_dice', { roomCode: code, actionId: 'roll_1', deterministicDice: 1 });

    // P1 requests state since version 0
    const syncRes = await emit(p1.socket, 'request_game_state', { roomCode: code, sinceVersion: 0 });
    expect(syncRes.ok).toBe(true);
    expect(syncRes.version).toBeGreaterThanOrEqual(2);
    expect(syncRes.history).toBeDefined();
    expect(syncRes.history.length).toBeGreaterThanOrEqual(1);

    server.httpServer.close();
  });

  it('reconnects a client mid-game, preserves their seat, and synchronizes state', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2, p3] = await Promise.all([
      makeClient(url), makeClient(url), makeClient(url), makeClient(url)
    ]);

    const created = await emit(p0.socket, 'create_room', { name: 'Host' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'P1' });
    await emit(p2.socket, 'join_room', { roomCode: code, name: 'P2' });
    await emit(p3.socket, 'join_room', { roomCode: code, name: 'P3' });

    await emit(p0.socket, 'start_game', { roomCode: code, actionId: 'start_1' });

    // Disconnect P2
    const p2Token = p2.token;
    const p2Id = p2.playerId;
    p2.socket.disconnect();
    await wait(50);

    // Reconnect P2 using sessionToken
    const p2Reconnected = await makeClient(url, p2Token);
    expect(p2Reconnected.playerId).toBe(p2Id);

    // P2 rejoins active game room
    const joinRes = await emit(p2Reconnected.socket, 'join_room', { roomCode: code });
    expect(joinRes.ok).toBe(true);
    expect(joinRes.reconnected).toBe(true);
    const p2InRoom = joinRes.state.players.find((p: any) => p.id === p2Id);
    expect(p2InRoom).toBeDefined();
    expect(p2InRoom.seat).toBe(2);
    expect(p2InRoom.connected).toBe(true);

    server.httpServer.close();
  });

  it('strictly preserves monotonically increasing authoritative versions across rematch', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2, p3] = await Promise.all([
      makeClient(url), makeClient(url), makeClient(url), makeClient(url)
    ]);

    const created = await emit(p0.socket, 'create_room', { name: 'Host' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'P1' });
    await emit(p2.socket, 'join_room', { roomCode: code, name: 'P2' });
    await emit(p3.socket, 'join_room', { roomCode: code, name: 'P3' });

    await emit(p0.socket, 'start_game', { roomCode: code, actionId: 'start_1' });

    // Manually set game state to finished to simulate a complete game
    const room = (server.service as any).rooms.get(code);
    room.state.status = 'finished';
    room.state.winner = 0;
    room.state.version = 663;

    // Request rematch
    const rematchRes = await emit(p0.socket, 'request_rematch', { roomCode: code, actionId: 'rematch_1' });
    expect(rematchRes.ok).toBe(true);

    // Authoritative version MUST NOT be 1! It MUST be 664 (monotonically increasing)
    expect(rematchRes.version).toBe(664);
    expect(rematchRes.state.version).toBe(664);
    expect(rematchRes.state.status).toBe('playing');
    expect(rematchRes.state.tokens.flat().every((t: any) => t.kind === 'base')).toBe(true);

    server.httpServer.close();
  });

  it('enforces room-code format validation and brute-force protection', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const client = await makeClient(url);

    // Invalid format
    const badCodeRes = await emit(client.socket, 'join_room', { roomCode: 'toolongcode' });
    expect(badCodeRes.ok).toBe(false);
    expect(badCodeRes.error).toBe('Invalid room code');

    // Attempt brute force failed joins
    for (let i = 0; i < 9; i++) {
      await emit(client.socket, 'join_room', { roomCode: 'XXXXXX' });
    }
    const lockedRes = await emit(client.socket, 'join_room', { roomCode: 'XXXXXX' });
    expect(lockedRes.ok).toBe(false);
    expect(lockedRes.error).toContain('Too many failed join attempts');

    server.httpServer.close();
  });
});
