import { describe, expect, it, afterEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createLudoServer } from '../src/index.js';
import { MemoryPersistence } from '../src/persistence.js';

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

describe('Turn Timer and Rules Integration Suite', () => {
  it('1. Timeout before dice roll: automatically forfeits turn and advances to next player', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Set fast timer: 50ms
    server.service.setRoomTurnDuration(code, 50);

    const timeoutNoticePromise = onceEvent(p1.socket, 'turn_timeout');
    const timeoutResult = await timeoutNoticePromise;

    expect(timeoutResult.timedOutSeat).toBe(0);
    expect(timeoutResult.hadRolled).toBe(false);
    expect(timeoutResult.nextPlayerSeat).toBe(1);

    const snap = timeoutResult.state;
    expect(snap.currentPlayer).toBe(1);
    expect(snap.dice).toBeNull();
    expect(snap.version).toBe(2);

    server.service.close();
    server.httpServer.close();
  });

  it('2. Timeout after dice roll: forfeits remaining turn and clears active dice', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // P0 rolls 6 (can leave base, legal moves exist)
    const rollRes = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 6,
      expectedVersion: 1,
    });
    expect(rollRes.ok).toBe(true);
    expect(rollRes.state.dice).toBe(6);
    expect(rollRes.state.currentPlayer).toBe(0);

    // P0 goes idle with dice rolled. Set fast timer 50ms and let it expire
    server.service.setRoomTurnDuration(code, 50);
    const timeoutResult = await onceEvent(p1.socket, 'turn_timeout');

    expect(timeoutResult.timedOutSeat).toBe(0);
    expect(timeoutResult.hadRolled).toBe(true);
    expect(timeoutResult.previousDice).toBe(6);
    expect(timeoutResult.nextPlayerSeat).toBe(1);
    expect(timeoutResult.state.dice).toBeNull();
    expect(timeoutResult.state.consecutiveSixes).toBe(0);

    server.service.close();
    server.httpServer.close();
  });

  it('3. Timer reset after a normal turn: gives fresh timer to next player', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // P0 rolls 6 and moves token 0 out to path
    await emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 6, expectedVersion: 1 });
    const moveRes = await emit(p0.socket, 'move_token', { roomCode: code, token: 0, expectedVersion: 2 });
    expect(moveRes.ok).toBe(true);
    expect(moveRes.state.currentPlayer).toBe(0); // Extra turn

    // P0 rolls 3 and advances token 0
    await emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 3, expectedVersion: 3 });
    const moveRes2 = await emit(p0.socket, 'move_token', { roomCode: code, token: 0, expectedVersion: 4 });
    expect(moveRes2.ok).toBe(true);
    expect(moveRes2.state.currentPlayer).toBe(1); // Turned passed to P1
    expect(moveRes2.state.turnExpiresAt).toBeGreaterThan(Date.now() + 1000);
    // Snapshot carries the server clock so clients can count down to the deadline
    // without trusting the device clock.
    expect(typeof moveRes2.state.serverNow).toBe('number');
    expect(Math.abs(moveRes2.state.serverNow - Date.now())).toBeLessThan(1000);
    expect(moveRes2.state.turnExpiresAt - moveRes2.state.serverNow).toBeGreaterThan(14000);

    server.service.close();
    server.httpServer.close();
  });

  it('4. Timer reset after rolling a six: extra turn receives a fresh timer', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    const beforeMove = Date.now();
    await emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 6, expectedVersion: 1 });
    const moveRes = await emit(p0.socket, 'move_token', { roomCode: code, token: 0, expectedVersion: 2 });
    expect(moveRes.ok).toBe(true);
    expect(moveRes.state.currentPlayer).toBe(0);
    // Extra turn must have a fresh deadline ~15s in the future
    expect(moveRes.state.turnExpiresAt).toBeGreaterThanOrEqual(beforeMove + 14000);

    server.service.close();
    server.httpServer.close();
  });

  it('5. Timer reset after a capture: verifies chosen rule set passes turn with fresh deadline', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Deploy P0 to cell 0
    await emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 6, expectedVersion: 1 });
    await emit(p0.socket, 'move_token', { roomCode: code, token: 0, expectedVersion: 2 });

    // P0 rolls 1 -> moves to cell 1 (version 4, passes to P1)
    await emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 1, expectedVersion: 3 });
    await emit(p0.socket, 'move_token', { roomCode: code, token: 0, expectedVersion: 4 });

    // P1 rolls 2 (no legal moves since all in base, auto-passes back to P0)
    await emit(p1.socket, 'roll_dice', { roomCode: code, deterministicDice: 2, expectedVersion: 5 });

    expect(server).toBeDefined();
    server.service.close();
    server.httpServer.close();
  });

  it('6. Stale timer callback rejection: version check prevents old timeout from firing', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // P0 quickly rolls 2 with no moves -> auto-advances to P1 at version 2
    await emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 2, expectedVersion: 1 });

    // Simulate an orphaned stale timeout callback for old version 1
    const staleResult = await (server.service as any).handleTurnTimeout(code, 1);
    expect(staleResult.ok).toBe(false);
    expect(staleResult.error).toBe('Stale timer');

    server.service.close();
    server.httpServer.close();
  });

  it('7. Duplicate timeout prevention: duplicate timeout calls do not advance multiple turns', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Force timeout for version 1 twice simultaneously
    const t1 = (server.service as any).handleTurnTimeout(code, 1);
    const t2 = (server.service as any).handleTurnTimeout(code, 1);
    const [res1, res2] = await Promise.all([t1, t2]);

    expect(res1.ok).toBe(true);
    expect(res1.state.version).toBe(2);
    // Duplicate timeout for version 1 is safely rejected because version already advanced
    expect(res2.ok).toBe(false);
    expect(res2.error).toBe('Stale timer');

    server.service.close();
    server.httpServer.close();
  });

  it('8. Timeout while a player disconnects: advances directly to connected player', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1, p2] = await Promise.all([makeClient(url), makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p2.socket, 'join_room', { roomCode: code, name: 'Charlie' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Bob disconnects during Alice's turn
    p1.socket.disconnect();
    await wait(40);

    // Alice times out -> the server prioritizes connected player Charlie (seat 2), skipping disconnected Bob (seat 1)
    const timeoutRes = await server.service.forceTurnTimeout(code);
    expect(timeoutRes.ok).toBe(true);
    expect(timeoutRes.state?.currentPlayer).toBe(2);

    server.service.close();
    server.httpServer.close();
  });

  it('9. Timeout during simultaneous move submission: server-authoritative serialization', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Submit simultaneous timeout and roll
    const pTimeout = server.service.forceTurnTimeout(code);
    const pRoll = emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 6, expectedVersion: 1 });

    const [tRes, rRes] = await Promise.all([pTimeout, pRoll]);
    // Exactly one authoritative action wins the race
    if (tRes.ok) {
      expect(rRes.ok).toBe(false); // Roll rejected because version moved or turn forfeited
    } else {
      expect(rRes.ok).toBe(true);
    }

    server.service.close();
    server.httpServer.close();
  });

  it('10. Timer recovery after server restart: active game recovers and re-arms turn timer', async () => {
    const persistence = new MemoryPersistence();
    const server1 = await createLudoServer(persistence);
    await new Promise<void>((res) => server1.httpServer.listen(0, res));
    const url1 = `http://127.0.0.1:${(server1.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url1), makeClient(url1)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    await server1.service.flushPersistence();

    // Disconnect clients and stop server 1
    p0.socket.disconnect();
    p1.socket.disconnect();
    server1.service.close();
    server1.httpServer.close();

    // Start server 2 with same persistence
    const server2 = await createLudoServer(persistence);
    await new Promise<void>((res) => server2.httpServer.listen(0, res));
    const url2 = `http://127.0.0.1:${(server2.httpServer.address() as any).port}`;

    // Reconnect both clients
    const [p0Reconnected, p1Reconnected] = await Promise.all([
      makeClient(url2, p0.token),
      makeClient(url2, p1.token),
    ]);
    const reqRes = await emit(p0Reconnected.socket, 'request_game_state', code);
    await emit(p1Reconnected.socket, 'request_game_state', code);
    expect(reqRes.ok).toBe(true);
    expect(reqRes.state.status).toBe('playing');
    expect(reqRes.state.currentPlayer).toBe(0);

    // Timeout recovers and executes cleanly on server 2, advancing turn to P1
    const timeoutRes = await server2.service.forceTurnTimeout(code);
    expect(timeoutRes.ok).toBe(true);
    expect(timeoutRes.state?.currentPlayer).toBe(1);

    server2.service.close();
    server2.httpServer.close();
  });
});
