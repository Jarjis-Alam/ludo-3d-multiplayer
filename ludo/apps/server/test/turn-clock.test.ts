import { describe, expect, it, afterEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createLudoServer } from '../src/index.js';

type Client = { socket: Socket; token: string; playerId: string };
const clients: Socket[] = [];

async function makeClient(url: string): Promise<Client> {
  const socket = connect(url, { autoConnect: false });
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

describe('Lobby turn clock', () => {
  it("keeps the host's chosen clock through a join, a leave and a rematch", async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;
    const roomOf = () => (server.service as any).rooms.get(code);

    const [host, guest] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(host.socket, 'create_room', { name: 'Host' });
    const code = created.roomCode;
    // New tables start on the relaxed 30s clock rather than the old 15s one.
    expect(created.state.turnDurationMs).toBe(30_000);

    const selected = await emit(host.socket, 'set_turn_duration', { roomCode: code, seconds: 60 });
    expect(selected.ok).toBe(true);
    expect(selected.state.turnDurationMs).toBe(60_000);

    // A join rebuilds the lobby state, which used to drop the choice.
    const joined = await emit(guest.socket, 'join_room', { roomCode: code, name: 'Guest' });
    expect(joined.ok).toBe(true);
    expect(joined.state.turnDurationMs).toBe(60_000);

    // A leave rebuilds it again.
    const left = await emit(guest.socket, 'leave_room', code);
    expect(left.ok).toBe(true);
    expect(roomOf().state.status).toBe('lobby');
    expect(roomOf().state.turnDurationMs).toBe(60_000);

    // Starting and then rematching rebuild it a third time.
    const guest2 = await makeClient(url);
    await emit(guest2.socket, 'join_room', { roomCode: code, name: 'Guest2' });
    const started = await emit(host.socket, 'start_game', { roomCode: code, actionId: 'start_1' });
    expect(started.ok).toBe(true);
    expect(started.state.turnDurationMs).toBe(60_000);

    const room = roomOf();
    room.state.status = 'finished';
    room.state.winner = 0;
    const rematch = await emit(host.socket, 'request_rematch', { roomCode: code, actionId: 'rematch_1' });
    expect(rematch.ok).toBe(true);
    expect(rematch.state.turnDurationMs).toBe(60_000);
    expect(rematch.state.turnExpiresAt - Date.now()).toBeGreaterThan(55_000);

    server.service.close();
    server.httpServer.close();
  });
});
