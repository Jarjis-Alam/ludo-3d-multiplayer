export type PlayerIndex = 0 | 1 | 2 | 3;
export type TokenPosition =
  | { kind: 'base' }
  | { kind: 'path'; progress: number }
  | { kind: 'home'; progress: number };
export type Player = { id: string; name: string; color: string; seat: PlayerIndex };

export type TurnNotice = {
  type: 'timeout' | 'auto_pass' | 'three_sixes' | 'extra_turn' | 'podium_finish';
  message: string;
  seat: PlayerIndex;
  playerName?: string;
  dice?: number;
  timestamp: number;
};

export type GameState = {
  players: Player[];
  tokens: TokenPosition[][];
  currentPlayer: PlayerIndex;
  dice: number | null;
  consecutiveSixes: number;
  status: 'lobby' | 'playing' | 'finished';
  winner: PlayerIndex | null;
  rankings: PlayerIndex[];
  version: number;
  turnExpiresAt?: number | null;
  turnDurationMs?: number;
  lastNotice?: TurnNotice | null;
};

export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
export const PATH_LENGTH = 52;
export const MAX_PATH_PROGRESS = 50;
export const HOME_LENGTH = 6;
export const START_OFFSETS = [0, 13, 26, 39] as const;
export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const DEFAULT_TURN_DURATION_MS = 30_000;
/** Turn clocks the lobby offers, in seconds. */
export const TURN_DURATION_OPTIONS = [15, 30, 60] as const;

export function isPlayerFinished(tokens: TokenPosition[]): boolean {
  return tokens.length === 4 && tokens.every((p) => p.kind === 'home' && p.progress === HOME_LENGTH);
}

export function getRemainingSeats(state: GameState): PlayerIndex[] {
  const activeSeats = state.players && state.players.length > 0 ? state.players.map((p) => p.seat) : ([0, 1, 2, 3] as PlayerIndex[]);
  const finishedSet = new Set(state.rankings || []);
  return activeSeats.filter((seat) => !finishedSet.has(seat));
}

export function getNextPlayer(current: PlayerIndex, activeSeats: PlayerIndex[] | Set<PlayerIndex>): PlayerIndex {
  const seats = activeSeats instanceof Set ? activeSeats : new Set(activeSeats);
  if (seats.size === 0) return current;
  let next = ((current + 1) % 4) as PlayerIndex;
  for (let i = 0; i < 4; i++) {
    if (seats.has(next)) return next;
    next = ((next + 1) % 4) as PlayerIndex;
  }
  return current;
}

export function initialState(players: Player[], initialVersion = 0, turnDurationMs = DEFAULT_TURN_DURATION_MS): GameState {
  const activeSeats = new Set(players.map((p) => p.seat));
  const tokens: TokenPosition[][] = Array.from({ length: 4 }, (_, seat) =>
    activeSeats.has(seat as PlayerIndex)
      ? Array.from({ length: 4 }, () => ({ kind: 'base' } as TokenPosition))
      : []
  );
  const firstPlayer = players[0]?.seat ?? 0;
  return {
    players,
    tokens,
    currentPlayer: firstPlayer,
    dice: null,
    consecutiveSixes: 0,
    status: 'lobby',
    winner: null,
    rankings: [],
    version: initialVersion,
    turnExpiresAt: null,
    turnDurationMs,
    lastNotice: null,
  };
}

export function startGame(state: GameState, now = Date.now()): GameState {
  const firstPlayer = state.players[0]?.seat ?? 0;
  const turnDurationMs = state.turnDurationMs || DEFAULT_TURN_DURATION_MS;
  return {
    ...state,
    status: 'playing',
    currentPlayer: firstPlayer,
    dice: null,
    consecutiveSixes: 0,
    winner: null,
    rankings: [],
    version: state.version + 1,
    turnExpiresAt: now + turnDurationMs,
    lastNotice: null,
  };
}

export function forfeitTurn(
  state: GameState,
  candidateSeats?: PlayerIndex[] | Set<PlayerIndex>,
  now = Date.now(),
  notice?: TurnNotice
): GameState {
  if (state.status !== 'playing') return state;
  const seats = candidateSeats ?? getRemainingSeats(state);
  const nextPlayer = getNextPlayer(state.currentPlayer, seats);
  const turnDurationMs = state.turnDurationMs || DEFAULT_TURN_DURATION_MS;
  const playerName = state.players.find((p) => p.seat === state.currentPlayer)?.name || `Player ${state.currentPlayer + 1}`;
  const defaultNotice: TurnNotice = notice ?? {
    type: 'timeout',
    message: `${playerName} timed out. Turn forfeited.`,
    seat: state.currentPlayer,
    playerName,
    dice: state.dice ?? undefined,
    timestamp: now,
  };

  return {
    ...state,
    currentPlayer: nextPlayer,
    dice: null,
    consecutiveSixes: 0,
    version: state.version + 1,
    turnExpiresAt: now + turnDurationMs,
    lastNotice: defaultNotice,
  };
}

