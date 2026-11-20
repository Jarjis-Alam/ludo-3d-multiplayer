import React, { useEffect, useState } from 'react';
import { Board2D, type BoardPlayer, type BoardToken } from './Board2D';
import { MiniDiceCube } from './DiceRoller';

const SHOWCASE_PLAYERS: BoardPlayer[] = [
  { id: 'sc-0', name: 'Ruby', color: 'red', seat: 0, connected: true },
  { id: 'sc-1', name: 'Emerald', color: 'green', seat: 1, connected: true },
  { id: 'sc-2', name: 'Amber', color: 'yellow', seat: 2, connected: true },
  { id: 'sc-3', name: 'Sapphire', color: 'blue', seat: 3, connected: true },
];

const INITIAL_SHOWCASE_TOKENS: BoardToken[][] = [
  // Red (seat 0): 2 in yard, 1 on outer track at 24, 1 in red home lane at 4
  [
    { kind: 'base', progress: 0 },
    { kind: 'base', progress: 0 },
    { kind: 'path', progress: 24 },
    { kind: 'home', progress: 4 },
  ],
  // Green (seat 1): 2 in yard, 1 at start cell 13, 1 advanced on track at 38
  [
    { kind: 'base', progress: 0 },
    { kind: 'base', progress: 0 },
    { kind: 'path', progress: 13 },
    { kind: 'path', progress: 38 },
  ],
  // Yellow (seat 2): 1 in yard, 1 on path at 14, 1 on path at 42, 1 at center goal 6!
  [
    { kind: 'base', progress: 0 },
    { kind: 'path', progress: 14 },
    { kind: 'path', progress: 42 },
    { kind: 'home', progress: 6 },
  ],
  // Blue (seat 3): 2 in yard, 2 on track
  [
    { kind: 'base', progress: 0 },
    { kind: 'base', progress: 0 },
    { kind: 'path', progress: 8 },
    { kind: 'path', progress: 31 },
  ],
];

export const LandingBoard2D: React.FC = () => {
  const [tokens] = useState<BoardToken[][]>(INITIAL_SHOWCASE_TOKENS);
  const [activeTurn, setActiveTurn] = useState<number>(0);
  const [showcaseDice, setShowcaseDice] = useState<number>(6);

  // Gentle cyclic turn animation so the board feels dynamically alive
  useEffect(() => {
    const diceSequence = [6, 4, 3, 5];
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % 4;
      setActiveTurn(step);
      setShowcaseDice(diceSequence[step]);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-board-showcase master-card">
      {/* Header bar matching master design */}
      <div className="board-showcase-header">
        <div className="board-showcase-meta">
          <span className="board-showcase-eyebrow">AUTHENTIC 15×15 TABLETOP ARENA</span>
          <h2 className="board-showcase-title">THE GAME BOARD</h2>
          <p className="board-showcase-subtitle">Classic four-colour Ludo · Real-time physics</p>
        </div>
        <div className="board-showcase-badge" title="Live Board Demonstration">
          <span className="badge-dot" />
          <span className="badge-text">LIVE DEMO</span>
          <div className="showcase-mini-dice" title={`Turn dice: ${showcaseDice}`}>
            <MiniDiceCube value={showcaseDice} />
          </div>
        </div>
      </div>

      {/* Real 15x15 Ludo Board component with master styling */}
      <div className="board-showcase-frame">
        <Board2D
          players={SHOWCASE_PLAYERS}
          tokens={tokens}
          currentPlayer={activeTurn}
          localSeat={0}
          diceDisplay={showcaseDice}
          legal={[2]} // highlights active pawn with luxury beacon
          isMoving={false}
          reducedMotion={false}
          onTokenClick={() => {}}
        />
      </div>

      {/* Tabletop footer with 4 seat colors & safe zone specs */}
      <div className="board-showcase-footer">
        <div className="board-legend-chips">
          <span className="legend-chip chip-ruby">
            <span className="chip-color-dot dot-red" />
            <span className="chip-label">Ruby Red</span>
          </span>
          <span className="legend-chip chip-emerald">
            <span className="chip-color-dot dot-green" />
            <span className="chip-label">Emerald Green</span>
          </span>
          <span className="legend-chip chip-amber">
            <span className="chip-color-dot dot-yellow" />
            <span className="chip-label">Amber Yellow</span>
          </span>
          <span className="legend-chip chip-sapphire">
            <span className="chip-color-dot dot-blue" />
            <span className="chip-label">Sapphire Blue</span>
          </span>
        </div>
        <div className="board-specs-strip">
          <span className="spec-badge">★ 8 Safe Sanctuaries</span>
          <span className="spec-badge">♔ Center Victory Crown</span>
        </div>
      </div>
    </div>
  );
};

export default LandingBoard2D;
