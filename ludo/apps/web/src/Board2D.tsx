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

export const StarMedal: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    className="star-haven-svg"
    aria-hidden="true"
  >
    {/* Outer gilded safety disc */}
    <circle
      cx="16"
      cy="16"
      r="14"
      fill="rgba(254, 243, 199, 0.75)"
      stroke="#d4af37"
      strokeWidth="1.2"
      strokeDasharray="2.5 1.5"
    />
    <circle
      cx="16"
      cy="16"
      r="11.5"
      fill="rgba(253, 230, 138, 0.45)"
      stroke="#f59e0b"
      strokeWidth="0.8"
    />
    {/* Embossed 8-pointed golden star */}
    <polygon
      points="16,3.5 18.8,11.2 26.5,11.2 20.2,15.8 22.8,23.5 16,18.8 9.2,23.5 11.8,15.8 5.5,11.2 13.2,11.2"
      fill="url(#starGoldGrad)"
      stroke="#b45309"
      strokeWidth="0.8"
      filter="drop-shadow(0 1.5px 2px rgba(0,0,0,0.3))"
    />
    {/* Central specular highlight */}
    <circle cx="16" cy="15.2" r="2.4" fill="#ffffff" opacity="0.85" />
  </svg>
);

export const StartChevron: React.FC<{ direction: 'right' | 'down' | 'left' | 'up' }> = ({ direction }) => {
  const arrows = {
    right: '▶',
    down: '▼',
    left: '◀',
    up: '▲',
  };
  return (
    <div className={`start-chevron-badge start-chevron-${direction}`} aria-hidden="true">
      <span className="start-chevron-symbol">{arrows[direction]}</span>
    </div>
  );
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

  const renderPawn = (seat: number, tokenIdx: number, isLegal: boolean, size = 36) => {
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
    // Single pawn on track fills cell prominently (size 36); clustered fills 26
    const pawnSize = isClustered ? 26 : 36;

    return (
      <div className={`tokens-cluster ${isClustered ? 'has-cluster' : ''}`}>
        {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSize))}
        {isClustered && <span className="cluster-badge">×{occupants.length}</span>}
      </div>
    );
  }

  function renderHomeTokens(seat: number, stepIndex: number) {
    const occupants = tokensOnBoard[`home-${seat}-${stepIndex}`] || [];
    const isClustered = occupants.length > 1;
    const pawnSize = isClustered ? 26 : 36;

    return (
      <div className={`tokens-cluster ${isClustered ? 'has-cluster' : ''}`}>
        <span className="home-lane-arrow">
          {seat === 0 ? '▶' : seat === 1 ? '▼' : seat === 2 ? '◀' : '▲'}
        </span>
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
        {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 26))}
      </div>
    );
  }

  return (
    <div className="ludo-arena-container">
      <PawnDefs />
      <div className="ludo-arena-frame">
        <div className="ludo-grid" id="ludoBoard">
          {/* ==================== 1. RED HOME YARD (Cols 1-6, Rows 1-6) ==================== */}
          <div
            className={`yard-box yard-red ${!activeSeats.has(0) ? 'inactive-seat' : ''} ${
              currentPlayer === 0 ? 'active-yard-turn' : ''
            }`}
          >
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-0-${slotIdx}`] || [];
                const hasLegalMove = occupants.some((occ) => occ.isLegal);
                return (
                  <div
                    key={slotIdx}
                    className={`base-socket base-socket-red ${hasLegalMove ? 'socket-can-deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 44))}
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
            <div className="cell cell-track">{renderCellTokens(10)}</div>
            <div className="cell cell-track">{renderCellTokens(11)}</div>
            <div className="cell cell-track">{renderCellTokens(12)}</div>

            {/* Row 1 */}
            <div className="cell cell-track">{renderCellTokens(9)}</div>
            <div className="cell cell-green-lane">{renderHomeTokens(1, 0)}</div>
            <div className="cell cell-green-start start-cell">
              <StartChevron direction="down" />
              {renderCellTokens(13)}
            </div>

            {/* Row 2 */}
            <div className="cell cell-track cell-safe">
              <StarMedal />
              {renderCellTokens(8)}
            </div>
            <div className="cell cell-green-lane">{renderHomeTokens(1, 1)}</div>
            <div className="cell cell-track">{renderCellTokens(14)}</div>

            {/* Row 3 */}
            <div className="cell cell-track">{renderCellTokens(7)}</div>
            <div className="cell cell-green-lane">{renderHomeTokens(1, 2)}</div>
            <div className="cell cell-track">{renderCellTokens(15)}</div>

            {/* Row 4 */}
            <div className="cell cell-track">{renderCellTokens(6)}</div>
            <div className="cell cell-green-lane">{renderHomeTokens(1, 3)}</div>
            <div className="cell cell-track">{renderCellTokens(16)}</div>

            {/* Row 5 */}
            <div className="cell cell-track">{renderCellTokens(5)}</div>
            <div className="cell cell-green-lane">{renderHomeTokens(1, 4)}</div>
            <div className="cell cell-track">{renderCellTokens(17)}</div>
          </div>

          {/* ==================== 3. GREEN HOME YARD (Cols 10-15, Rows 1-6) ==================== */}
          <div
            className={`yard-box yard-green ${!activeSeats.has(1) ? 'inactive-seat' : ''} ${
              currentPlayer === 1 ? 'active-yard-turn' : ''
            }`}
          >
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-1-${slotIdx}`] || [];
                const hasLegalMove = occupants.some((occ) => occ.isLegal);
                return (
                  <div
                    key={slotIdx}
                    className={`base-socket base-socket-green ${hasLegalMove ? 'socket-can-deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 44))}
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
            <div className="cell cell-track">{renderCellTokens(51)}</div>
            <div className="cell cell-red-start start-cell">
              <StartChevron direction="right" />
              {renderCellTokens(0)}
            </div>
            <div className="cell cell-track">{renderCellTokens(1)}</div>
            <div className="cell cell-track">{renderCellTokens(2)}</div>
            <div className="cell cell-track">{renderCellTokens(3)}</div>
            <div className="cell cell-track">{renderCellTokens(4)}</div>

            {/* Row 7 */}
            <div className="cell cell-track">{renderCellTokens(50)}</div>
            <div className="cell cell-red-lane">{renderHomeTokens(0, 0)}</div>
            <div className="cell cell-red-lane">{renderHomeTokens(0, 1)}</div>
            <div className="cell cell-red-lane">{renderHomeTokens(0, 2)}</div>
            <div className="cell cell-red-lane">{renderHomeTokens(0, 3)}</div>
            <div className="cell cell-red-lane">{renderHomeTokens(0, 4)}</div>

            {/* Row 8 */}
            <div className="cell cell-track">{renderCellTokens(49)}</div>
            <div className="cell cell-track">{renderCellTokens(48)}</div>
            <div className="cell cell-track cell-safe">
              <StarMedal />
              {renderCellTokens(47)}
            </div>
            <div className="cell cell-track">{renderCellTokens(46)}</div>
            <div className="cell cell-track">{renderCellTokens(45)}</div>
            <div className="cell cell-track">{renderCellTokens(44)}</div>
          </div>

          {/* ==================== 5. CENTER TRIANGLE VICTORY GOAL (Cols 7-9, Rows 7-9) ==================== */}
          <div className="goal-center">
            <svg className="goal-svg" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="goalGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff4d6d" />
                  <stop offset="60%" stopColor="#d90429" />
                  <stop offset="100%" stopColor="#800f2f" />
                </linearGradient>
                <linearGradient id="goalGradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#52b788" />
                  <stop offset="60%" stopColor="#008a48" />
                  <stop offset="100%" stopColor="#004b23" />
                </linearGradient>
                <linearGradient id="goalGradYellow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd166" />
                  <stop offset="60%" stopColor="#fb8500" />
                  <stop offset="100%" stopColor="#9e4700" />
                </linearGradient>
                <linearGradient id="goalGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#48cae4" />
                  <stop offset="60%" stopColor="#0077b6" />
                  <stop offset="100%" stopColor="#023e8a" />
                </linearGradient>
              </defs>

              {/* 4 Colored Enamel Triangles */}
              <polygon fill="url(#goalGradRed)" points="0,0 50,50 0,100" stroke="#d4af37" strokeWidth="1.5" />
              <polygon fill="url(#goalGradGreen)" points="0,0 50,50 100,0" stroke="#d4af37" strokeWidth="1.5" />
              <polygon fill="url(#goalGradYellow)" points="100,0 50,50 100,100" stroke="#d4af37" strokeWidth="1.5" />
              <polygon fill="url(#goalGradBlue)" points="0,100 50,50 100,100" stroke="#d4af37" strokeWidth="1.5" />
            </svg>

            {/* Finished tokens inside respective goal triangles */}
            <div className="goal-quadrant goal-quadrant-red">{renderGoalTokens(0)}</div>
            <div className="goal-quadrant goal-quadrant-green">{renderGoalTokens(1)}</div>
            <div className="goal-quadrant goal-quadrant-yellow">{renderGoalTokens(2)}</div>
            <div className="goal-quadrant goal-quadrant-blue">{renderGoalTokens(3)}</div>

            {/* Center imperial victory rosette */}
            <div className="goal-crown-rosette">
              <div className="goal-crown-icon" title="Victory Home">
                <span>♚</span>
              </div>
            </div>
          </div>

          {/* ==================== 6. RIGHT HORIZONTAL TRACK (Cols 10-15, Rows 7-9) ==================== */}
          <div className="track-arm track-right">
            {/* Row 6 */}
            <div className="cell cell-track">{renderCellTokens(18)}</div>
            <div className="cell cell-track">{renderCellTokens(19)}</div>
            <div className="cell cell-track">{renderCellTokens(20)}</div>
            <div className="cell cell-track cell-safe">
              <StarMedal />
              {renderCellTokens(21)}
            </div>
            <div className="cell cell-track">{renderCellTokens(22)}</div>
            <div className="cell cell-track">{renderCellTokens(23)}</div>

            {/* Row 7 */}
            <div className="cell cell-yellow-lane">{renderHomeTokens(2, 4)}</div>
            <div className="cell cell-yellow-lane">{renderHomeTokens(2, 3)}</div>
            <div className="cell cell-yellow-lane">{renderHomeTokens(2, 2)}</div>
            <div className="cell cell-yellow-lane">{renderHomeTokens(2, 1)}</div>
            <div className="cell cell-yellow-lane">{renderHomeTokens(2, 0)}</div>
            <div className="cell cell-track">{renderCellTokens(24)}</div>

            {/* Row 8 */}
            <div className="cell cell-track">{renderCellTokens(30)}</div>
            <div className="cell cell-track">{renderCellTokens(29)}</div>
            <div className="cell cell-track">{renderCellTokens(28)}</div>
            <div className="cell cell-track">{renderCellTokens(27)}</div>
            <div className="cell cell-yellow-start start-cell">
              <StartChevron direction="left" />
              {renderCellTokens(26)}
            </div>
            <div className="cell cell-track">{renderCellTokens(25)}</div>
          </div>

          {/* ==================== 7. BLUE HOME YARD (Cols 1-6, Rows 10-15) ==================== */}
          <div
            className={`yard-box yard-blue ${!activeSeats.has(3) ? 'inactive-seat' : ''} ${
              currentPlayer === 3 ? 'active-yard-turn' : ''
            }`}
          >
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-3-${slotIdx}`] || [];
                const hasLegalMove = occupants.some((occ) => occ.isLegal);
                return (
                  <div
                    key={slotIdx}
                    className={`base-socket base-socket-blue ${hasLegalMove ? 'socket-can-deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 44))}
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
            <div className="cell cell-track">{renderCellTokens(43)}</div>
            <div className="cell cell-blue-lane">{renderHomeTokens(3, 4)}</div>
            <div className="cell cell-track">{renderCellTokens(31)}</div>

            {/* Row 10 */}
            <div className="cell cell-track">{renderCellTokens(42)}</div>
            <div className="cell cell-blue-lane">{renderHomeTokens(3, 3)}</div>
            <div className="cell cell-track">{renderCellTokens(32)}</div>

            {/* Row 11 */}
            <div className="cell cell-track">{renderCellTokens(41)}</div>
            <div className="cell cell-blue-lane">{renderHomeTokens(3, 2)}</div>
            <div className="cell cell-track">{renderCellTokens(33)}</div>

            {/* Row 12 */}
            <div className="cell cell-track">{renderCellTokens(40)}</div>
            <div className="cell cell-blue-lane">{renderHomeTokens(3, 1)}</div>
            <div className="cell cell-track cell-safe">
              <StarMedal />
              {renderCellTokens(34)}
            </div>

            {/* Row 13 */}
            <div className="cell cell-blue-start start-cell">
              <StartChevron direction="up" />
              {renderCellTokens(39)}
            </div>
            <div className="cell cell-blue-lane">{renderHomeTokens(3, 0)}</div>
            <div className="cell cell-track">{renderCellTokens(35)}</div>

            {/* Row 14 */}
            <div className="cell cell-track">{renderCellTokens(38)}</div>
            <div className="cell cell-track">{renderCellTokens(37)}</div>
            <div className="cell cell-track">{renderCellTokens(36)}</div>
          </div>

          {/* ==================== 9. YELLOW HOME YARD (Cols 10-15, Rows 10-15) ==================== */}
          <div
            className={`yard-box yard-yellow ${!activeSeats.has(2) ? 'inactive-seat' : ''} ${
              currentPlayer === 2 ? 'active-yard-turn' : ''
            }`}
          >
            <div className="yard-inner">
              {[0, 1, 2, 3].map((slotIdx) => {
                const occupants = tokensOnBoard[`base-2-${slotIdx}`] || [];
                const hasLegalMove = occupants.some((occ) => occ.isLegal);
                return (
                  <div
                    key={slotIdx}
                    className={`base-socket base-socket-yellow ${hasLegalMove ? 'socket-can-deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 44))}
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
