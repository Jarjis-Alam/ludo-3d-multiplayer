import React, { useMemo } from 'react';
import { AudioEngine } from './AudioEngine';

export type BoardToken = { kind: 'base' | 'path' | 'home'; progress: number };
export type BoardPlayer = { id: string; name: string; color: string; seat: number; connected?: boolean };

export interface Board2DProps {
  players: BoardPlayer[];
  tokens: BoardToken[][];
  currentPlayer: number;
  localSeat: number;
  diceDisplay: number | null;
  legal: number[];
  onTokenClick: (tokenIdx: number) => void;
}

const SEAT_COLORS = ['red', 'green', 'yellow', 'blue'] as const;
const START_OFFSETS = [0, 13, 26, 39];
const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// 52 Track cells coordinates mapped to 15x15 grid: [row, col] (0-indexed)
const TRACK_CELL_MAP: Record<number, [number, number]> = {
  0: [6, 1],   // Red Start
  1: [6, 2],
  2: [6, 3],
  3: [6, 4],
  4: [6, 5],
  5: [5, 6],
  6: [4, 6],
  7: [3, 6],
  8: [2, 6],   // Star
  9: [1, 6],
  10: [0, 6],
  11: [0, 7],
  12: [0, 8],
  13: [1, 8],  // Green Start
  14: [2, 8],
  15: [3, 8],
  16: [4, 8],
  17: [5, 8],
  18: [6, 9],
  19: [6, 10],
  20: [6, 11],
  21: [6, 12], // Star
  22: [6, 13],
  23: [6, 14],
  24: [7, 14],
  25: [8, 14],
  26: [8, 13], // Yellow Start
  27: [8, 12],
  28: [8, 11],
  29: [8, 10],
  30: [8, 9],
  31: [9, 8],
  32: [10, 8],
  33: [11, 8],
  34: [12, 8], // Star
  35: [13, 8],
  36: [14, 8],
  37: [14, 7],
  38: [14, 6],
  39: [13, 6], // Blue Start
  40: [12, 6],
  41: [11, 6],
  42: [10, 6],
  43: [9, 6],
  44: [8, 5],
  45: [8, 4],
  46: [8, 3],
  47: [8, 2],  // Star
  48: [8, 1],
  49: [8, 0],
  50: [7, 0],
  51: [6, 0],
};

// Home lanes: 5 cells each leading into the center goal (progress: 0..4)
// Progress 5 is goal threshold, progress 6 is in-goal
const HOME_LANES_MAP: Record<number, [number, number][]> = {
  0: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],             // Red
  1: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],             // Green
  2: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],         // Yellow
  3: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],         // Blue
};

const COLOR_CLASSES: Record<string, string> = {
  red: 'ruby-red',
  green: 'emerald-green',
  yellow: 'golden-topaz',
  blue: 'sapphire-blue',
};

