import React, { useEffect, useState } from 'react';
import { Board2D, type BoardPlayer, type BoardToken } from './Board2D';

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

/**
 * The real 15x15 board, angled like a tabletop illustration for the homepage
 * hero. It keeps the gentle turn animation so the artwork is never static.
 */
export const LandingBoard2D: React.FC = () => {
  const [tokens] = useState<BoardToken[][]>(INITIAL_SHOWCASE_TOKENS);
  const [activeTurn, setActiveTurn] = useState<number>(0);
  const [showcaseDice, setShowcaseDice] = useState<number>(6);

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
    <div className="rv-board-frame">
      <Board2D
        players={SHOWCASE_PLAYERS}
        tokens={tokens}
        currentPlayer={activeTurn}
        localSeat={0}
        diceDisplay={showcaseDice}
        legal={[2]}
        isMoving={false}
        reducedMotion={false}
        compactPawns
        onTokenClick={() => {}}
      />
    </div>
  );
};

export default LandingBoard2D;
