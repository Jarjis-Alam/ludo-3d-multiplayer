import { describe, it, expect } from 'vitest';
import {
  initialState,
  startGame,
  moveToken,
  roll,
  legalTokens,
  isLegalMove,
  stepsToFinish,
  absoluteCell,
  forfeitTurn,
  MAX_PATH_PROGRESS,
  PATH_LENGTH,
  HOME_LENGTH,
  START_OFFSETS,
  SAFE_CELLS,
  type Player,
  type PlayerIndex,
  type TokenPosition,
} from '../src/index';

const players: Player[] = [
  { id: 'p0', name: 'Alice', color: 'red', seat: 0 },
  { id: 'p1', name: 'Bob', color: 'green', seat: 1 },
  { id: 'p2', name: 'Charlie', color: 'yellow', seat: 2 },
  { id: 'p3', name: 'Diana', color: 'blue', seat: 3 },
];

// Board coordinate definitions matching Board2D.tsx
const TRACK_COORDS: Array<{ col: number; row: number }> = [
  { col: 1, row: 6 },  { col: 2, row: 6 },  { col: 3, row: 6 },  { col: 4, row: 6 },  { col: 5, row: 6 },
  { col: 6, row: 5 },  { col: 6, row: 4 },  { col: 6, row: 3 },  { col: 6, row: 2 },  { col: 6, row: 1 },  { col: 6, row: 0 },
  { col: 7, row: 0 },
  { col: 8, row: 0 },  { col: 8, row: 1 },  { col: 8, row: 2 },  { col: 8, row: 3 },  { col: 8, row: 4 },  { col: 8, row: 5 },
  { col: 9, row: 6 },  { col: 10, row: 6 }, { col: 11, row: 6 }, { col: 12, row: 6 }, { col: 13, row: 6 }, { col: 14, row: 6 },
  { col: 14, row: 7 },
  { col: 14, row: 8 }, { col: 13, row: 8 }, { col: 12, row: 8 }, { col: 11, row: 8 }, { col: 10, row: 8 }, { col: 9, row: 8 },
  { col: 8, row: 9 },  { col: 8, row: 10 }, { col: 8, row: 11 }, { col: 8, row: 12 }, { col: 8, row: 13 }, { col: 8, row: 14 },
  { col: 7, row: 14 },
  { col: 6, row: 14 }, { col: 6, row: 13 }, { col: 6, row: 12 }, { col: 6, row: 11 }, { col: 6, row: 10 }, { col: 6, row: 9 },
  { col: 5, row: 8 },  { col: 4, row: 8 },  { col: 3, row: 8 },  { col: 2, row: 8 },  { col: 1, row: 8 },  { col: 0, row: 8 },
  { col: 0, row: 7 },
  { col: 0, row: 6 },
];

const HOME_LANE_COORDS: Record<number, Array<{ col: number; row: number }>> = {
  0: [{ col: 1, row: 7 }, { col: 2, row: 7 }, { col: 3, row: 7 }, { col: 4, row: 7 }, { col: 5, row: 7 }],
  1: [{ col: 7, row: 1 }, { col: 7, row: 2 }, { col: 7, row: 3 }, { col: 7, row: 4 }, { col: 7, row: 5 }],
  2: [{ col: 13, row: 7 }, { col: 12, row: 7 }, { col: 11, row: 7 }, { col: 10, row: 7 }, { col: 9, row: 7 }],
  3: [{ col: 7, row: 13 }, { col: 7, row: 12 }, { col: 7, row: 11 }, { col: 7, row: 10 }, { col: 7, row: 9 }],
};

const GOAL_COORDS: Record<number, { col: number; row: number }> = {
  0: { col: 6.5, row: 7 },
  1: { col: 7, row: 6.5 },
  2: { col: 7.5, row: 7 },
  3: { col: 7, row: 7.5 },
};

function getBoardDOMKey(seat: PlayerIndex, pos: TokenPosition): string {
  if (pos.kind === 'base') return `base-${seat}`;
  if (pos.kind === 'home') {
    if (pos.progress >= 6) return `goal-${seat}`;
    const step = Math.min(4, Math.max(0, pos.progress - 1));
    return `home-${seat}-${step}`;
  }
  const absCell = absoluteCell(seat, pos.progress);
  return `track-${absCell}`;
}

