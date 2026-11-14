process.env.NODE_ENV = 'test';
import { createLudoServer } from '../src/index.js';
import { io as connect } from 'socket.io-client';
import { legalTokens, type GameState } from '@ludo/game-engine';

function createPrng(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMatch(matchIndex: number, seed: number, port: number) {
  const url = `http://127.0.0.1:${port}`;
  const prng = createPrng(seed);
  const clients: any[] = [];
  const snapshots: (GameState | null)[] = Array(4).fill(null);

  function connectClient(i: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const socket = connect(url, { autoConnect: false });
      clients.push(socket);
      socket.once('connect_error', reject);
      socket.once('session', (session: any) => resolve({ socket, token: session.sessionToken, id: session.playerId }));
      socket.connect();
      socket.on('room_state', (s: GameState) => { snapshots[i] = s; });
      socket.on('game_started', (s: GameState) => { snapshots[i] = s; });
      socket.on('state', (s: GameState) => { snapshots[i] = s; });
      socket.on('rematch_started', (s: GameState) => { snapshots[i] = s; });
    });
  }

  function emit(socket: any, event: string, ...args: any[]): Promise<any> {
    return new Promise((resolve) => socket.emit(event, ...args, resolve));
  }

  async function waitForVersion(version: number, timeout = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (snapshots.every((s) => s && s.version >= version)) return;
      await wait(5);
    }
    throw new Error(`[SEED ${seed}] Timed out waiting for version ${version}: ${snapshots.map((s) => s?.version)}`);
  }

  try {
    const players = await Promise.all([0, 1, 2, 3].map(connectClient));
    const created = await emit(players[0].socket, 'create_room', { name: `Host-${matchIndex}` });
    if (!created.ok) throw new Error(`create failed: ${JSON.stringify(created)}`);
    const roomCode = created.roomCode;
    snapshots[0] = created.state;

    for (let i = 1; i < 4; i++) {
      const joined = await emit(players[i].socket, 'join_room', { roomCode, name: `P${i}-${matchIndex}` });
      if (!joined.ok) throw new Error(`join ${i} failed: ${JSON.stringify(joined)}`);
      snapshots[i] = joined.state;
    }

    const started = await emit(players[0].socket, 'start_game', roomCode);
    if (!started.ok) throw new Error(`start failed: ${JSON.stringify(started)}`);
    await waitForVersion(1);

    let previous = snapshots[0]!;
    let steps = 0;
    let captures = 0;
    let extraTurns = 0;
    let tripleSixes = 0;

    while (previous.status !== 'finished' && steps < 5000) {
      const active = previous.currentPlayer;
      const before = previous;
      const actionId = `m${matchIndex}_act${steps}_${Date.now()}`;

      if (before.dice === null) {
        const deterministicDice = Math.floor(prng() * 6) + 1;
        const result = await emit(players[active].socket, 'roll_dice', {
          roomCode,
          actionId,
          deterministicDice,
          expectedVersion: before.version,
        });
        if (!result.ok) throw new Error(`roll rejected at step ${steps}: ${JSON.stringify(result)}`);
        await waitForVersion(before.version + 1);
        const next = snapshots[0]!;
        if (result.value === 6 && before.consecutiveSixes === 2 && next.consecutiveSixes === 0) tripleSixes++;
      } else {
        const legal = legalTokens(previous, active, previous.dice);
        if (!legal.length) throw new Error('server exposed a dice value with no legal token');
        // Choose legal token deterministically using prng
        const chosenToken = legal[Math.floor(prng() * legal.length)];
        const result = await emit(players[active].socket, 'move_token', {
          roomCode,
          token: chosenToken,
          actionId,
          expectedVersion: before.version,
        });
        if (!result.ok) throw new Error(`move rejected at step ${steps}: ${JSON.stringify(result)}`);
        await waitForVersion(before.version + 1);
        const next = snapshots[0]!;
        const beforeBase = before.tokens.flat().filter((t) => t.kind === 'base').length;
        const afterBase = next.tokens.flat().filter((t) => t.kind === 'base').length;
        if (afterBase > beforeBase) captures++;
        if (before.dice === 6 && next.currentPlayer === active) extraTurns++;
      }

      const current = snapshots[0]!;
      const canonicalState = canonical(current);
      if (snapshots.some((s) => canonical(s) !== canonicalState)) {
        throw new Error(`state divergence across clients at version ${current.version}`);
      }
      previous = current;
      steps++;
    }

    if (previous.status !== 'finished') throw new Error(`Match ${matchIndex} (seed ${seed}) did not finish after ${steps} steps`);

    const finalVersion = previous.version;
    const winner = previous.winner;

    // Test rematch
    const rematch = await emit(players[0].socket, 'request_rematch', {
      roomCode,
      actionId: `rematch_m${matchIndex}`,
    });
    if (!rematch.ok) throw new Error(`rematch rejected: ${JSON.stringify(rematch)}`);
    await waitForVersion(finalVersion + 1);

    const rematchState = snapshots[0]!;
    if (rematchState.status !== 'playing' || rematchState.tokens.flat().some((t) => t.kind !== 'base')) {
      throw new Error(`Rematch did not reset the board properly`);
    }
    if (rematchState.version !== finalVersion + 1) {
      throw new Error(`Rematch version is not monotonically increasing: expected ${finalVersion + 1}, got ${rematchState.version}`);
    }

    // Play 2 actions in rematch to verify rematch progresses normally
    const rActive = rematchState.currentPlayer;
    const rRoll = await emit(players[rActive].socket, 'roll_dice', {
      roomCode,
      actionId: `rematch_roll_1`,
      deterministicDice: 6,
      expectedVersion: rematchState.version,
    });
    if (!rRoll.ok) throw new Error(`rematch roll rejected: ${JSON.stringify(rRoll)}`);
    await waitForVersion(rematchState.version + 1);

    return {
      matchIndex,
      seed,
      ok: true,
      roomCode,
      steps,
      winner,
      finalVersion,
      rematchVersion: snapshots[0]!.version,
      captures,
      extraTurns,
      tripleSixes,
    };
  } finally {
    for (const s of clients) s.disconnect();
  }
}

async function main() {
  const server = await createLudoServer();
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const port = (server.httpServer.address() as any).port;
  console.log(`Starting 20 complete randomized match simulations on port ${port}...`);

  const results: any[] = [];
  const TOTAL_MATCHES = 20;

  for (let i = 1; i <= TOTAL_MATCHES; i++) {
    const seed = 100000 + i * 7919; // distinct reproducible seeds
    const start = Date.now();
    try {
      const res = await runMatch(i, seed, port);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`Match ${i}/${TOTAL_MATCHES} (seed ${seed}): PASSED in ${elapsed}s — steps=${res.steps}, winner=seat ${res.winner}, finalVersion=${res.finalVersion}, rematchVersion=${res.rematchVersion}, captures=${res.captures}`);
      results.push(res);
    } catch (err: any) {
      console.error(`Match ${i}/${TOTAL_MATCHES} (seed ${seed}): FAILED!`, err.message);
      results.push({ matchIndex: i, seed, ok: false, error: err.message });
      break;
    }
  }

  server.httpServer.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log('\n=================== 20 MATCH SIMULATION SUMMARY ===================');
  console.log(`Total Attempted: ${results.length}`);
  console.log(`Passed:          ${passed}`);
  console.log(`Failed:          ${failed}`);
  console.log(`Success Rate:    ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal simulation error:', err);
  process.exit(1);
});
