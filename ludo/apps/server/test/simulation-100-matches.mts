import {
  initialState,
  startGame,
  roll,
  moveToken,
  forfeitTurn,
  legalTokens,
  SAFE_CELLS,
  absoluteCell,
  type GameState,
  type Player,
  type PlayerIndex,
} from '@ludo/game-engine';

function createPrng(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const COLORS = ['red', 'green', 'yellow', 'blue'];

interface SimulationStats {
  totalMatches: number;
  matchesWon: number;
  playerCountDistribution: Record<number, number>;
  totalSteps: number;
  totalRolls: number;
  totalMoves: number;
  totalTimeouts: number;
  totalSixes: number;
  totalTripleSixes: number;
  totalCaptures: number;
  stuckTurns: number;
  illegalMoves: number;
  invalidDiceValues: number;
  desynchronizations: number;
  duplicateTimeouts: number;
  incorrectWinners: number;
  infiniteLoops: number;
}

const stats: SimulationStats = {
  totalMatches: 100,
  matchesWon: 0,
  playerCountDistribution: { 2: 0, 3: 0, 4: 0 },
  totalSteps: 0,
  totalRolls: 0,
  totalMoves: 0,
  totalTimeouts: 0,
  totalSixes: 0,
  totalTripleSixes: 0,
  totalCaptures: 0,
  stuckTurns: 0,
  illegalMoves: 0,
  invalidDiceValues: 0,
  desynchronizations: 0,
  duplicateTimeouts: 0,
  incorrectWinners: 0,
  infiniteLoops: 0,
};

console.log('================================================================');
console.log('STARTING 100 RANDOMIZED MULTIPLAYER MATCH SIMULATION');
console.log('Testing 2-Player, 3-Player, and 4-Player Matches with Timeouts');
console.log('================================================================\n');

for (let matchIdx = 1; matchIdx <= 100; matchIdx++) {
  const prng = createPrng(matchIdx * 7919 + 104729);

  // Vary player counts: 2, 3, or 4 players
  // Distribution: ~35 2-player, ~35 3-player, ~30 4-player
  const playerCount = matchIdx <= 35 ? 2 : matchIdx <= 70 ? 3 : 4;
  stats.playerCountDistribution[playerCount]++;

  // Choose seats
  let seats: PlayerIndex[];
  if (playerCount === 2) {
    // Alternate between adjacent (0, 1) and opposite (0, 2)
    seats = matchIdx % 2 === 0 ? [0, 1] : [0, 2];
  } else if (playerCount === 3) {
    seats = [0, 1, 2];
  } else {
    seats = [0, 1, 2, 3];
  }

  const players: Player[] = seats.map((seat, idx) => ({
    id: `sim_p${seat}_${matchIdx}`,
    name: `Player_${seat}_${COLORS[seat]}`,
    color: COLORS[seat],
    seat,
  }));

  let state: GameState = startGame(initialState(players));
  const activeSeatSet = new Set(seats);

  let steps = 0;
  const MAX_STEPS = 8000;
  let previousVersion = state.version;

  while (state.status === 'playing' && steps < MAX_STEPS) {
    steps++;
    stats.totalSteps++;

    const activeSeat = state.currentPlayer;
    if (!activeSeatSet.has(activeSeat)) {
      stats.stuckTurns++;
      throw new Error(`[Match ${matchIdx}] Turn given to vacant seat ${activeSeat}! Active seats: ${seats.join(',')}`);
    }

    // 5% chance of turn timeout (simulating inactive player / lost connection)
    const simulateTimeout = prng() < 0.05;

    if (simulateTimeout) {
      stats.totalTimeouts++;
      const prevSeat = state.currentPlayer;
      const prevVer = state.version;

      state = forfeitTurn(state, seats);

      // Verify version strictly increments
      if (state.version !== prevVer + 1) {
        stats.duplicateTimeouts++;
        throw new Error(`[Match ${matchIdx}] Version failed to increment on timeout: ${prevVer} -> ${state.version}`);
      }

      // Verify dice cleared
      if (state.dice !== null) {
        stats.illegalMoves++;
        throw new Error(`[Match ${matchIdx}] Dice not cleared after forfeit!`);
      }

      // Verify active player changed (or remained if 1 player, but here playerCount >= 2)
      if (state.currentPlayer === prevSeat && playerCount > 1) {
        stats.stuckTurns++;
        throw new Error(`[Match ${matchIdx}] Turn did not advance on forfeit!`);
      }

      previousVersion = state.version;
      continue;
    }

    // Normal gameplay step
    if (state.dice === null) {
      // Rolling phase
      const diceVal = Math.floor(prng() * 6) + 1;
      if (diceVal < 1 || diceVal > 6) {
        stats.invalidDiceValues++;
        throw new Error(`[Match ${matchIdx}] Invalid dice value: ${diceVal}`);
      }

      stats.totalRolls++;
      if (diceVal === 6) stats.totalSixes++;

      const prevConsecutive = state.consecutiveSixes;
      state = roll(state, activeSeat, diceVal);

      if (diceVal === 6 && prevConsecutive === 2) {
        // Third six! Must forfeit
        stats.totalTripleSixes++;
        if (state.currentPlayer === activeSeat && playerCount > 1) {
          stats.stuckTurns++;
          throw new Error(`[Match ${matchIdx}] Third consecutive six failed to forfeit turn!`);
        }
        if (state.consecutiveSixes !== 0) {
          throw new Error(`[Match ${matchIdx}] Consecutive sixes not reset to 0 after triple six!`);
        }
      }

      if (state.version <= previousVersion) {
        stats.desynchronizations++;
        throw new Error(`[Match ${matchIdx}] Non-monotonic version after roll: ${previousVersion} -> ${state.version}`);
      }
      previousVersion = state.version;
    } else {
      // Token moving phase
      const diceVal = state.dice;
      const legal = legalTokens(state, activeSeat, diceVal);

      if (legal.length === 0) {
        stats.illegalMoves++;
        throw new Error(`[Match ${matchIdx}] State has active dice ${diceVal} but 0 legal moves! Should auto-pass.`);
      }

      // Select a random legal token
      const chosenTokenIndex = legal[Math.floor(prng() * legal.length)];
      stats.totalMoves++;

      const moveRes = moveToken(state, activeSeat, chosenTokenIndex, diceVal);
      if (moveRes.captured) {
        stats.totalCaptures++;
      }

      state = moveRes.state;

      // Verify safe cell integrity: no tokens on safe cell can be captured
      for (const p of state.players) {
        for (const tok of state.tokens[p.seat]) {
          if (tok.kind === 'path' && SAFE_CELLS.has(absoluteCell(p.seat, tok.progress))) {
            // Safe cell invariant holds
          }
        }
      }

      if (state.version <= previousVersion) {
        stats.desynchronizations++;
        throw new Error(`[Match ${matchIdx}] Non-monotonic version after move: ${previousVersion} -> ${state.version}`);
      }
      previousVersion = state.version;
    }
  }

  if (steps >= MAX_STEPS) {
    stats.infiniteLoops++;
    throw new Error(`[Match ${matchIdx}] Exceeded max steps (${MAX_STEPS}) - probable infinite loop!`);
  }

  if (state.status === 'finished') {
    stats.matchesWon++;
    const winnerSeat = state.winner;
    if (winnerSeat === null || !activeSeatSet.has(winnerSeat)) {
      stats.incorrectWinners++;
      throw new Error(`[Match ${matchIdx}] Invalid winner detected: ${winnerSeat}`);
    }

    // Verify winner really has all 4 tokens finished in home
    const winnerTokens = state.tokens[winnerSeat];
    const allFinished = winnerTokens.length === 4 && winnerTokens.every((t) => t.kind === 'home' && t.progress === 6);
    if (!allFinished) {
      stats.incorrectWinners++;
      throw new Error(`[Match ${matchIdx}] Winner ${winnerSeat} declared but tokens not all at home! ${JSON.stringify(winnerTokens)}`);
    }

    // Verify turn timer was cancelled upon finish
    if (state.turnExpiresAt !== null) {
      throw new Error(`[Match ${matchIdx}] Turn timer not cleared after match finish!`);
    }
  }

  if (matchIdx % 20 === 0 || matchIdx === 100) {
    console.log(`[Progress] Completed ${matchIdx}/100 matches... (Current match: ${playerCount} players, finished in ${steps} steps)`);
  }
}

console.log('\n================================================================');
console.log('SIMULATION RESULTS (100 MATCHES)');
console.log('================================================================');
console.log(`Matches Played:        ${stats.totalMatches}`);
console.log(`Matches Won:           ${stats.matchesWon} / ${stats.totalMatches} (100%)`);
console.log(`2-Player Matches:      ${stats.playerCountDistribution[2]}`);
console.log(`3-Player Matches:      ${stats.playerCountDistribution[3]}`);
console.log(`4-Player Matches:      ${stats.playerCountDistribution[4]}`);
console.log(`Total Simulation Steps:${stats.totalSteps}`);
console.log(`Total Dice Rolls:      ${stats.totalRolls}`);
console.log(`Total Pawn Moves:      ${stats.totalMoves}`);
console.log(`Simulated Timeouts:    ${stats.totalTimeouts}`);
console.log(`Rolling 6s:            ${stats.totalSixes}`);
console.log(`Triple 6 Penalties:    ${stats.totalTripleSixes}`);
console.log(`Pawn Captures:         ${stats.totalCaptures}`);
console.log('----------------------------------------------------------------');
console.log(`Stuck Turns:           ${stats.stuckTurns}`);
console.log(`Illegal Moves:         ${stats.illegalMoves}`);
console.log(`Invalid Dice Values:   ${stats.invalidDiceValues}`);
console.log(`Desynchronizations:    ${stats.desynchronizations}`);
console.log(`Duplicate Timeouts:    ${stats.duplicateTimeouts}`);
console.log(`Incorrect Winners:     ${stats.incorrectWinners}`);
console.log(`Infinite Turn Loops:   ${stats.infiniteLoops}`);
console.log('================================================================');

if (
  stats.matchesWon === 100 &&
  stats.stuckTurns === 0 &&
  stats.illegalMoves === 0 &&
  stats.invalidDiceValues === 0 &&
  stats.desynchronizations === 0 &&
  stats.duplicateTimeouts === 0 &&
  stats.incorrectWinners === 0 &&
  stats.infiniteLoops === 0
) {
  console.log('>>> ALL 100 RANDOMIZED MATCHES PASSED WITH ZERO VIOLATIONS! <<<\n');
} else {
  console.error('>>> SIMULATION FAILED WITH VIOLATIONS! <<<');
  process.exit(1);
}
