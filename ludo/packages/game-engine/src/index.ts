export type PlayerIndex = 0|1|2|3;
export type TokenPosition = { kind:'base' } | { kind:'path'; progress:number } | { kind:'home'; progress:number };
export type Player = { id:string; name:string; color:string; seat:PlayerIndex };
export type GameState = { players:Player[]; tokens:TokenPosition[][]; currentPlayer:PlayerIndex; dice:number|null; consecutiveSixes:number; status:'lobby'|'playing'|'finished'; winner:PlayerIndex|null; version:number };
export const COLORS = ['red','green','yellow','blue'] as const;
export const PATH_LENGTH = 52;
export const HOME_LENGTH = 6;
export const START_OFFSETS = [0,13,26,39] as const;
export const SAFE_CELLS = new Set([0,8,13,21,26,34,39,47]);

export function initialState(players:Player[], initialVersion = 0):GameState {
  return {players,tokens:players.map(()=>Array.from({length:4},()=>({kind:'base'} as TokenPosition))),currentPlayer:0,dice:null,consecutiveSixes:0,status:'lobby',winner:null,version:initialVersion};
}
export function startGame(state:GameState):GameState { return {...state,status:'playing',currentPlayer:0,dice:null,consecutiveSixes:0,winner:null,version:state.version+1}; }
export function absoluteCell(player:PlayerIndex, progress:number):number { return (START_OFFSETS[player] + progress) % PATH_LENGTH; }
export function canLeaveBase(dice:number):boolean { return dice===6; }
export function stepsToFinish(pos:TokenPosition):number { if(pos.kind==='base') return Infinity; if(pos.kind==='path') return PATH_LENGTH - pos.progress + HOME_LENGTH; return HOME_LENGTH - pos.progress; }
export function isLegalMove(pos:TokenPosition,dice:number):boolean { return dice>=1 && dice<=6 && (pos.kind==='base' ? canLeaveBase(dice) : dice<=stepsToFinish(pos)); }
export function legalTokens(state:GameState, player:PlayerIndex, dice:number):number[] { return state.tokens[player].map((p,i)=>isLegalMove(p,dice)?i:-1).filter(i=>i>=0); }
export function moveToken(state:GameState, player:PlayerIndex, token:number, dice:number):{state:GameState,captured:boolean,winner:boolean} {
  if(state.status!=='playing' || state.currentPlayer!==player) throw new Error('not your turn');
  if(!Number.isInteger(token)||token<0||token>3||!isLegalMove(state.tokens[player][token],dice)) throw new Error('illegal token move');
  const next=state.tokens.map(ts=>ts.map(p=>({...p} as TokenPosition)));
  const old=next[player][token];
  if(old.kind==='base') next[player][token]={kind:'path',progress:0};
  else if(old.kind==='path' && old.progress+dice<PATH_LENGTH) next[player][token]={kind:'path',progress:old.progress+dice};
  else { const travelled=old.kind==='path' ? old.progress+dice-PATH_LENGTH : old.progress+dice; next[player][token]={kind:'home',progress:travelled}; }
  let captured=false;
  const landed=next[player][token];
  if(landed.kind==='path' && !SAFE_CELLS.has(absoluteCell(player,landed.progress))) {
    for(let other=0;other<4;other++) if(other!==player) for(let i=0;i<4;i++) { const opponent=other as PlayerIndex; const p=next[opponent][i]; if(p.kind==='path' && absoluteCell(opponent,p.progress)===absoluteCell(player,landed.progress)){next[opponent][i]={kind:'base'};captured=true;} }
  }
  const winner=next[player].every(p=>p.kind==='home'&&p.progress===HOME_LENGTH);
  const nextPlayer=winner?player:(dice===6?player:((player+1)%4) as PlayerIndex);
  return {state:{...state,tokens:next,currentPlayer:nextPlayer,dice:null,consecutiveSixes:nextPlayer===player?state.consecutiveSixes:0,status:winner?'finished':'playing',winner:winner?player:null,version:state.version+1},captured,winner};
}
export function roll(state:GameState, player:PlayerIndex, value:number):GameState {
  if(state.status!=='playing'||state.currentPlayer!==player||state.dice!==null) throw new Error('cannot roll now');
  if(!Number.isInteger(value)||value<1||value>6) throw new Error('invalid dice');
  const sixes=value===6?state.consecutiveSixes+1:0;
  if(sixes>=3) return {...state,currentPlayer:((player+1)%4) as PlayerIndex,dice:null,consecutiveSixes:0,version:state.version+1};
  const moves=legalTokens(state,player,value);
  if(moves.length===0) return {...state,currentPlayer:value===6?player:((player+1)%4) as PlayerIndex,dice:null,consecutiveSixes:sixes,version:state.version+1};
  return {...state,dice:value,consecutiveSixes:sixes,version:state.version+1};
}
