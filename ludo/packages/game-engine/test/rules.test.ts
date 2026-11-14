import {describe,it,expect} from 'vitest';
import {absoluteCell,getNextPlayer,initialState,legalTokens,moveToken,roll,SAFE_CELLS,startGame,type Player} from '../src/index';
const players:Player[]=[0,1,2,3].map((seat)=>({id:`p${seat}`,name:`P${seat}`,color:['red','green','yellow','blue'][seat],seat:seat as 0|1|2|3}));
const playing=()=>startGame(initialState(players));
describe('ludo engine',()=>{
 it('starts four tokens in base',()=>expect(initialState(players).tokens.flat().every(p=>p.kind==='base')).toBe(true));
 it('requires six to leave base and reports legal token indexes',()=>{const s=playing(); expect(legalTokens(s,0,5)).toEqual([]); expect(legalTokens(s,0,6)).toEqual([0,1,2,3]);});
 it('moves a base token onto its starting cell on six',()=>{const s=playing(); const rolled=roll(s,0,6); const moved=moveToken(rolled,0,2,6).state; expect(moved.tokens[0][2]).toEqual({kind:'path',progress:0}); expect(moved.currentPlayer).toBe(0);});
 it('moves normally along the shared path',()=>{let s=playing(); s={...s,tokens:s.tokens.map((ts,i)=>i===0?[{kind:'path',progress:3},...ts.slice(1)]:ts)}; s=roll({...s,currentPlayer:0},0,2); s=moveToken(s,0,0,2).state; expect(s.tokens[0][0]).toEqual({kind:'path',progress:5}); expect(s.currentPlayer).toBe(1);});
 it('rejects wrong turns, invalid dice and illegal tokens',()=>{const s=playing(); expect(()=>roll(s,1,6)).toThrow('cannot roll now'); expect(()=>roll(s,0,7)).toThrow('invalid dice'); expect(()=>moveToken({...s,dice:5},0,0,5)).toThrow('illegal token move');});
 it('captures an opponent on a non-safe cell',()=>{let s=playing(); s={...s,currentPlayer:1,tokens:s.tokens.map((ts,i)=>i===0?[{kind:'path',progress:14},...ts.slice(1)]:i===1?[{kind:'path',progress:0},...ts.slice(1)]:ts)}; s=moveToken({...s,dice:1},1,0,1).state; expect(s.tokens[0][0]).toEqual({kind:'base'});});
 it('protects tokens on safe cells',()=>{let s=playing(); s={...s,currentPlayer:1,tokens:s.tokens.map((ts,i)=>i===0?[{kind:'path',progress:13},...ts.slice(1)]:i===1?[{kind:'path',progress:0},...ts.slice(1)]:ts)}; const moved=moveToken({...s,dice:6},1,0,6).state; expect(moved.tokens[0][0]).toEqual({kind:'path',progress:13}); expect(SAFE_CELLS.has(absoluteCell(0,13))).toBe(true);});
 it('enters the home lane and requires an exact finish',()=>{let s=playing(); s={...s,tokens:s.tokens.map((ts,i)=>i===0?[{kind:'path',progress:51},...ts.slice(1)]:ts)}; s=moveToken({...s,dice:1},0,0,1).state; expect(s.tokens[0][0]).toEqual({kind:'home',progress:0}); expect(legalTokens({...s,currentPlayer:0},0,7 as any)).toEqual([]);});
 it('does not move beyond the final home position',()=>{let s=playing(); s={...s,tokens:s.tokens.map((ts,i)=>i===0?[{kind:'home',progress:5},...ts.slice(1)]:ts)}; expect(legalTokens(s,0,2)).toEqual([]);});
 it('auto-passes when no token can move',()=>{const s=roll(playing(),0,4); expect(s.dice).toBeNull(); expect(s.currentPlayer).toBe(1);});
 it('forfeits after three consecutive sixes',()=>{let s=playing(); s=moveToken(roll(s,0,6),0,0,6).state; s=moveToken(roll(s,0,6),0,1,6).state; s=roll(s,0,6); expect(s.currentPlayer).toBe(1); expect(s.dice).toBeNull(); expect(s.consecutiveSixes).toBe(0);});
 it('declares a winner only when all four tokens finish exactly',()=>{let s=playing(); s={...s,tokens:[[...Array(3).fill({kind:'home',progress:6}),{kind:'home',progress:5}],...s.tokens.slice(1)]}; const out=moveToken({...s,dice:1},0,3,1); expect(out.winner).toBe(true); expect(out.state.status).toBe('finished'); expect(out.state.winner).toBe(0);});

 describe('2-player and 3-player dynamic turn rotation', () => {
   it('calculates next active player skipping empty seats', () => {
     // 2 players: seats 0 and 1
     expect(getNextPlayer(0, [0, 1])).toBe(1);
     expect(getNextPlayer(1, [0, 1])).toBe(0);

     // 2 players: non-adjacent seats 0 and 2
     expect(getNextPlayer(0, [0, 2])).toBe(2);
     expect(getNextPlayer(2, [0, 2])).toBe(0);

     // 3 players: seats 0, 1, 2 (skips 3)
     expect(getNextPlayer(0, [0, 1, 2])).toBe(1);
     expect(getNextPlayer(1, [0, 1, 2])).toBe(2);
     expect(getNextPlayer(2, [0, 1, 2])).toBe(0);

     // 3 players: seats 0, 2, 3 (skips 1)
     expect(getNextPlayer(0, [0, 2, 3])).toBe(2);
     expect(getNextPlayer(2, [0, 2, 3])).toBe(3);
     expect(getNextPlayer(3, [0, 2, 3])).toBe(0);
   });

   it('runs a 2-player match alternating between seats 0 and 1 only', () => {
     const twoPlayers: Player[] = [
       { id: 'p0', name: 'Alice', color: 'red', seat: 0 },
       { id: 'p1', name: 'Bob', color: 'green', seat: 1 },
     ];
     const initial = initialState(twoPlayers);
     expect(initial.tokens[0]).toHaveLength(4);
     expect(initial.tokens[1]).toHaveLength(4);
     expect(initial.tokens[2]).toHaveLength(0);
     expect(initial.tokens[3]).toHaveLength(0);

     let s = startGame(initial);
     expect(s.currentPlayer).toBe(0);

     // Alice rolls 4 with all tokens in base -> auto-pass directly to Bob (seat 1), skipping 2 and 3
     s = roll(s, 0, 4);
     expect(s.currentPlayer).toBe(1);
     expect(s.dice).toBeNull();

     // Bob rolls 2 with all tokens in base -> auto-pass directly back to Alice (seat 0)
     s = roll(s, 1, 2);
     expect(s.currentPlayer).toBe(0);
     expect(s.dice).toBeNull();

     // Alice rolls 6 -> gets extra roll on moving token
     s = roll(s, 0, 6);
     expect(s.dice).toBe(6);
     const moveRes = moveToken(s, 0, 0, 6);
     s = moveRes.state;
     expect(s.currentPlayer).toBe(0); // retains turn on 6
     expect(s.tokens[0][0]).toEqual({ kind: 'path', progress: 0 });

     // Alice rolls 3 and moves -> now turn passes to Bob (seat 1)
     s = roll(s, 0, 3);
     s = moveToken(s, 0, 0, 3).state;
     expect(s.currentPlayer).toBe(1);
     expect(s.tokens[0][0]).toEqual({ kind: 'path', progress: 3 });
   });

   it('handles captures and extra turns in a 2-player game with non-adjacent seats', () => {
     const twoPlayers: Player[] = [
       { id: 'p0', name: 'Alice', color: 'red', seat: 0 },
       { id: 'p2', name: 'Charlie', color: 'yellow', seat: 2 },
     ];
     let s = startGame(initialState(twoPlayers));
     expect(s.currentPlayer).toBe(0);

     // Turn alternates between 0 and 2
     s = roll(s, 0, 5); // auto-pass
     expect(s.currentPlayer).toBe(2);
     s = roll(s, 2, 4); // auto-pass
     expect(s.currentPlayer).toBe(0);

     // Setup capture on non-safe cell 27: Alice token at progress 26, Charlie token at cell 27 (progress 1)
     // Cell 27 is not in SAFE_CELLS (26 is safe starting cell, 27 is standard path)
     s = {
       ...s,
       currentPlayer: 0,
       tokens: [
         [{ kind: 'path', progress: 26 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
         [],
         [{ kind: 'path', progress: 1 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
         [],
       ],
     };
     // Alice rolls 1 and lands on cell 27 -> captures Charlie
     s = roll(s, 0, 1);
     const cap = moveToken(s, 0, 0, 1);
     expect(cap.captured).toBe(true);
     expect(cap.state.tokens[2][0]).toEqual({ kind: 'base' });
     expect(cap.state.currentPlayer).toBe(2); // Passed to Charlie
   });
 });
});