export const Board2D: React.FC<Board2DProps> = ({
  players,
  tokens,
  currentPlayer,
  localSeat,
  legal,
  onTokenClick,
}) => {
  const activeSeats = useMemo(() => new Set(players.map((p) => p.seat)), [players]);

  // Map tokens to their visual cells:
  // Key: "track-X", "home-SEAT-INDEX", "base-SEAT-TOKEN", "goal-SEAT-TOKEN"
  const tokensOnBoard = useMemo(() => {
    const map: Record<string, Array<{ seat: number; tokenIdx: number; isLegal: boolean }>> = {};

    tokens.forEach((seatTokens, seat) => {
      if (!activeSeats.has(seat)) return;
      seatTokens.forEach((token, tokenIdx) => {
        const isLegal = localSeat === currentPlayer && seat === localSeat && legal.includes(tokenIdx);

        if (token.kind === 'base') {
          const key = `base-${seat}-${tokenIdx}`;
          if (!map[key]) map[key] = [];
          map[key].push({ seat, tokenIdx, isLegal });
        } else if (token.kind === 'home') {
          if (token.progress >= 6) {
            const key = `goal-${seat}`;
            if (!map[key]) map[key] = [];
            map[key].push({ seat, tokenIdx, isLegal });
          } else {
            const step = Math.min(4, Math.max(0, token.progress));
            const key = `home-${seat}-${step}`;
            if (!map[key]) map[key] = [];
            map[key].push({ seat, tokenIdx, isLegal });
          }
        } else {
          // Path
          const absCell = (START_OFFSETS[seat] + token.progress) % 52;
          const key = `track-${absCell}`;
          if (!map[key]) map[key] = [];
          map[key].push({ seat, tokenIdx, isLegal });
        }
      });
    });

    return map;
  }, [tokens, activeSeats, localSeat, currentPlayer, legal]);

  const renderPawn = (seat: number, tokenIdx: number, isLegal: boolean) => {
    const colorKey = SEAT_COLORS[seat] || 'red';
    const colorClass = COLOR_CLASSES[colorKey];

    return (
      <div
        key={`pawn-${seat}-${tokenIdx}`}
        className={`meenakari-pawn ${colorClass} ${isLegal ? 'pawn-legal-glow' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isLegal) {
            AudioEngine.playHop();
            onTokenClick(tokenIdx);
          }
        }}
        title={`Seat ${seat + 1} (${colorKey.toUpperCase()}) - Token ${tokenIdx + 1}${
          isLegal ? ' (Click to Move)' : ''
        }`}
      >
        <div className="meenakari-body">
          <div className="meenakari-rosette">
            <div className="meenakari-core" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ludo-arena-container">
      <div className="ludo-arena-frame">
        <div className="ludo-grid" id="ludoBoard">
          {/* ==================== 1. RED HOME YARD (Cols 1-6, Rows 1-6) ==================== */}
          <div
            className={`col-span-6 row-span-6 bg-gradient-to-br from-[#e63946] to-[#991b1b] p-2 sm:p-2.5 flex items-center justify-center relative border-r-2 border-b-2 border-slate-900 ${
              !activeSeats.has(0) ? 'opacity-40' : ''
            }`}
          >
            <div className="w-full h-full bg-amber-50/95 rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 place-items-center shadow-inner border border-amber-400/60">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-0-${slotIdx}`] || [];
                return (
                  <div
                    key={slotIdx}
                    id={`red-base-slot-${slotIdx}`}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-100/90 border border-amber-500/80 flex items-center justify-center shadow-inner relative"
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal))}
                  </div>
                );
              })}
            </div>
            <span className="absolute top-1 left-2 text-[10px] font-bold text-amber-200 tracking-wider">RED</span>
          </div>

          {/* ==================== 2. TOP VERTICAL TRACK (Cols 7-9, Rows 1-6) ==================== */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 border-b-2 border-slate-900">
            {/* Row 0 */}
            <div className="cell bg-white">{renderCellTokens(10)}</div>
            <div className="cell bg-white">{renderCellTokens(11)}</div>
            <div className="cell bg-white">{renderCellTokens(12)}</div>

            {/* Row 1 */}
            <div className="cell bg-white">
              <span className="star-haven">★</span>
              {renderCellTokens(9)}
            </div>
            <div className="cell bg-[#059669]">{renderHomeTokens(1, 0)}</div>
            <div className="cell bg-[#059669] font-bold text-white text-[9px] relative">
              <span className="exit-arrow">▼</span>
              {renderCellTokens(13)}
            </div>

            {/* Row 2 */}
            <div className="cell bg-white">
              <span className="star-haven">★</span>
              {renderCellTokens(8)}
            </div>
            <div className="cell bg-[#059669]">{renderHomeTokens(1, 1)}</div>
            <div className="cell bg-white">{renderCellTokens(14)}</div>

            {/* Row 3 */}
            <div className="cell bg-white">{renderCellTokens(7)}</div>
            <div className="cell bg-[#059669]">{renderHomeTokens(1, 2)}</div>
            <div className="cell bg-white">{renderCellTokens(15)}</div>

            {/* Row 4 */}
            <div className="cell bg-white">{renderCellTokens(6)}</div>
            <div className="cell bg-[#059669]">{renderHomeTokens(1, 3)}</div>
            <div className="cell bg-white">{renderCellTokens(16)}</div>

            {/* Row 5 */}
            <div className="cell bg-white">{renderCellTokens(5)}</div>
            <div className="cell bg-[#059669]">{renderHomeTokens(1, 4)}</div>
            <div className="cell bg-white">{renderCellTokens(17)}</div>
          </div>

          {/* ==================== 3. GREEN HOME YARD (Cols 10-15, Rows 1-6) ==================== */}
          <div
            className={`col-span-6 row-span-6 bg-gradient-to-bl from-[#059669] to-[#064e3b] p-2 sm:p-2.5 flex items-center justify-center relative border-l-2 border-b-2 border-slate-900 ${
              !activeSeats.has(1) ? 'opacity-40' : ''
            }`}
          >
            <div className="w-full h-full bg-amber-50/95 rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 place-items-center shadow-inner border border-amber-400/60">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-1-${slotIdx}`] || [];
                return (
                  <div
                    key={slotIdx}
                    id={`green-base-slot-${slotIdx}`}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100/90 border border-amber-500/80 flex items-center justify-center shadow-inner relative"
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal))}
                  </div>
                );
              })}
            </div>
            <span className="absolute top-1 right-2 text-[10px] font-bold text-amber-200 tracking-wider">GREEN</span>
          </div>

          {/* ==================== 4. LEFT HORIZONTAL TRACK (Cols 1-6, Rows 7-9) ==================== */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 border-r-2 border-slate-900">
            {/* Row 6 */}
            <div className="cell bg-white">{renderCellTokens(51)}</div>
            <div className="cell bg-[#e63946] font-bold text-white text-[9px] relative">
              <span className="exit-arrow">▶</span>
              {renderCellTokens(0)}
            </div>
            <div className="cell bg-white">{renderCellTokens(1)}</div>
            <div className="cell bg-white">{renderCellTokens(2)}</div>
            <div className="cell bg-white">{renderCellTokens(3)}</div>
            <div className="cell bg-white">{renderCellTokens(4)}</div>

            {/* Row 7 */}
            <div className="cell bg-white">{renderCellTokens(50)}</div>
            <div className="cell bg-[#e63946]">{renderHomeTokens(0, 0)}</div>
            <div className="cell bg-[#e63946]">{renderHomeTokens(0, 1)}</div>
            <div className="cell bg-[#e63946]">{renderHomeTokens(0, 2)}</div>
            <div className="cell bg-[#e63946]">{renderHomeTokens(0, 3)}</div>
            <div className="cell bg-[#e63946]">{renderHomeTokens(0, 4)}</div>

            {/* Row 8 */}
            <div className="cell bg-white">{renderCellTokens(49)}</div>
            <div className="cell bg-white">{renderCellTokens(48)}</div>
            <div className="cell bg-white">
              <span className="star-haven">★</span>
              {renderCellTokens(47)}
            </div>
            <div className="cell bg-white">{renderCellTokens(46)}</div>
            <div className="cell bg-white">{renderCellTokens(45)}</div>
            <div className="cell bg-white">{renderCellTokens(44)}</div>
          </div>

          {/* ==================== 5. CENTER TRIANGLE VICTORY GOAL (Cols 7-9, Rows 7-9) ==================== */}
          <div className="col-span-3 row-span-3 relative overflow-hidden bg-slate-950 border border-slate-900">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Red Triangle (Left) */}
              <polygon fill="#e63946" points="0,0 50,50 0,100" stroke="#d4af37" strokeWidth="1.2" />
              {/* Green Triangle (Top) */}
              <polygon fill="#059669" points="0,0 50,50 100,0" stroke="#d4af37" strokeWidth="1.2" />
              {/* Yellow Triangle (Right) */}
              <polygon fill="#d97706" points="100,0 50,50 100,100" stroke="#d4af37" strokeWidth="1.2" />
              {/* Blue Triangle (Bottom) */}
              <polygon fill="#2563eb" points="0,100 50,50 100,100" stroke="#d4af37" strokeWidth="1.2" />
            </svg>

            {/* Finished tokens resting in respective quadrant triangles */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Red goal tokens */}
              <div className="absolute left-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                {(tokensOnBoard['goal-0'] || []).map((t) => (
                  <span key={t.tokenIdx} className="text-[10px] text-amber-300">♔</span>
                ))}
              </div>
              {/* Green goal tokens */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                {(tokensOnBoard['goal-1'] || []).map((t) => (
                  <span key={t.tokenIdx} className="text-[10px] text-amber-300">♔</span>
                ))}
              </div>
              {/* Yellow goal tokens */}
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                {(tokensOnBoard['goal-2'] || []).map((t) => (
                  <span key={t.tokenIdx} className="text-[10px] text-amber-300">♔</span>
                ))}
              </div>
              {/* Blue goal tokens */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                {(tokensOnBoard['goal-3'] || []).map((t) => (
                  <span key={t.tokenIdx} className="text-[10px] text-amber-300">♔</span>
                ))}
              </div>
            </div>

            {/* Center imperial crown medal */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 border border-amber-600 shadow-md flex items-center justify-center">
                <span className="text-[9px] text-amber-950 font-bold leading-none">♚</span>
              </div>
            </div>
          </div>

          {/* ==================== 6. RIGHT HORIZONTAL TRACK (Cols 10-15, Rows 7-9) ==================== */}
          <div className="col-span-6 row-span-3 grid grid-cols-6 grid-rows-3 border-l-2 border-slate-900">
            {/* Row 6 */}
            <div className="cell bg-white">{renderCellTokens(18)}</div>
            <div className="cell bg-white">{renderCellTokens(19)}</div>
            <div className="cell bg-white">{renderCellTokens(20)}</div>
            <div className="cell bg-white">
              <span className="star-haven">★</span>
              {renderCellTokens(21)}
            </div>
            <div className="cell bg-white">{renderCellTokens(22)}</div>
            <div className="cell bg-white">{renderCellTokens(23)}</div>

            {/* Row 7 */}
            <div className="cell bg-[#d97706]">{renderHomeTokens(2, 4)}</div>
            <div className="cell bg-[#d97706]">{renderHomeTokens(2, 3)}</div>
            <div className="cell bg-[#d97706]">{renderHomeTokens(2, 2)}</div>
            <div className="cell bg-[#d97706]">{renderHomeTokens(2, 1)}</div>
            <div className="cell bg-[#d97706]">{renderHomeTokens(2, 0)}</div>
            <div className="cell bg-white">{renderCellTokens(24)}</div>

            {/* Row 8 */}
            <div className="cell bg-white">{renderCellTokens(30)}</div>
            <div className="cell bg-white">{renderCellTokens(29)}</div>
            <div className="cell bg-white">{renderCellTokens(28)}</div>
            <div className="cell bg-white">{renderCellTokens(27)}</div>
            <div className="cell bg-[#d97706] font-bold text-white text-[9px] relative">
              <span className="exit-arrow">◀</span>
              {renderCellTokens(26)}
            </div>
            <div className="cell bg-white">{renderCellTokens(25)}</div>
          </div>

          {/* ==================== 7. BLUE HOME YARD (Cols 1-6, Rows 10-15) ==================== */}
          <div
            className={`col-span-6 row-span-6 bg-gradient-to-tr from-[#1e40af] to-[#2563eb] p-2 sm:p-2.5 flex items-center justify-center relative border-r-2 border-t-2 border-slate-900 ${
              !activeSeats.has(3) ? 'opacity-40' : ''
            }`}
          >
            <div className="w-full h-full bg-amber-50/95 rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 place-items-center shadow-inner border border-amber-400/60">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-3-${slotIdx}`] || [];
                return (
                  <div
                    key={slotIdx}
                    id={`blue-base-slot-${slotIdx}`}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100/90 border border-amber-500/80 flex items-center justify-center shadow-inner relative"
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal))}
                  </div>
                );
              })}
            </div>
            <span className="absolute bottom-1 left-2 text-[10px] font-bold text-amber-200 tracking-wider">BLUE</span>
          </div>

          {/* ==================== 8. BOTTOM VERTICAL TRACK (Cols 7-9, Rows 10-15) ==================== */}
          <div className="col-span-3 row-span-6 grid grid-cols-3 grid-rows-6 border-t-2 border-slate-900">
            {/* Row 9 */}
            <div className="cell bg-white">{renderCellTokens(43)}</div>
            <div className="cell bg-[#2563eb]">{renderHomeTokens(3, 4)}</div>
            <div className="cell bg-white">{renderCellTokens(31)}</div>

            {/* Row 10 */}
            <div className="cell bg-white">{renderCellTokens(42)}</div>
            <div className="cell bg-[#2563eb]">{renderHomeTokens(3, 3)}</div>
            <div className="cell bg-white">{renderCellTokens(32)}</div>

            {/* Row 11 */}
            <div className="cell bg-white">{renderCellTokens(41)}</div>
            <div className="cell bg-[#2563eb]">{renderHomeTokens(3, 2)}</div>
            <div className="cell bg-white">{renderCellTokens(33)}</div>

            {/* Row 12 */}
            <div className="cell bg-white">{renderCellTokens(40)}</div>
            <div className="cell bg-[#2563eb]">{renderHomeTokens(3, 1)}</div>
            <div className="cell bg-white">
              <span className="star-haven">★</span>
              {renderCellTokens(34)}
            </div>

            {/* Row 13 */}
            <div className="cell bg-[#2563eb] font-bold text-white text-[9px] relative">
              <span className="exit-arrow">▲</span>
              {renderCellTokens(39)}
            </div>
            <div className="cell bg-[#2563eb]">{renderHomeTokens(3, 0)}</div>
            <div className="cell bg-white">
              <span className="star-haven">★</span>
              {renderCellTokens(35)}
            </div>

            {/* Row 14 */}
            <div className="cell bg-white">{renderCellTokens(38)}</div>
            <div className="cell bg-white">{renderCellTokens(37)}</div>
            <div className="cell bg-white">{renderCellTokens(36)}</div>
          </div>

          {/* ==================== 9. YELLOW HOME YARD (Cols 10-15, Rows 10-15) ==================== */}
          <div
            className={`col-span-6 row-span-6 bg-gradient-to-tl from-[#b45309] to-[#f59e0b] p-2 sm:p-2.5 flex items-center justify-center relative border-l-2 border-t-2 border-slate-900 ${
              !activeSeats.has(2) ? 'opacity-40' : ''
            }`}
          >
            <div className="w-full h-full bg-amber-50/95 rounded-xl p-2 grid grid-cols-2 grid-rows-2 gap-2 place-items-center shadow-inner border border-amber-400/60">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-2-${slotIdx}`] || [];
                return (
                  <div
                    key={slotIdx}
                    id={`yellow-base-slot-${slotIdx}`}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100/90 border border-amber-500/80 flex items-center justify-center shadow-inner relative"
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal))}
                  </div>
                );
              })}
            </div>
            <span className="absolute bottom-1 right-2 text-[10px] font-bold text-amber-200 tracking-wider">YELLOW</span>
          </div>
        </div>
      </div>
    </div>
  );

  function renderCellTokens(trackIndex: number) {
    const occupants = tokensOnBoard[`track-${trackIndex}`] || [];
    if (occupants.length === 0) return null;
    return (
      <div className="tokens-cluster">
        {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal))}
        {occupants.length > 1 && <span className="cluster-badge">×{occupants.length}</span>}
      </div>
    );
  }

  function renderHomeTokens(seat: number, stepIndex: number) {
    const occupants = tokensOnBoard[`home-${seat}-${stepIndex}`] || [];
    if (occupants.length === 0) return null;
    return (
      <div className="tokens-cluster">
        {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal))}
        {occupants.length > 1 && <span className="cluster-badge">×{occupants.length}</span>}
      </div>
    );
  }
};
