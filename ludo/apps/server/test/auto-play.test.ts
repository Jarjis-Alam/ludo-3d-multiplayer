import { describe, expect, it, afterEach } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { legalTokens } from '@ludo/game-engine';
import { createLudoServer } from '../src/index.js';

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

describe('Automated Pawn Movement & Timeout Random Selection', () => {
  it('1. Single legal move: automatically executes sole legal move right after dice roll and notifies all players', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Seat 0 has token 2 on path and tokens 0, 1, 3 in base -> non-6 roll has only [2] legal.
    const room = (server.service as any).rooms.get(code);
    room.state.tokens[0] = [
      { kind: 'base' },
      { kind: 'base' },
      { kind: 'path', progress: 4 },
      { kind: 'base' },
    ];

    const rolledPromise = onceEvent(p1.socket, 'dice_rolled');
    const movedPromise = onceEvent(p1.socket, 'token_moved');

    const rollRes = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      actionId: 'single_roll_1',
      deterministicDice: 3,
      expectedVersion: 1,
    });

    const [rolledEvent, movedEvent] = await Promise.all([rolledPromise, movedPromise]);

    expect(rollRes.ok).toBe(true);
    expect(rollRes.autoMoved).toBe(true);
    expect(rollRes.autoReason).toBe('single');
    expect(rollRes.autoToken).toBe(2);
    expect(rollRes.state.dice).toBeNull();
    expect(rollRes.state.tokens[0][2]).toEqual({ kind: 'path', progress: 7 });
    expect(rollRes.state.currentPlayer).toBe(1);
    expect(rollRes.state.lastNotice).toMatchObject({
      type: 'auto_move',
      autoReason: 'single',
      message: 'Only one legal move — moving automatically.',
    });

    expect(rolledEvent.value).toBe(3);
    expect(rolledEvent.autoMoved).toBe(true);
    expect(rolledEvent.legalCount).toBe(1);

    expect(movedEvent.seat).toBe(0);
    expect(movedEvent.token).toBe(2);
    expect(movedEvent.auto).toBe(true);
    expect(movedEvent.autoReason).toBe('single');

    server.service.close();
    server.httpServer.close();
  });

  it('2. Single legal move: duplicate actionId and extra manual move_token execute at most once', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    const room = (server.service as any).rooms.get(code);
    room.state.tokens[0] = [
      { kind: 'path', progress: 5 },
      { kind: 'base' },
      { kind: 'base' },
      { kind: 'base' },
    ];

    const roll1 = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      actionId: 'dup_single_roll',
      deterministicDice: 4,
      expectedVersion: 1,
    });
    expect(roll1.ok).toBe(true);
    expect(roll1.state.tokens[0][0]).toEqual({ kind: 'path', progress: 9 });
    const verAfterAutoMove = roll1.version;

    // Resend exact duplicate roll actionId -> cached result, pawn does NOT advance again
    const rollDup = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      actionId: 'dup_single_roll',
      deterministicDice: 4,
      expectedVersion: 1,
    });
    expect(rollDup.ok).toBe(true);
    expect(rollDup.version).toBe(verAfterAutoMove);
    expect(room.state.tokens[0][0]).toEqual({ kind: 'path', progress: 9 });

    // Late client manual move_token after single auto-move is cleanly rejected
    const manualMove = await emit(p0.socket, 'move_token', {
      roomCode: code,
      token: 0,
      actionId: 'late_manual_click',
      expectedVersion: verAfterAutoMove,
    });
    expect(manualMove.ok).toBe(false);
    expect(manualMove.error).toBe('not your turn');

    server.service.close();
    server.httpServer.close();
  });

  it('3. Multiple legal moves: preserves manual selection without auto-moving after dice roll', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Two tokens on track -> rolling 3 yields [0, 2] legal (2 legal moves)
    const room = (server.service as any).rooms.get(code);
    room.state.tokens[0] = [
      { kind: 'path', progress: 2 },
      { kind: 'base' },
      { kind: 'path', progress: 10 },
      { kind: 'base' },
    ];

    const rollRes = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 3,
      expectedVersion: 1,
    });
    expect(rollRes.ok).toBe(true);
    expect(rollRes.autoMoved).toBeUndefined();
    expect(rollRes.state.dice).toBe(3);
    expect(rollRes.state.currentPlayer).toBe(0);
    expect(rollRes.state.tokens[0][0]).toEqual({ kind: 'path', progress: 2 });
    expect(rollRes.state.tokens[0][2]).toEqual({ kind: 'path', progress: 10 });

    const manualRes = await emit(p0.socket, 'move_token', {
      roomCode: code,
      token: 2,
      expectedVersion: rollRes.version,
    });
    expect(manualRes.ok).toBe(true);
    expect(manualRes.state.tokens[0][2]).toEqual({ kind: 'path', progress: 13 });
    expect(manualRes.state.currentPlayer).toBe(1);

    server.service.close();
    server.httpServer.close();
  });

  it('4. Single legal move edge outcomes: capture, extra turn on 6, and victory all preserve rules', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });
    const room = (server.service as any).rooms.get(code);

    // Case A: Single auto-move causes capture -> victim returns to base & p0 keeps turn
    room.state.tokens[0] = [
      { kind: 'path', progress: 4 },
      { kind: 'base' },
      { kind: 'base' },
      { kind: 'base' },
    ];
    room.state.tokens[1] = [
      { kind: 'path', progress: 46 }, // cell (13+46)%52 = 7; p0 moves 4+3 = 7
      { kind: 'base' },
      { kind: 'base' },
      { kind: 'base' },
    ];
    const captureRoll = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 3,
      expectedVersion: room.state.version,
    });
    expect(captureRoll.ok).toBe(true);
    expect(captureRoll.autoMoved).toBe(true);
    expect(captureRoll.state.tokens[1][0]).toEqual({ kind: 'base' });
    expect(captureRoll.state.currentPlayer).toBe(0); // extra turn from capture

    // Case B: Three pawns already at goal, 1 left in base; rolling 6 has ONLY [3] legal -> deploys & keeps turn
    room.state.tokens[0] = [
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 6 },
      { kind: 'base' },
    ];
    room.state.consecutiveSixes = 0;
    const sixDeployRoll = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 6,
      expectedVersion: room.state.version,
    });
    expect(sixDeployRoll.ok).toBe(true);
    expect(sixDeployRoll.autoMoved).toBe(true);
    expect(sixDeployRoll.autoToken).toBe(3);
    expect(sixDeployRoll.state.tokens[0][3]).toEqual({ kind: 'path', progress: 0 });
    expect(sixDeployRoll.state.currentPlayer).toBe(0); // extra turn preserved on 6

    // Case C: Final pawn 2 steps from home goal -> rolling 2 auto-moves to victory!
    room.state.tokens[0][3] = { kind: 'home', progress: 4 };
    const winRoll = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 2,
      expectedVersion: room.state.version,
    });
    expect(winRoll.ok).toBe(true);
    expect(winRoll.autoMoved).toBe(true);
    expect(winRoll.state.status).toBe('finished');
    expect(winRoll.state.winner).toBe(0);
    expect(winRoll.state.turnExpiresAt).toBeNull();

    server.service.close();
    server.httpServer.close();
  });

  it('5. Timeout with 2+ legal pawns: randomly chooses strictly among legal tokens and rejects illegal choices', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const chosenTokens = new Set<number>();
    const TRIALS = 24;

    for (let i = 0; i < TRIALS; i++) {
      const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
      const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
      const code = created.roomCode;
      await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
      await emit(p0.socket, 'start_game', { roomCode: code });

      const room = (server.service as any).rooms.get(code);
      // Tokens 1 and 3 on track (legal on roll 4); tokens 0 and 2 in base (illegal on roll 4!)
      room.state.tokens[0] = [
        { kind: 'base' },
        { kind: 'path', progress: 5 },
        { kind: 'base' },
        { kind: 'path', progress: 18 },
      ];
      room.state.dice = 4;
      const legal = legalTokens(room.state, 0, 4);
      expect(legal).toEqual([1, 3]);

      const timeoutPromise = onceEvent(p1.socket, 'turn_timeout');
      const timeoutRes = await server.service.forceTurnTimeout(code);
      const timeoutEvent = await timeoutPromise;

      expect(timeoutRes.ok).toBe(true);
      expect(timeoutRes.autoMoved).toBe(true);
      expect(timeoutRes.autoReason).toBe('timeout');
      expect(legal).toContain(timeoutRes.autoToken);
      expect([0, 2]).not.toContain(timeoutRes.autoToken);
      expect(timeoutEvent.autoReason).toBe('timeout');
      expect(timeoutRes.state?.lastNotice).toMatchObject({
        type: 'timeout',
        autoReason: 'timeout',
        message: "Time's up! A random legal move was selected.",
      });
      chosenTokens.add(timeoutRes.autoToken!);
    }

    // Over 24 trials with 2 legal moves, randomness selects both legal pawns (P(all identical) = 2^-23)
    expect(chosenTokens.size).toBe(2);

    server.service.close();
    server.httpServer.close();
  });

  it('6. Timeout auto-move handles capture, extra turn, and victory cleanly', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });
    const room = (server.service as any).rooms.get(code);

    // Timeout capture: p0 has 2 legal pawns, BOTH capture or 2 tokens poised on home goal 1 step away -> win!
    room.state.tokens[0] = [
      { kind: 'path', progress: 4 },
      { kind: 'path', progress: 4 },
      { kind: 'base' },
      { kind: 'base' },
    ];
    room.state.tokens[1] = [
      { kind: 'path', progress: 46 }, // cell 7
      { kind: 'base' },
      { kind: 'base' },
      { kind: 'base' },
    ];
    room.state.dice = 3;

    const timeoutCapture = await server.service.forceTurnTimeout(code);
    expect(timeoutCapture.ok).toBe(true);
    expect(timeoutCapture.autoMoved).toBe(true);
    expect(timeoutCapture.state?.tokens[1][0]).toEqual({ kind: 'base' });
    expect(timeoutCapture.state?.currentPlayer).toBe(0); // extra turn kept from capture

    // Timeout victory: both remaining pawns need 1 step to win; either finishes seat 0
    room.state.tokens[0] = [
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 5 },
      { kind: 'home', progress: 5 },
    ];
    room.state.tokens[0][3] = { kind: 'home', progress: 6 }; // only token 2 left or wait: 1 token -> test 2 tokens would only finish 1!
    // Actually finish with 1 legal pawn during timeout edge state (status === 'playing', dice: 1, legal: [2])
    room.state.dice = 1;
    const timeoutWin = await server.service.forceTurnTimeout(code);
    expect(timeoutWin.ok).toBe(true);
    expect(timeoutWin.state?.status).toBe('finished');
    expect(timeoutWin.state?.winner).toBe(0);

    // Subsequent timeout on finished match is rejected as stale and does not mutate winner
    const postWinTimeout = await server.service.forceTurnTimeout(code);
    expect(postWinTimeout.ok).toBe(false);
    expect(postWinTimeout.error).toBe('Stale timer');

    server.service.close();
    server.httpServer.close();
  });

  it('7. Timeout guards: rejects stale version, duplicate timeouts, state change races, and handles 0 legal moves', async () => {
    const server = await createLudoServer();
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // No legal moves on roll of 2 -> auto-passes turn
    const noMoveRoll = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 2,
      expectedVersion: 1,
    });
    expect(noMoveRoll.ok).toBe(true);
    expect(noMoveRoll.state.currentPlayer).toBe(1);
    expect(noMoveRoll.state.lastNotice?.type).toBe('auto_pass');

    // Now P1 rolls 6 (4 legal moves), then races manual move_token against timeout
    const p1Roll = await emit(p1.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 6,
      expectedVersion: noMoveRoll.version,
    });
    expect(p1Roll.ok).toBe(true);
    const v = p1Roll.version;

    // Fire manual move first + two duplicate timeouts concurrently
    const [manualMove, t1, t2] = await Promise.all([
      emit(p1.socket, 'move_token', { roomCode: code, token: 2, expectedVersion: v }),
      (server.service as any).handleTurnTimeout(code, v),
      (server.service as any).handleTurnTimeout(code, v),
    ]);

    const okCount = [manualMove, t1, t2].filter((r) => r.ok).length;
    expect(okCount).toBe(1);
    if (manualMove.ok) {
      expect(t1.error).toBe('Stale timer');
      expect(t2.error).toBe('Stale timer');
      expect(manualMove.state.tokens[1][2]).toEqual({ kind: 'path', progress: 0 });
    }

    server.service.close();
    server.httpServer.close();
  });

  it('8. Disconnect grace policy: never randomly moves during grace; resumes on reconnect; forfeits after grace expiry', async () => {
    const server = await createLudoServer(undefined, { sessionGraceMs: 120 });
    await new Promise<void>((res) => server.httpServer.listen(0, res));
    const url = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;

    const [p0, p1] = await Promise.all([makeClient(url), makeClient(url)]);
    const created = await emit(p0.socket, 'create_room', { name: 'Alice' });
    const code = created.roomCode;
    await emit(p1.socket, 'join_room', { roomCode: code, name: 'Bob' });
    await emit(p0.socket, 'start_game', { roomCode: code });

    // Alice rolls 6 (4 legal moves -> manual choice pending)
    const rollRes = await emit(p0.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 6,
      expectedVersion: 1,
    });
    expect(rollRes.ok).toBe(true);
    const verWithSix = rollRes.version;

    // Alice disconnects while within grace window (120ms)
    p0.socket.disconnect();
    await wait(25);

    // Timeout callback arrives while Alice is still disconnected in grace -> MUST NOT randomly move!
    const heldTimeout = await server.service.forceTurnTimeout(code);
    expect(heldTimeout.ok).toBe(false);
    expect(heldTimeout.error).toBe('Player disconnected within grace period');
    const room = (server.service as any).rooms.get(code);
    expect(room.state.dice).toBe(6);
    expect(room.state.currentPlayer).toBe(0);
    expect(room.state.tokens[0].every((t: any) => t.kind === 'base')).toBe(true);

    // Alice reconnects within grace -> keeps her seat, rolled 6, and can finish her turn manually!
    const p0Recon = await makeClient(url, p0.token);
    const joinBack = await emit(p0Recon.socket, 'join_room', { roomCode: code, name: 'Alice' });
    expect(joinBack.ok).toBe(true);
    expect(joinBack.reconnected).toBe(true);
    expect(joinBack.state.dice).toBe(6);
    expect(joinBack.state.currentPlayer).toBe(0);

    const manualAfterRecon = await emit(p0Recon.socket, 'move_token', {
      roomCode: code,
      token: 1,
      expectedVersion: verWithSix,
    });
    expect(manualAfterRecon.ok).toBe(true);
    expect(manualAfterRecon.state.tokens[0][1]).toEqual({ kind: 'path', progress: 0 });
    expect(manualAfterRecon.state.currentPlayer).toBe(0); // extra turn preserved

    // Now Alice rolls 6 again (only 3 legal base moves or 4 total moves -> manual choice) and disconnects permanently past grace
    const roll2 = await emit(p0Recon.socket, 'roll_dice', {
      roomCode: code,
      deterministicDice: 6,
      expectedVersion: manualAfterRecon.version,
    });
    expect(roll2.ok).toBe(true);
    p0Recon.socket.disconnect();

    // Wait past grace expiry (120ms + buffer): turn must forfeit to connected Bob without randomly moving Alice!
    await wait(190);
    expect(room.state.currentPlayer).toBe(1);
    expect(room.state.dice).toBeNull();
    // Alice's disconnected tokens untouched (only token 1 had moved manually earlier)
    expect(room.state.tokens[0].filter((t: any) => t.kind === 'base')).toHaveLength(3);

    server.service.close();
    server.httpServer.close();
  });
});