describe('Home-Lane Progression & Full Circuit Audit Suite', () => {
  it('confirms mathematical constants: 52 outer cells, 50 path steps, 6 home steps', () => {
    expect(PATH_LENGTH).toBe(52);
    expect(MAX_PATH_PROGRESS).toBe(50);
    expect(HOME_LENGTH).toBe(6);
    expect(START_OFFSETS).toEqual([0, 13, 26, 39]);
    expect(TRACK_COORDS).toHaveLength(52);
  });

  const seatConfigs: Array<{
    seat: PlayerIndex;
    name: string;
    startCell: number;
    homeEntryCell: number;
    skippedBypassCell: number;
    firstHomeCoord: { col: number; row: number };
    goalCoord: { col: number; row: number };
  }> = [
    {
      seat: 0,
      name: 'Red',
      startCell: 0,
      homeEntryCell: 50,
      skippedBypassCell: 51,
      firstHomeCoord: { col: 1, row: 7 },
      goalCoord: { col: 6.5, row: 7 },
    },
    {
      seat: 1,
      name: 'Green',
      startCell: 13,
      homeEntryCell: 11,
      skippedBypassCell: 12,
      firstHomeCoord: { col: 7, row: 1 },
      goalCoord: { col: 7, row: 6.5 },
    },
    {
      seat: 2,
      name: 'Yellow',
      startCell: 26,
      homeEntryCell: 24,
      skippedBypassCell: 25,
      firstHomeCoord: { col: 13, row: 7 },
      goalCoord: { col: 7.5, row: 7 },
    },
    {
      seat: 3,
      name: 'Blue',
      startCell: 39,
      homeEntryCell: 37,
      skippedBypassCell: 38,
      firstHomeCoord: { col: 7, row: 13 },
      goalCoord: { col: 7, row: 7.5 },
    },
  ];

  for (const cfg of seatConfigs) {
    describe(`Player ${cfg.seat} (${cfg.name}) Full Journey Audit`, () => {
      it(`verifies starting index, home-entry cell, and skipped bypass cell`, () => {
        // Start cell is at progress 0
        expect(absoluteCell(cfg.seat, 0)).toBe(cfg.startCell);
        // Home entry cell is at progress 50
        expect(absoluteCell(cfg.seat, 50)).toBe(cfg.homeEntryCell);
        // The bypass cell is at progress 51 (connecting bridge back to start cell, never entered by owner)
        expect(absoluteCell(cfg.seat, 51)).toBe(cfg.skippedBypassCell);
        // Distance from start to home entry is exactly 50 steps
        expect((cfg.startCell + 50) % 52).toBe(cfg.homeEntryCell);
      });

      it(`simulates complete journey: deployment -> 50 track steps -> 5 home steps -> goal`, () => {
        let state = startGame(initialState(players));
        state = { ...state, currentPlayer: cfg.seat };

        // 1. Starting position: token 0 in base
        expect(state.tokens[cfg.seat][0]).toEqual({ kind: 'base' });
        expect(stepsToFinish(state.tokens[cfg.seat][0])).toBe(Infinity);
        expect(isLegalMove(state.tokens[cfg.seat][0], 5)).toBe(false);
        expect(isLegalMove(state.tokens[cfg.seat][0], 6)).toBe(true);

        // 2. Deployment onto outer track on rolling 6
        state = roll(state, cfg.seat, 6);
        const deployRes = moveToken(state, cfg.seat, 0, 6);
        state = deployRes.state;
        expect(state.tokens[cfg.seat][0]).toEqual({ kind: 'path', progress: 0 });
        expect(absoluteCell(cfg.seat, 0)).toBe(cfg.startCell);
        expect(getBoardDOMKey(cfg.seat, state.tokens[cfg.seat][0])).toBe(`track-${cfg.startCell}`);
        expect(TRACK_COORDS[cfg.startCell]).toBeDefined();

        // 3. Move across outer track from progress 0 to 50 step-by-step
        for (let p = 1; p <= 50; p++) {
          state = { ...state, currentPlayer: cfg.seat, dice: 1 };
          const stepRes = moveToken(state, cfg.seat, 0, 1);
          state = stepRes.state;
          const pos = state.tokens[cfg.seat][0];
          expect(pos).toEqual({ kind: 'path', progress: p });
          const abs = absoluteCell(cfg.seat, p);
          expect(getBoardDOMKey(cfg.seat, pos)).toBe(`track-${abs}`);
          expect(TRACK_COORDS[abs]).toBeDefined();
          expect(stepsToFinish(pos)).toBe(50 - p + 6);
        }

        // At progress 50, pawn is on home-entry bridge cell
        expect(state.tokens[cfg.seat][0]).toEqual({ kind: 'path', progress: 50 });
        expect(absoluteCell(cfg.seat, 50)).toBe(cfg.homeEntryCell);
        expect(getBoardDOMKey(cfg.seat, state.tokens[cfg.seat][0])).toBe(`track-${cfg.homeEntryCell}`);
        expect(stepsToFinish(state.tokens[cfg.seat][0])).toBe(6);

        // 4. Transition into home lane cell 0 on dice 1
        state = { ...state, currentPlayer: cfg.seat, dice: 1 };
        const enterHomeRes = moveToken(state, cfg.seat, 0, 1);
        state = enterHomeRes.state;
        expect(state.tokens[cfg.seat][0]).toEqual({ kind: 'home', progress: 1 });
        expect(getBoardDOMKey(cfg.seat, state.tokens[cfg.seat][0])).toBe(`home-${cfg.seat}-0`);
        expect(HOME_LANE_COORDS[cfg.seat][0]).toEqual(cfg.firstHomeCoord);
        expect(stepsToFinish(state.tokens[cfg.seat][0])).toBe(5);

        // 5. Progress through home runway cells 1..4 (home progress 2..5)
        for (let hp = 2; hp <= 5; hp++) {
          state = { ...state, currentPlayer: cfg.seat, dice: 1 };
          const hStepRes = moveToken(state, cfg.seat, 0, 1);
          state = hStepRes.state;
          const hPos = state.tokens[cfg.seat][0];
          expect(hPos).toEqual({ kind: 'home', progress: hp });
          expect(getBoardDOMKey(cfg.seat, hPos)).toBe(`home-${cfg.seat}-${hp - 1}`);
          expect(HOME_LANE_COORDS[cfg.seat][hp - 1]).toBeDefined();
          expect(stepsToFinish(hPos)).toBe(6 - hp);
        }

        // At home progress 5, pawn is on the final runway step immediately before goal
        expect(state.tokens[cfg.seat][0]).toEqual({ kind: 'home', progress: 5 });
        expect(stepsToFinish(state.tokens[cfg.seat][0])).toBe(1);

        // 6. Exact finish into center goal on dice 1
        state = { ...state, currentPlayer: cfg.seat, dice: 1 };
        const finishRes = moveToken(state, cfg.seat, 0, 1);
        state = finishRes.state;
        expect(state.tokens[cfg.seat][0]).toEqual({ kind: 'home', progress: 6 });
        expect(getBoardDOMKey(cfg.seat, state.tokens[cfg.seat][0])).toBe(`goal-${cfg.seat}`);
        expect(GOAL_COORDS[cfg.seat]).toEqual(cfg.goalCoord);
        expect(stepsToFinish(state.tokens[cfg.seat][0])).toBe(0);
      });

      it(`strictly rejects overshooting into home lane and finish`, () => {
        let state = startGame(initialState(players));

        // Token at home-entry cell (progress 50): needs 1..6 to enter/finish
        state = {
          ...state,
          currentPlayer: cfg.seat,
          tokens: state.tokens.map((ts, s) => (s === cfg.seat ? [{ kind: 'path', progress: 50 }, ...ts.slice(1)] : ts)),
        };
        for (let d = 1; d <= 6; d++) {
          expect(isLegalMove(state.tokens[cfg.seat][0], d)).toBe(true);
        }

        // Token at home progress 3: needs exactly 3 to finish
        const home3: TokenPosition = { kind: 'home', progress: 3 };
        expect(stepsToFinish(home3)).toBe(3);
        expect(isLegalMove(home3, 1)).toBe(true);
        expect(isLegalMove(home3, 2)).toBe(true);
        expect(isLegalMove(home3, 3)).toBe(true);
        expect(isLegalMove(home3, 4)).toBe(false);
        expect(isLegalMove(home3, 5)).toBe(false);
        expect(isLegalMove(home3, 6)).toBe(false);

        // Token at home progress 5: needs exactly 1 to finish
        const home5: TokenPosition = { kind: 'home', progress: 5 };
        expect(stepsToFinish(home5)).toBe(1);
        expect(isLegalMove(home5, 1)).toBe(true);
        expect(isLegalMove(home5, 2)).toBe(false);
        expect(isLegalMove(home5, 3)).toBe(false);
        expect(isLegalMove(home5, 6)).toBe(false);

        // Token at goal (home progress 6): cannot move on any roll
        const home6: TokenPosition = { kind: 'home', progress: 6 };
        expect(stepsToFinish(home6)).toBe(0);
        for (let d = 1; d <= 6; d++) {
          expect(isLegalMove(home6, d)).toBe(false);
        }
      });
    });
  }

  describe('Multi-Token and Complex Home-Entry Scenarios', () => {
    it('correctly reports legal tokens when tokens are distributed across base, path, home-entry, and home lane', () => {
      let state = startGame(initialState(players));
      // Red has:
      // Token 0: in base (needs 6)
      // Token 1: at track progress 47 (safe cell 47, needs 3 to reach 50, 4 to enter home 1, 9 to finish)
      // Token 2: at home-entry cell (progress 50, needs 1..6)
      // Token 3: at home runway progress 4 (needs 1 or 2)
      state = {
        ...state,
        currentPlayer: 0,
        tokens: [
          [
            { kind: 'base' },
            { kind: 'path', progress: 47 },
            { kind: 'path', progress: 50 },
            { kind: 'home', progress: 4 },
          ],
          [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
          [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
          [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
        ],
      };

      // On roll of 1:
      // Token 0: cannot leave base (needs 6)
      // Token 1: 47 + 1 = 48 (legal)
      // Token 2: 50 + 1 = home 1 (legal)
      // Token 3: home 4 + 1 = home 5 (legal)
      expect(legalTokens(state, 0, 1)).toEqual([1, 2, 3]);

      // On roll of 2:
      // Token 0: illegal
      // Token 1: 47 + 2 = 49 (legal)
      // Token 2: 50 + 2 = home 2 (legal)
      // Token 3: home 4 + 2 = goal 6 (legal, exact finish!)
      expect(legalTokens(state, 0, 2)).toEqual([1, 2, 3]);

      // On roll of 3:
      // Token 0: illegal
      // Token 1: 47 + 3 = 50 (legal, reaches entry cell)
      // Token 2: 50 + 3 = home 3 (legal)
      // Token 3: home 4 + 3 = 7 > 6 (illegal, overshoots!)
      expect(legalTokens(state, 0, 3)).toEqual([1, 2]);

      // On roll of 6:
      // Token 0: base deploy (legal on 6!)
      // Token 1: 47 + 6 = 53 -> home 3 (legal)
      // Token 2: 50 + 6 = 56 -> goal 6 (legal, exact direct goal finish from entry cell!)
      // Token 3: home 4 + 6 > 6 (illegal)
      expect(legalTokens(state, 0, 6)).toEqual([0, 1, 2]);
    });

    it('captures opponent immediately before home entry and awards bonus turn to enter home lane', () => {
      let state = startGame(initialState(players));
      // Red at cell 49 (progress 49), Blue at cell 50 (progress 11 for Blue, since 39 + 11 = 50)
      // Cell 50 is not in SAFE_CELLS
      expect(SAFE_CELLS.has(50)).toBe(false);
      expect(absoluteCell(3, 11)).toBe(50);
      expect(absoluteCell(0, 49)).toBe(49);

      state = {
        ...state,
        currentPlayer: 0,
        tokens: [
          [{ kind: 'path', progress: 49 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
          [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
          [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
          [{ kind: 'path', progress: 11 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
        ],
      };

      // Red rolls 1 and lands on cell 50
      state = roll(state, 0, 1);
      const capRes = moveToken(state, 0, 0, 1);
      expect(capRes.captured).toBe(true);
      expect(capRes.state.tokens[3][0]).toEqual({ kind: 'base' }); // Blue sent back to base!
      expect(capRes.state.tokens[0][0]).toEqual({ kind: 'path', progress: 50 }); // Red at home entry cell!
      expect(capRes.state.currentPlayer).toBe(0); // Red awarded bonus turn for capture!

      // Red uses bonus turn to roll 2 and enter home lane cell 1 (home progress 2)
      let s2 = roll(capRes.state, 0, 2);
      const enterRes = moveToken(s2, 0, 0, 2);
      expect(enterRes.state.tokens[0][0]).toEqual({ kind: 'home', progress: 2 });
      expect(enterRes.state.currentPlayer).toBe(1); // Turn now passes to next player
    });

    it('handles turn timeout near home entry without corrupting position', () => {
      let state = startGame(initialState(players), 1000);
      state = {
        ...state,
        currentPlayer: 0,
        tokens: [
          [{ kind: 'path', progress: 50 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
          ...state.tokens.slice(1),
        ],
      };

      // Player times out without rolling
      const forfeited = forfeitTurn(state, [0, 1, 2, 3], 16000);
      expect(forfeited.currentPlayer).toBe(1);
      expect(forfeited.tokens[0][0]).toEqual({ kind: 'path', progress: 50 }); // Preserved at cell 50
      expect(forfeited.lastNotice?.type).toBe('timeout');
      expect(forfeited.lastNotice?.seat).toBe(0);
    });
  });
});