export function absoluteCell(player: PlayerIndex, progress: number): number {
  return (START_OFFSETS[player] + progress) % PATH_LENGTH;
}

export function canLeaveBase(dice: number): boolean {
  return dice === 6;
}

export function stepsToFinish(pos: TokenPosition): number {
  if (pos.kind === 'base') return Infinity;
  if (pos.kind === 'path') {
    return (MAX_PATH_PROGRESS - pos.progress) + HOME_LENGTH;
  }
  return HOME_LENGTH - pos.progress;
}

export function isLegalMove(pos: TokenPosition, dice: number): boolean {
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) return false;
  if (pos.kind === 'base') return canLeaveBase(dice);
  return dice <= stepsToFinish(pos);
}

export function legalTokens(state: GameState, player: PlayerIndex, dice: number): number[] {
  if (!state.tokens[player]) return [];
  return state.tokens[player].map((p, i) => (isLegalMove(p, dice) ? i : -1)).filter((i) => i >= 0);
}

export function moveToken(
  state: GameState,
  player: PlayerIndex,
  token: number,
  dice: number,
  now = Date.now()
): { state: GameState; captured: boolean; capturedSeat?: PlayerIndex; winner: boolean; finished: boolean; pawnReachedHome: boolean; rank?: number } {
  if (state.status !== 'playing' || state.currentPlayer !== player) throw new Error('not your turn');
  if (state.rankings && state.rankings.includes(player)) throw new Error('player already finished');
  if (
    !Number.isInteger(token) ||
    token < 0 ||
    token > 3 ||
    !state.tokens[player]?.[token] ||
    !isLegalMove(state.tokens[player][token], dice)
  ) {
    throw new Error('illegal token move');
  }

  const next = state.tokens.map((ts) => ts.map((p) => ({ ...p } as TokenPosition)));
  const old = next[player][token];
  if (old.kind === 'base') {
    next[player][token] = { kind: 'path', progress: 0 };
  } else if (old.kind === 'path') {
    if (old.progress + dice <= MAX_PATH_PROGRESS) {
      next[player][token] = { kind: 'path', progress: old.progress + dice };
    } else {
      const homeStep = (old.progress + dice) - MAX_PATH_PROGRESS;
      next[player][token] = { kind: 'home', progress: homeStep };
    }
  } else {
    next[player][token] = { kind: 'home', progress: old.progress + dice };
  }

  let captured = false;
  let capturedSeat: PlayerIndex | undefined;
  const landed = next[player][token];
  if (landed.kind === 'path' && !SAFE_CELLS.has(absoluteCell(player, landed.progress))) {
    for (const p of state.players) {
      if (p.seat === player) continue;
      const opponent = p.seat;
      const oppTokens = next[opponent];
      if (!oppTokens) continue;
      for (let i = 0; i < oppTokens.length; i++) {
        const tokenPos = oppTokens[i];
        if (tokenPos.kind === 'path' && absoluteCell(opponent, tokenPos.progress) === absoluteCell(player, landed.progress)) {
          oppTokens[i] = { kind: 'base' };
          captured = true;
          if (capturedSeat === undefined) capturedSeat = opponent;
        }
      }
    }
  }

  const playerFinished = isPlayerFinished(next[player]);
  const updatedRankings = [...(state.rankings || [])];
  let justFinished = false;
  let playerRank: number | undefined = undefined;

  if (playerFinished && !updatedRankings.includes(player)) {
    updatedRankings.push(player);
    justFinished = true;
    playerRank = updatedRankings.length;
  }

  const pawnReachedHome =
    landed.kind === 'home' &&
    landed.progress === HOME_LENGTH &&
    (old.kind !== 'home' || old.progress !== HOME_LENGTH);

  const totalPlayers = state.players.length;
  const remainingSeats = state.players.map((p) => p.seat).filter((s) => !updatedRankings.includes(s));

  // 2-player ends when 1st place finishes; 3+ player ends when 2 players finish or only 1 player remains
  const isMatchFinished =
    totalPlayers <= 2
      ? updatedRankings.length >= 1
      : updatedRankings.length >= 2 || remainingSeats.length <= 1;

  const matchWinner = updatedRankings[0] ?? null;

  let nextPlayer: PlayerIndex;
  let earnsExtraTurn = false;

  if (isMatchFinished) {
    nextPlayer = player;
  } else if (justFinished) {
    nextPlayer = getNextPlayer(player, remainingSeats);
  } else if (captured || dice === 6 || pawnReachedHome) {
    earnsExtraTurn = true;
    nextPlayer = player;
  } else {
    nextPlayer = getNextPlayer(player, remainingSeats);
  }

  const turnDurationMs = state.turnDurationMs || DEFAULT_TURN_DURATION_MS;
  const playerName = state.players.find((p) => p.seat === player)?.name || `Player ${player + 1}`;

  let notice: TurnNotice | null = null;
  if (isMatchFinished) {
    if (justFinished && playerRank === 2) {
      notice = {
        type: 'podium_finish',
        message: `${playerName} finished in 2nd Place! Match complete.`,
        seat: player,
        playerName,
        timestamp: now,
      };
    } else {
      notice = {
        type: 'podium_finish',
        message: `${playerName} won 1st Place! Match complete.`,
        seat: player,
        playerName,
        timestamp: now,
      };
    }
  } else if (justFinished && playerRank === 1) {
    notice = {
      type: 'podium_finish',
      message: `${playerName} finished in 1st Place! 🏆 Play continues for 2nd place.`,
      seat: player,
      playerName,
      timestamp: now,
    };
  } else if (earnsExtraTurn) {
    if (pawnReachedHome) {
      notice = {
        type: 'extra_turn',
        message: `Pawn reached home — Bonus turn!`,
        seat: player,
        playerName,
        dice,
        timestamp: now,
      };
    } else if (captured && dice === 6) {
      notice = {
        type: 'extra_turn',
        message: `Captured opponent and rolled 6! Extra turn awarded.`,
        seat: player,
        playerName,
        dice,
        timestamp: now,
      };
    } else if (captured) {
      notice = {
        type: 'extra_turn',
        message: `Captured an opponent token! Bonus turn awarded.`,
        seat: player,
        playerName,
        dice,
        timestamp: now,
      };
    } else {
      notice = {
        type: 'extra_turn',
        message: `Rolled a 6! Extra turn awarded.`,
        seat: player,
        playerName,
        dice,
        timestamp: now,
      };
    }
  }

  return {
    state: {
      ...state,
      tokens: next,
      currentPlayer: nextPlayer,
      dice: null,
      consecutiveSixes: nextPlayer === player && dice === 6 ? state.consecutiveSixes : 0,
      status: isMatchFinished ? 'finished' : 'playing',
      winner: matchWinner,
      rankings: updatedRankings,
      version: state.version + 1,
      turnExpiresAt: isMatchFinished ? null : now + turnDurationMs,
      lastNotice: notice,
    },
    captured,
    capturedSeat,
    winner: isMatchFinished,
    finished: justFinished,
    pawnReachedHome,
    rank: playerRank,
  };
}

