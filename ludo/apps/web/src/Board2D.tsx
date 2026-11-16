import React, { useMemo } from 'react';
import { AudioEngine } from './AudioEngine';
import { PawnToken, PawnDefs } from './PawnToken';

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

export const StarMedal: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className="star-haven-svg"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" fill="rgba(212, 175, 55, 0.18)" stroke="#d4af37" strokeWidth="0.8" />
    <polygon
      points="12,3 14.5,8.8 21,9.4 16,13.8 17.5,20.2 12,16.8 6.5,20.2 8,13.8 3,9.4 9.5,8.8"
      fill="url(#starGoldGrad)"
      stroke="#996515"
      strokeWidth="0.6"
    />
  </svg>
);

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
  // Key: "track-X", "home-SEAT-INDEX", "base-SEAT-TOKEN", "goal-SEAT"
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

  const renderPawn = (seat: number, tokenIdx: number, isLegal: boolean, size = 32) => {
    const colorKey = SEAT_COLORS[seat] || 'red';

    return (
      <PawnToken
        key={`pawn-${seat}-${tokenIdx}`}
        color={colorKey}
        isLegal={isLegal}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          if (isLegal) {
            AudioEngine.playHop();
            onTokenClick(tokenIdx);
          }
        }}
        title={`Seat ${seat + 1} (${colorKey.toUpperCase()}) - Pawn ${tokenIdx + 1}${
          isLegal ? ' (Click to Move)' : ''
        }`}
      />
    );
  };

  function renderCellTokens(trackIndex: number) {
    const occupants = tokensOnBoard[`track-${trackIndex}`] || [];
    if (occupants.length === 0) return null;
    const isClustered = occupants.length > 1;
    const pawnSize = isClustered ? 22 : 32;

    return (
      <div className={`tokens-cluster ${isClustered ? 'has-cluster' : ''}`}>
        {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSize))}
        {isClustered && <span className="cluster-badge">×{occupants.length}</span>}
      </div>
    );
  }

  function renderHomeTokens(seat: number, stepIndex: number) {
    const occupants = tokensOnBoard[`home-${seat}-${stepIndex}`] || [];
    if (occupants.length === 0) return null;
    const isClustered = occupants.length > 1;
    const pawnSize = isClustered ? 22 : 32;

    return (
      <div className={`tokens-cluster ${isClustered ? 'has-cluster' : ''}`}>
        {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSize))}
        {isClustered && <span className="cluster-badge">×{occupants.length}</span>}
      </div>
    );
  }

  function renderGoalTokens(seat: number) {
    const occupants = tokensOnBoard[`goal-${seat}`] || [];
    if (occupants.length === 0) return null;
    return (
      <div className="goal-occupants-cluster">
        {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 18))}
      </div>
    );
  }

  return (
    <div className="ludo-arena-container">
      <PawnDefs />
      <div className="ludo-arena-frame">
        <div className="ludo-grid" id="ludoBoard">
          {/* ==================== 1. RED HOME YARD (Cols 1-6, Rows 1-6) ==================== */}
          <div className={`yard-box yard-red ${!activeSeats.has(0) ? 'inactive-seat' : ''}`}>
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-0-${slotIdx}`] || [];
                return (
                  <div key={slotIdx} className="base-socket base-socket-red">
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 34))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-tl">
              {activeSeats.has(0) ? 'RED' : 'VACANT'}
            </span>
          </div>

          {/* ==================== 2. TOP VERTICAL TRACK (Cols 7-9, Rows 1-6) ==================== */}
          <div className="track-arm track-top">
            {/* Row 0 */}
            <div className="cell cell-white">{renderCellTokens(10)}</div>
            <div className="cell cell-white">{renderCellTokens(11)}</div>
            <div className="cell cell-white">{renderCellTokens(12)}</div>

            {/* Row 1 */}
            <div className="cell cell-white">{renderCellTokens(9)}</div>
            <div className="cell cell-green">{renderHomeTokens(1, 0)}</div>
            <div className="cell cell-green start-cell">
              <span className="exit-arrow">▼</span>
              {renderCellTokens(13)}
            </div>

            {/* Row 2 */}
            <div className="cell cell-white cell-safe">
              <StarMedal />
              {renderCellTokens(8)}
            </div>
            <div className="cell cell-green">{renderHomeTokens(1, 1)}</div>
            <div className="cell cell-white">{renderCellTokens(14)}</div>

            {/* Row 3 */}
            <div className="cell cell-white">{renderCellTokens(7)}</div>
            <div className="cell cell-green">{renderHomeTokens(1, 2)}</div>
            <div className="cell cell-white">{renderCellTokens(15)}</div>

            {/* Row 4 */}
            <div className="cell cell-white">{renderCellTokens(6)}</div>
            <div className="cell cell-green">{renderHomeTokens(1, 3)}</div>
            <div className="cell cell-white">{renderCellTokens(16)}</div>

            {/* Row 5 */}
            <div className="cell cell-white">{renderCellTokens(5)}</div>
            <div className="cell cell-green">{renderHomeTokens(1, 4)}</div>
            <div className="cell cell-white">{renderCellTokens(17)}</div>
          </div>

          {/* ==================== 3. GREEN HOME YARD (Cols 10-15, Rows 1-6) ==================== */}
          <div className={`yard-box yard-green ${!activeSeats.has(1) ? 'inactive-seat' : ''}`}>
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-1-${slotIdx}`] || [];
                return (
                  <div key={slotIdx} className="base-socket base-socket-green">
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 34))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-tr">
              {activeSeats.has(1) ? 'GREEN' : 'VACANT'}
            </span>
          </div>

          {/* ==================== 4. LEFT HORIZONTAL TRACK (Cols 1-6, Rows 7-9) ==================== */}
          <div className="track-arm track-left">
            {/* Row 6 */}
            <div className="cell cell-white">{renderCellTokens(51)}</div>
            <div className="cell cell-red start-cell">
              <span className="exit-arrow">▶</span>
              {renderCellTokens(0)}
            </div>
            <div className="cell cell-white">{renderCellTokens(1)}</div>
            <div className="cell cell-white">{renderCellTokens(2)}</div>
            <div className="cell cell-white">{renderCellTokens(3)}</div>
            <div className="cell cell-white">{renderCellTokens(4)}</div>

            {/* Row 7 */}
            <div className="cell cell-white">{renderCellTokens(50)}</div>
            <div className="cell cell-red">{renderHomeTokens(0, 0)}</div>
            <div className="cell cell-red">{renderHomeTokens(0, 1)}</div>
            <div className="cell cell-red">{renderHomeTokens(0, 2)}</div>
            <div className="cell cell-red">{renderHomeTokens(0, 3)}</div>
            <div className="cell cell-red">{renderHomeTokens(0, 4)}</div>

            {/* Row 8 */}
            <div className="cell cell-white">{renderCellTokens(49)}</div>
            <div className="cell cell-white">{renderCellTokens(48)}</div>
            <div className="cell cell-white cell-safe">
              <StarMedal />
              {renderCellTokens(47)}
            </div>
            <div className="cell cell-white">{renderCellTokens(46)}</div>
            <div className="cell cell-white">{renderCellTokens(45)}</div>
            <div className="cell cell-white">{renderCellTokens(44)}</div>
          </div>

          {/* ==================== 5. CENTER TRIANGLE VICTORY GOAL (Cols 7-9, Rows 7-9) ==================== */}
          <div className="goal-center">
            <svg className="goal-svg" viewBox="0 0 100 100">
              <polygon fill="#e63946" points="0,0 50,50 0,100" stroke="#d4af37" strokeWidth="1.2" />
              <polygon fill="#059669" points="0,0 50,50 100,0" stroke="#d4af37" strokeWidth="1.2" />
              <polygon fill="#f59e0b" points="100,0 50,50 100,100" stroke="#d4af37" strokeWidth="1.2" />
              <polygon fill="#2563eb" points="0,100 50,50 100,100" stroke="#d4af37" strokeWidth="1.2" />
            </svg>

            {/* Finished tokens inside respective goal triangles */}
            <div className="goal-quadrant goal-quadrant-red">{renderGoalTokens(0)}</div>
            <div className="goal-quadrant goal-quadrant-green">{renderGoalTokens(1)}</div>
            <div className="goal-quadrant goal-quadrant-yellow">{renderGoalTokens(2)}</div>
            <div className="goal-quadrant goal-quadrant-blue">{renderGoalTokens(3)}</div>

            {/* Center crown rosette medallion */}
            <div className="goal-crown-rosette">
              <div className="goal-crown-icon" title="Victory Home">♚</div>
            </div>
          </div>

          {/* ==================== 6. RIGHT HORIZONTAL TRACK (Cols 10-15, Rows 7-9) ==================== */}
          <div className="track-arm track-right">
            {/* Row 6 */}
            <div className="cell cell-white">{renderCellTokens(18)}</div>
            <div className="cell cell-white">{renderCellTokens(19)}</div>
            <div className="cell cell-white">{renderCellTokens(20)}</div>
            <div className="cell cell-white cell-safe">
              <StarMedal />
              {renderCellTokens(21)}
            </div>
            <div className="cell cell-white">{renderCellTokens(22)}</div>
            <div className="cell cell-white">{renderCellTokens(23)}</div>

            {/* Row 7 */}
            <div className="cell cell-yellow">{renderHomeTokens(2, 4)}</div>
            <div className="cell cell-yellow">{renderHomeTokens(2, 3)}</div>
            <div className="cell cell-yellow">{renderHomeTokens(2, 2)}</div>
            <div className="cell cell-yellow">{renderHomeTokens(2, 1)}</div>
            <div className="cell cell-yellow">{renderHomeTokens(2, 0)}</div>
            <div className="cell cell-white">{renderCellTokens(24)}</div>

            {/* Row 8 */}
            <div className="cell cell-white">{renderCellTokens(30)}</div>
            <div className="cell cell-white">{renderCellTokens(29)}</div>
            <div className="cell cell-white">{renderCellTokens(28)}</div>
            <div className="cell cell-white">{renderCellTokens(27)}</div>
            <div className="cell cell-yellow start-cell">
              <span className="exit-arrow">◀</span>
              {renderCellTokens(26)}
            </div>
            <div className="cell cell-white">{renderCellTokens(25)}</div>
          </div>

          {/* ==================== 7. BLUE HOME YARD (Cols 1-6, Rows 10-15) ==================== */}
          <div className={`yard-box yard-blue ${!activeSeats.has(3) ? 'inactive-seat' : ''}`}>
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-3-${slotIdx}`] || [];
                return (
                  <div key={slotIdx} className="base-socket base-socket-blue">
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 34))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-bl">
              {activeSeats.has(3) ? 'BLUE' : 'VACANT'}
            </span>
          </div>

          {/* ==================== 8. BOTTOM VERTICAL TRACK (Cols 7-9, Rows 10-15) ==================== */}
          <div className="track-arm track-bottom">
            {/* Row 9 */}
            <div className="cell cell-white">{renderCellTokens(43)}</div>
            <div className="cell cell-blue">{renderHomeTokens(3, 4)}</div>
            <div className="cell cell-white">{renderCellTokens(31)}</div>

            {/* Row 10 */}
            <div className="cell cell-white">{renderCellTokens(42)}</div>
            <div className="cell cell-blue">{renderHomeTokens(3, 3)}</div>
            <div className="cell cell-white">{renderCellTokens(32)}</div>

            {/* Row 11 */}
            <div className="cell cell-white">{renderCellTokens(41)}</div>
            <div className="cell cell-blue">{renderHomeTokens(3, 2)}</div>
            <div className="cell cell-white">{renderCellTokens(33)}</div>

            {/* Row 12 */}
            <div className="cell cell-white">{renderCellTokens(40)}</div>
            <div className="cell cell-blue">{renderHomeTokens(3, 1)}</div>
            <div className="cell cell-white cell-safe">
              <StarMedal />
              {renderCellTokens(34)}
            </div>

            {/* Row 13 */}
            <div className="cell cell-blue start-cell">
              <span className="exit-arrow">▲</span>
              {renderCellTokens(39)}
            </div>
            <div className="cell cell-blue">{renderHomeTokens(3, 0)}</div>
            <div className="cell cell-white">{renderCellTokens(35)}</div>

            {/* Row 14 */}
            <div className="cell cell-white">{renderCellTokens(38)}</div>
            <div className="cell cell-white">{renderCellTokens(37)}</div>
            <div className="cell cell-white">{renderCellTokens(36)}</div>
          </div>

          {/* ==================== 9. YELLOW HOME YARD (Cols 10-15, Rows 10-15) ==================== */}
          <div className={`yard-box yard-yellow ${!activeSeats.has(2) ? 'inactive-seat' : ''}`}>
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-2-${slotIdx}`] || [];
                return (
                  <div key={slotIdx} className="base-socket base-socket-yellow">
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 34))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-br">
              {activeSeats.has(2) ? 'YELLOW' : 'VACANT'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
