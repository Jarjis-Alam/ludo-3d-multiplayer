process.env.NODE_ENV = 'test';
import { createLudoServer } from '../src/index.js';
import { io as connect } from 'socket.io-client';
import { legalTokens } from '@ludo/game-engine';

const server = await createLudoServer();
await new Promise((resolve) => server.httpServer.listen(0, resolve as () => void));
const port = (server.httpServer.address() as any).port;
const url = `http://127.0.0.1:${port}`;
const clients: any[] = [];
const snapshots: any[] = Array(4).fill(null);
const tokens: any[] = [];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function connectClient(i: number) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { autoConnect: false });
    clients.push(socket);
    socket.once('connect_error', reject);
    socket.once('session', (session: any) => resolve({ socket, token: session.sessionToken, id: session.playerId }));
    socket.connect();
    socket.on('room_state', (s: any) => { snapshots[i] = s; });
    socket.on('game_started', (s: any) => { snapshots[i] = s; });
    socket.on('state', (s: any) => { snapshots[i] = s; });
    socket.on('rematch_started', (s: any) => { snapshots[i] = s; });
    socket.on('lobby_updated', (s: any) => { snapshots[i] = s; });
  });
}

function emit(socket: any, event: string, ...args: any[]) {
  return new Promise((resolve) => socket.emit(event, ...args, resolve));
}

async function waitForVersion(version: number, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (snapshots.every((s) => s && s.version >= version)) return;
    await wait(5);
  }
  throw new Error(`Timed out waiting for version ${version}: ${snapshots.map((s) => s?.version)}`);
}

function canonical(s: any) {
  return JSON.stringify({
    version: s.version,
    status: s.status,
    currentPlayer: s.currentPlayer,
    dice: s.dice,
    consecutiveSixes: s.consecutiveSixes,
    winner: s.winner,
    tokens: s.tokens,
    players: s.players.map((p: any) => ({ id: p.id, seat: p.seat, color: p.color, connected: p.connected })),
  });
}

function assertInSync(label: string) {
  const ref = canonical(snapshots[0]);
  for (let i = 1; i < 4; i++) {
    const current = canonical(snapshots[i]);
    if (current !== ref) {
      throw new Error(`State desync at ${label} between seat 0 and seat ${i}:\n0: ${ref}\n${i}: ${current}`);
    }
  }
}

for (let i = 0; i < 4; i++) {
  tokens.push(await connectClient(i));
}

const created = await emit(clients[0], 'create_room', { name: 'P0' }) as any;
if (!created.ok) throw new Error(`create failed: ${JSON.stringify(created)}`);
const roomCode = created.roomCode;
snapshots[0] = created.state;

for (let i = 1; i < 4; i++) {
  const joined = await emit(clients[i], 'join_room', { roomCode, name: `P${i}` }) as any;
  if (!joined.ok) throw new Error(`join ${i} failed: ${JSON.stringify(joined)}`);
  snapshots[i] = joined.state;
}

const waitFull = Date.now();
while (Date.now() - waitFull < 3000) {
  if (snapshots.every((s) => s && s.players && s.players.length === 4)) break;
  await wait(10);
}

await waitForVersion(0);
assertInSync('room lobby full');

const started = await emit(clients[0], 'start_game', roomCode) as any;
if (!started.ok) throw new Error(`start failed: ${JSON.stringify(started)}`);
await waitForVersion(1);
assertInSync('game started');

let step = 0;
let lastVersion = 1;

while (snapshots[0].status !== 'finished' && step < 5000) {
  step++;
  const s = snapshots[0];
  if (s.status === 'finished') {
    break;
  }

  const cp = s.currentPlayer;
  const currentSocket = clients[cp];

  if (s.dice === null) {
    const rollAck = await emit(currentSocket, 'roll_dice', { roomCode }) as any;
    if (!rollAck.ok) {
      throw new Error(`Roll failed at step ${step}: ${JSON.stringify(rollAck)}`);
    }
    await waitForVersion(lastVersion + 1);
    lastVersion = snapshots[0].version;
    assertInSync(`after roll at step ${step}`);
    continue;
  }

  const moves = legalTokens(s, cp, s.dice);
  if (moves.length === 0) {
    await waitForVersion(lastVersion + 1);
    lastVersion = snapshots[0].version;
    assertInSync(`after auto pass at step ${step}`);
    continue;
  }

  const tokenToMove = moves[Math.floor(Math.random() * moves.length)];
  const moveAck = await emit(currentSocket, 'move_token', { roomCode, token: tokenToMove }) as any;
  if (!moveAck.ok) {
    throw new Error(`Move failed at step ${step}: ${JSON.stringify(moveAck)}`);
  }
  await waitForVersion(lastVersion + 1);
  lastVersion = snapshots[0].version;
  assertInSync(`after move at step ${step}`);
}

const finishedVersion = snapshots[0].version;
console.log(`Game finished cleanly at version ${finishedVersion} in ${step} steps!`);

// Rematch test
const rematchRes = await emit(clients[0], 'request_rematch', roomCode) as any;
if (!rematchRes.ok) throw new Error(`rematch failed: ${JSON.stringify(rematchRes)}`);
await waitForVersion(finishedVersion + 1);
assertInSync('rematch started');
console.log(`Rematch started cleanly at monotonic version ${snapshots[0].version}!`);

for (const c of clients) c.disconnect();
server.io.close();
server.httpServer.close();
console.log('QA Match passed with 100% sync!');
process.exit(0);
