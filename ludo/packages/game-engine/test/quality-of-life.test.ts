import { describe, it, expect } from 'vitest';
import {
  initialState,
  startGame,
  roll,
  moveToken,
  legalTokens,
  GameState,
  PlayerIndex,
  Player,
} from '../src/index';

function createMatch(numPlayers = 2): GameState {
  const players: Player[] = [
    { id: 'p0', seat: 0 as PlayerIndex, color: 'red' as const, name: 'Alice' },
    { id: 'p1', seat: 1 as PlayerIndex, color: 'green' as const, name: 'Bob' },
  ];
  if (numPlayers >= 3) {
    players.push({ id: 'p2', seat: 2 as PlayerIndex, color: 'yellow' as const, name: 'Charlie' });
  }
  if (numPlayers >= 4) {
    players.push({ id: 'p3', seat: 3 as PlayerIndex, color: 'blue' as const, name: 'Diana' });
  }
  return startGame(initialState(players));
}

describe('Quality of Life Update 2 — Rules & Movement Correctness', () => {
  describe('Priority 1: Dice Movement Mathematical Correctness', () => {
    it('moves pawn exactly 3 cells when rolling 3 across outer track', () => {
      let state = createMatch(2);
      // Deploy pawn 0 for player 0 (Red)
      state = roll(state, 0, 6);
      let res = moveToken(state, 0, 0, 6);
      state = res.state;
      expect(state.tokens[0][0]).toEqual({ kind: 'path', progress: 0 });

      // Roll 3 - must move exactly 3 cells to progress 3
      state = roll(state, 0, 3);
      res = moveToken(state, 0, 0, 3);
      state = res.state;
      expect(state.tokens[0][0]).toEqual({ kind: 'path', progress: 3 });
      expect(state.tokens[0][0].progress - 0).toBe(3);

      // Roll 3 again on next turn (pass P1's turn)
      state = roll(state, 1, 2); // P1 has no moves in base
      expect(state.currentPlayer).toBe(0);

      state = roll(state, 0, 3);
      res = moveToken(state, 0, 0, 3);
      state = res.state;
      expect(state.tokens[0][0]).toEqual({ kind: 'path', progress: 6 });
      expect(state.tokens[0][0].progress - 3).toBe(3);
    });

    it('moves pawn exactly N cells for all dice values 1, 2, 4, 5, 6', () => {
      for (const diceVal of [1, 2, 4, 5, 6]) {
        let state = createMatch(2);
        state = roll(state, 0, 6);
        let res = moveToken(state, 0, 0, 6);
        state = res.state;
        const initialProgress = state.tokens[0][0].progress;

        // If extra turn awarded on 6, currentPlayer is still 0
        if (state.currentPlayer !== 0) {
          state = roll(state, 1, 1);
        }
        state = roll(state, 0, diceVal);
        res = moveToken(state, 0, 0, diceVal);
        state = res.state;

        const newProgress = state.tokens[0][0].progress;
        expect(newProgress - initialProgress).toBe(diceVal);
      }
    });

    it('advances exactly into home lane with roll of 3 from cell 50', () => {
      let state = createMatch(2);
      // Place pawn at progress 50 (the final cell of the outer track before home entrance)
      state.tokens[0][0] = { kind: 'path', progress: 50 };

      // Roll 3: 50 + 3 -> 3 steps into home lane (progress 3)
      state = roll(state, 0, 3);
      const res = moveToken(state, 0, 0, 3);
      expect(res.state.tokens[0][0]).toEqual({ kind: 'home', progress: 3 });
    });

    it('rejects overshoot when roll exceeds exact distance to center goal', () => {
      let state = createMatch(2);
      state.tokens[0][0] = { kind: 'home', progress: 4 };

      // Distance to finish (progress 6) is exactly 2.
      // Roll 3 should have no legal moves for this token.
      const legals = legalTokens(state, 0, 3);
      expect(legals).not.toContain(0);
    });
  });

  describe('Priority 2: Finishing Bonus Turn and Capture Bonus Turn', () => {
    it('awards a bonus turn when a single pawn reaches home goal (progress 6)', () => {
      let state = createMatch(2);
      // Pawn 0 is at home progress 4, Pawn 1 is still in base
      state.tokens[0][0] = { kind: 'home', progress: 4 };
      state.tokens[0][1] = { kind: 'base', progress: 0 };
      state.tokens[0][2] = { kind: 'base', progress: 0 };
      state.tokens[0][3] = { kind: 'base', progress: 0 };

      // Roll 2 to bring pawn 0 exactly to home goal (progress 6)
      state = roll(state, 0, 2);
      const res = moveToken(state, 0, 0, 2);

      expect(res.pawnReachedHome).toBe(true);
      expect(res.winner).toBe(false); // only 1 pawn finished, match not won yet
      expect(res.state.tokens[0][0]).toEqual({ kind: 'home', progress: 6 });

      // Player 0 must retain the turn (Bonus turn!)
      expect(res.state.currentPlayer).toBe(0);
      expect(res.state.lastNotice?.type).toBe('extra_turn');
      expect(res.state.lastNotice?.message).toContain('Pawn reached home — Bonus turn!');

      // Player 0 can roll again immediately
      expect(res.state.dice).toBeNull();
      const afterBonusRoll = roll(res.state, 0, 6);
      expect(afterBonusRoll.currentPlayer).toBe(0);
      expect(afterBonusRoll.dice).toBe(6);
    });

    it('awards bonus turn on capture of opponent pawn', () => {
      let state = createMatch(2);
      state = {
        ...state,
        currentPlayer: 0,
        tokens: [
          [{ kind: 'path', progress: 26 }, { kind: 'base', progress: 0 }, { kind: 'base', progress: 0 }, { kind: 'base', progress: 0 }],
          [{ kind: 'path', progress: 1 }, { kind: 'base', progress: 0 }, { kind: 'base', progress: 0 }, { kind: 'base', progress: 0 }],
        ],
      };

      // Player 0 rolls 1, moves token 0 to progress 27 (abs cell 27, capturing P1 who is at seat 1 start 13 + progress 14? Let's check capture)
      // Path 27 for Seat 0: (0 + 27) = 27
      // For Seat 1: start offset 13. Progress 14 -> 13 + 14 = 27.
      state.tokens[1][0] = { kind: 'path', progress: 14 };

      state = roll(state, 0, 1);
      const res = moveToken(state, 0, 0, 1);

      expect(res.captured).toBe(true);
      expect(res.state.tokens[1][0]).toEqual({ kind: 'base' }); // captured returned to base
      expect(res.state.currentPlayer).toBe(0); // bonus turn awarded
      expect(res.state.lastNotice?.type).toBe('extra_turn');
    });
  });

  describe('Priority 3: Two-Winner Match Lifecycle', () => {
    it('2-player match ends when first player brings all 4 pawns home', () => {
      let state = createMatch(2);
      state.tokens[0][0] = { kind: 'home', progress: 6 };
      state.tokens[0][1] = { kind: 'home', progress: 6 };
      state.tokens[0][2] = { kind: 'home', progress: 6 };
      state.tokens[0][3] = { kind: 'home', progress: 5 };

      // Roll 1 to finish 4th pawn
      state = roll(state, 0, 1);
      const res = moveToken(state, 0, 3, 1);

      expect(res.winner).toBe(true);
      expect(res.state.status).toBe('finished');
      expect(res.state.rankings).toEqual([0]);
    });

    it('3-player match continues after 1st place finishes, and ends when 2nd place finishes', () => {
      let state = createMatch(3);
      // P0 is about to finish
      state.tokens[0][0] = { kind: 'home', progress: 6 };
      state.tokens[0][1] = { kind: 'home', progress: 6 };
      state.tokens[0][2] = { kind: 'home', progress: 6 };
      state.tokens[0][3] = { kind: 'home', progress: 5 };

      // P1 has 3 home, 1 at progress 5
      state.tokens[1][0] = { kind: 'home', progress: 6 };
      state.tokens[1][1] = { kind: 'home', progress: 6 };
      state.tokens[1][2] = { kind: 'home', progress: 6 };
      state.tokens[1][3] = { kind: 'home', progress: 5 };

      // P0 finishes 4th pawn
      state = roll(state, 0, 1);
      const res1 = moveToken(state, 0, 3, 1);

      expect(res1.winner).toBe(false); // Match NOT over! 2 players remain
      expect(res1.state.status).toBe('playing');
      expect(res1.state.rankings).toEqual([0]); // P0 takes 1st place
      expect(res1.state.currentPlayer).toBe(1); // turn passes to next active seat

      // P0 cannot roll now
      expect(() => roll(res1.state, 0, 5)).toThrow(/already finished|cannot roll now/);

      // P1 rolls 1 and finishes 4th pawn (taking 2nd place)
      let state2 = roll(res1.state, 1, 1);
      const res2 = moveToken(state2, 1, 3, 1);

      // Now 2 winners have finished in a 3-player match! Match must be finished.
      expect(res2.winner).toBe(true);
      expect(res2.state.status).toBe('finished');
      expect(res2.state.rankings).toEqual([0, 1]);
    });

    it('4-player match continues after 1st place finishes, ends on 2nd place finish', () => {
      let state = createMatch(4);
      // P0 finishes all 4
      state.tokens[0][0] = { kind: 'home', progress: 6 };
      state.tokens[0][1] = { kind: 'home', progress: 6 };
      state.tokens[0][2] = { kind: 'home', progress: 6 };
      state.tokens[0][3] = { kind: 'home', progress: 5 };

      state = roll(state, 0, 1);
      const res1 = moveToken(state, 0, 3, 1);

      expect(res1.state.status).toBe('playing');
      expect(res1.state.rankings).toEqual([0]);

      // Turn passes to seat 1, then seat 2, then seat 3, never seat 0
      expect(res1.state.currentPlayer).toBe(1);

      // Finished player cannot move or roll
      expect(() => roll(res1.state, 0, 6)).toThrow();
      expect(() => moveToken(res1.state, 0, 0, 6)).toThrow();
    });
  });
});
