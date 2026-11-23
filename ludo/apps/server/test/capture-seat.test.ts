import { describe, expect, it, afterEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createLudoServer } from '../src/index.js';

type Client = { socket: Socket; token: string; playerId: string };
const clients: Socket[] = [];

async function makeClient(url: string): Promise<Client> {
  const socket = connect(url, { autoConnect: false });
  clients.push(socket);
  const session = new Promise<{ sessionToken: string; playerId: string }>((resolve) => {
    socket.once('session', resolve);
  });
  socket.connect();
  const value = await session;
  return { socket, token: value.sessionToken, playerId: value.playerId };
}

function emit(socket: Socket, event: string, ...args: any[]): Promise<any> {
  return new Promise((resolve) => socket.emit(event, ...args, resolve));
}

function onceEvent(socket: Socket, event: string): Promise<any> {
  return new Promise((resolve) => socket.once(event, resolve));
}

afterEach(() => {
  for (const socket of clients.splice(0)) socket.disconnect();
});

describe('token_moved capture payload', () => {
  it('reports the seat of the player whose pawn was sent back to base', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    const started = await emit(p0.socket, 'start_game', { roomCode: code });
    expect(started.ok).toBe(true);

    // Stage a guaranteed capture rather than playing towards one: red sits on
    // cell 7 and green parks on the same cell (its arm starts 13 cells later,
    // so progress 46 is cell 7 too). Rolling 3 walks red onto it.
    const room = (server.service as any).rooms.get(code);
    expect(room?.state.status).toBe('playing');
    const version = room.state.version;
    room.state.tokens[0][0] = { kind: 'path', progress: 4 };
    room.state.tokens[1][0] = { kind: 'path', progress: 46 };
    room.state.currentPlayer = 0;
    room.state.dice = 3;

    const movedPayload = onceEvent(p1.socket, 'token_moved');
    const result = await emit(p0.socket, 'move_token', { roomCode: code, token: 0, expectedVersion: version });
    expect(result.ok).toBe(true);

    const payload = await movedPayload;
    expect(payload.seat).toBe(0);
    expect(payload.captured).toBe(true);
    // Clients need the victim's seat, not just the fact that someone was taken.
    expect(payload.capturedSeat).toBe(1);
    expect(result.state.tokens[1][0]).toEqual({ kind: 'base' });
    expect(result.state.tokens[0][0]).toEqual({ kind: 'path', progress: 7 });

    server.service.close();
    server.httpServer.close();
  });

  it('omits capturedSeat when the move captures nobody', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    await emit(p0.socket, 'roll_dice', { roomCode: code, deterministicDice: 6, expectedVersion: 1 });
    const movedPayload = onceEvent(p1.socket, 'token_moved');
    const result = await emit(p0.socket, 'move_token', { roomCode: code, token: 0, expectedVersion: 2 });
    expect(result.ok).toBe(true);

    const payload = await movedPayload;
    expect(payload.captured).toBe(false);
    expect(payload.capturedSeat).toBeUndefined();

    server.service.close();
    server.httpServer.close();
  });
});