export function roll(state: GameState, player: PlayerIndex, value: number, now = Date.now()): GameState {
  if (state.status !== 'playing' || state.currentPlayer !== player || state.dice !== null) throw new Error('cannot roll now');
  if (state.rankings && state.rankings.includes(player)) throw new Error('player already finished');
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('invalid dice');
  const sixes = value === 6 ? state.consecutiveSixes + 1 : 0;
  const remainingSeats = getRemainingSeats(state);
  const turnDurationMs = state.turnDurationMs || DEFAULT_TURN_DURATION_MS;
  const playerName = state.players.find((p) => p.seat === player)?.name || `Player ${player + 1}`;

  if (sixes >= 3) {
    return {
      ...state,
      currentPlayer: getNextPlayer(player, remainingSeats),
      dice: null,
      consecutiveSixes: 0,
      version: state.version + 1,
      turnExpiresAt: now + turnDurationMs,
      lastNotice: {
        type: 'three_sixes',
        message: `Three consecutive sixes! ${playerName} forfeited turn.`,
        seat: player,
        playerName,
        timestamp: now,
      },
    };
  }

  const moves = legalTokens(state, player, value);
  if (moves.length === 0) {
    const nextPlayer = value === 6 ? player : getNextPlayer(player, remainingSeats);
    return {
      ...state,
      currentPlayer: nextPlayer,
      dice: null,
      consecutiveSixes: sixes,
      version: state.version + 1,
      turnExpiresAt: now + turnDurationMs,
      lastNotice: {
        type: 'auto_pass',
        message: `${playerName} rolled ${value} with no legal moves. Passing turn.`,
        seat: player,
        playerName,
        dice: value,
        timestamp: now,
      },
    };
  }

  return {
    ...state,
    dice: value,
    consecutiveSixes: sixes,
    version: state.version + 1,
    turnExpiresAt: now + turnDurationMs,
    lastNotice:
      value === 6
        ? {
            type: 'extra_turn',
            message: `${playerName} rolled a 6! Extra turn awarded.`,
            seat: player,
            playerName,
            dice: 6,
            timestamp: now,
          }
        : null,
  };
}
