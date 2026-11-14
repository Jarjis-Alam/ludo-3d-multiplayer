export type PlayerIndex = 0|1|2|3;
export type TokenPosition = { kind:'base' } | { kind:'path'; progress:number } | { kind:'home'; progress:number };
export type Player = { id:string; name:string; color:string; seat:PlayerIndex };
export type GameState = { players:Player[]; tokens:TokenPosition[][]; currentPlayer:PlayerIndex; dice:number|null; consecutiveSixes:number; status:'lobby'|'playing'|'finished'; winner:PlayerIndex|null; version:number };
export const COLORS = ['red','green','yellow','blue'] as const;
export const PATH_LENGTH = 52;
export const HOME_LENGTH = 6;
export const START_OFFSETS = [0,13,26,39] as const;
export const SAFE_CELLS = new Set([0,8,13,21,26,34,39,47]);

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

export function initialState(players:Player[], initialVersion = 0):GameState {
  const activeSeats = new Set(players.map((p) => p.seat));
  const tokens: TokenPosition[][] = Array.from({ length: 4 }, (_, seat) =>
    activeSeats.has(seat as PlayerIndex)
      ? Array.from({ length: 4 }, () => ({ kind: 'base' } as TokenPosition))
      : []
  );
  const firstPlayer = players[0]?.seat ?? 0;
  return {players,tokens,currentPlayer:firstPlayer,dice:null,consecutiveSixes:0,status:'lobby',winner:null,version:initialVersion};
}
export function startGame(state:GameState):GameState {
  const firstPlayer = state.players[0]?.seat ?? 0;
  return {...state,status:'playing',currentPlayer:firstPlayer,dice:null,consecutiveSixes:0,winner:null,version:state.version+1};
}
export function absoluteCell(player:PlayerIndex, progress:number):number { return (START_OFFSETS[player] + progress) % PATH_LENGTH; }
export function canLeaveBase(dice:number):boolean { return dice===6; }
export function stepsToFinish(pos:TokenPosition):number { if(pos.kind==='base') return Infinity; if(pos.kind==='path') return PATH_LENGTH - pos.progress + HOME_LENGTH; return HOME_LENGTH - pos.progress; }
export function isLegalMove(pos:TokenPosition,dice:number):boolean { return dice>=1 && dice<=6 && (pos.kind==='base' ? canLeaveBase(dice) : dice<=stepsToFinish(pos)); }
export function legalTokens(state:GameState, player:PlayerIndex, dice:number):number[] {
  if (!state.tokens[player]) return [];
  return state.tokens[player].map((p,i)=>isLegalMove(p,dice)?i:-1).filter(i=>i>=0);
}
export function moveToken(state:GameState, player:PlayerIndex, token:number, dice:number):{state:GameState,captured:boolean,winner:boolean} {
  if(state.status!=='playing' || state.currentPlayer!==player) throw new Error('not your turn');
  if(!Number.isInteger(token)||token<0||token>3||!state.tokens[player]?.[token]||!isLegalMove(state.tokens[player][token],dice)) throw new Error('illegal token move');
  const next=state.tokens.map(ts=>ts.map(p=>({...p} as TokenPosition)));
  const old=next[player][token];
  if(old.kind==='base') next[player][token]={kind:'path',progress:0};
  else if(old.kind==='path' && old.progress+dice<PATH_LENGTH) next[player][token]={kind:'path',progress:old.progress+dice};
  else { const travelled=old.kind==='path' ? old.progress+dice-PATH_LENGTH : old.progress+dice; next[player][token]={kind:'home',progress:travelled}; }
  let captured=false;
  const landed=next[player][token];
  if(landed.kind==='path' && !SAFE_CELLS.has(absoluteCell(player,landed.progress))) {
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
        }
      }
    }
  }
  const winner=next[player].length===4 && next[player].every(p=>p.kind==='home'&&p.progress===HOME_LENGTH);
  const activeSeats = state.players && state.players.length > 0 ? state.players.map((p) => p.seat) : ([0, 1, 2, 3] as PlayerIndex[]);
  const nextPlayer=winner?player:(dice===6?player:getNextPlayer(player, activeSeats));
  return {state:{...state,tokens:next,currentPlayer:nextPlayer,dice:null,consecutiveSixes:nextPlayer===player?state.consecutiveSixes:0,status:winner?'finished':'playing',winner:winner?player:null,version:state.version+1},captured,winner};
}
export function roll(state:GameState, player:PlayerIndex, value:number):GameState {
  if(state.status!=='playing'||state.currentPlayer!==player||state.dice!==null) throw new Error('cannot roll now');
  if(!Number.isInteger(value)||value<1||value>6) throw new Error('invalid dice');
  const sixes=value===6?state.consecutiveSixes+1:0;
  const activeSeats = state.players && state.players.length > 0 ? state.players.map((p) => p.seat) : ([0, 1, 2, 3] as PlayerIndex[]);
  if(sixes>=3) return {...state,currentPlayer:getNextPlayer(player, activeSeats),dice:null,consecutiveSixes:0,version:state.version+1};
  const moves=legalTokens(state,player,value);
  if(moves.length===0) return {...state,currentPlayer:value===6?player:getNextPlayer(player, activeSeats),dice:null,consecutiveSixes:sixes,version:state.version+1};
  return {...state,dice:value,consecutiveSixes:sixes,version:state.version+1};
}
