import React, { useEffect, useMemo, useRef, useState } from 'react';
import { absoluteCell, SAFE_CELLS, START_OFFSETS, moveToken as advanceState } from '@ludo/game-engine';
import type { GameState } from '@ludo/game-engine';
import { AudioEngine } from './AudioEngine';
import { PawnToken, PawnDefs } from './PawnToken';
import { SeatGlyph } from './SeatGlyph';

export type BoardToken = { kind: 'base' | 'path' | 'home'; progress: number };
export type BoardPlayer = { id: string; name: string; color: string; seat: number; connected?: boolean };

export interface Board2DProps {
  players: BoardPlayer[];
  tokens: BoardToken[][];
  currentPlayer: number;
  localSeat: number;
  diceDisplay: number | null;
  legal: number[];
  isMoving?: boolean;
  reducedMotion?: boolean;
  showCaptureHints?: boolean;
  onTokenClick: (tokenIdx: number) => void;
}

const SEAT_COLORS = ['red', 'green', 'yellow', 'blue'] as const;
const CELL = 100 / 15;

export const cellToPercent = (col: number, row: number) => ({
  x: ((col + 0.5) / 15) * 100,
  y: ((row + 0.5) / 15) * 100,
});

export const TRACK_COORDS: Array<{ col: number; row: number }> = [
  /* 0..4 (Row 6, Cols 1..5 - Red out of base) */
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  /* 5..10 (Col 6, Rows 5..0 - Going UP top arm) */
  { col: 6, row: 5 },
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 },
  { col: 6, row: 1 },
  { col: 6, row: 0 },
  /* 11 (Top bridge) */
  { col: 7, row: 0 },
  /* 12..17 (Col 8, Rows 0..5 - Going DOWN top arm, Green start is 13 at row 1) */
  { col: 8, row: 0 },
  { col: 8, row: 1 },
  { col: 8, row: 2 },
  { col: 8, row: 3 },
  { col: 8, row: 4 },
  { col: 8, row: 5 },
  /* 18..23 (Row 6, Cols 9..14 - Going RIGHT into right arm) */
  { col: 9, row: 6 },
  { col: 10, row: 6 },
  { col: 11, row: 6 },
  { col: 12, row: 6 },
  { col: 13, row: 6 },
  { col: 14, row: 6 },
  /* 24 (Right bridge) */
  { col: 14, row: 7 },
  /* 25..30 (Row 8, Cols 14..9 - Going LEFT out of right arm, Yellow start is 26 at col 13) */
  { col: 14, row: 8 },
  { col: 13, row: 8 },
  { col: 12, row: 8 },
  { col: 11, row: 8 },
  { col: 10, row: 8 },
  { col: 9, row: 8 },
  /* 31..36 (Col 8, Rows 9..14 - Going DOWN bottom arm) */
  { col: 8, row: 9 },
  { col: 8, row: 10 },
  { col: 8, row: 11 },
  { col: 8, row: 12 },
  { col: 8, row: 13 },
  { col: 8, row: 14 },
  /* 37 (Bottom bridge) */
  { col: 7, row: 14 },
  /* 38..43 (Col 6, Rows 14..9 - Going UP bottom arm, Blue start is 39 at row 13) */
  { col: 6, row: 14 },
  { col: 6, row: 13 },
  { col: 6, row: 12 },
  { col: 6, row: 11 },
  { col: 6, row: 10 },
  { col: 6, row: 9 },
  /* 44..49 (Row 8, Cols 5..0 - Going LEFT into left arm) */
  { col: 5, row: 8 },
  { col: 4, row: 8 },
  { col: 3, row: 8 },
  { col: 2, row: 8 },
  { col: 1, row: 8 },
  { col: 0, row: 8 },
  /* 50 (Left bridge) */
  { col: 0, row: 7 },
  /* 51 (Row 6, Col 0 - Turn into Red start) */
  { col: 0, row: 6 },
];

export const HOME_LANE_COORDS: Record<number, Array<{ col: number; row: number }>> = {
  // Red (seat 0): Row 7, Cols 1..5
  0: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  // Green (seat 1): Col 7, Rows 1..5
  1: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  // Yellow (seat 2): Row 7, Cols 13..9
  2: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
  // Blue (seat 3): Col 7, Rows 13..9
  3: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
};

export const GOAL_COORDS: Record<number, { col: number; row: number }> = {
  0: { col: 6.5, row: 7 },
  1: { col: 7, row: 6.5 },
  2: { col: 7.5, row: 7 },
  3: { col: 7, row: 7.5 },
};

export const BASE_SOCKET_PERCENTS: Record<number, Array<{ x: number; y: number }>> = {
  0: [
    { x: 15.5, y: 15.5 },
    { x: 28.5, y: 15.5 },
    { x: 15.5, y: 28.5 },
    { x: 28.5, y: 28.5 },
  ],
  1: [
    { x: 71.5, y: 15.5 },
    { x: 84.5, y: 15.5 },
    { x: 71.5, y: 28.5 },
    { x: 84.5, y: 28.5 },
  ],
  2: [
    { x: 71.5, y: 71.5 },
    { x: 84.5, y: 71.5 },
    { x: 71.5, y: 84.5 },
    { x: 84.5, y: 84.5 },
  ],
  3: [
    { x: 15.5, y: 71.5 },
    { x: 28.5, y: 71.5 },
    { x: 15.5, y: 84.5 },
    { x: 28.5, y: 84.5 },
  ],
};

function getCoordForPos(
  pos: BoardToken,
  seat: number,
  tokenIdx: number
): { x: number; y: number } {
  if (pos.kind === 'base') {
    return BASE_SOCKET_PERCENTS[seat]?.[tokenIdx] || { x: 20, y: 20 };
  }
  if (pos.kind === 'home') {
    if (pos.progress >= 6) {
      return cellToPercent(GOAL_COORDS[seat].col, GOAL_COORDS[seat].row);
    }
    const step = Math.min(4, Math.max(0, pos.progress - 1));
    const c = HOME_LANE_COORDS[seat][step];
    return cellToPercent(c.col, c.row);
  }
  // Path
  const absCell = (START_OFFSETS[seat] + pos.progress) % 52;
  const c = TRACK_COORDS[absCell];
  return cellToPercent(c.col, c.row);
}

function computeWaypoints(
  oldPos: BoardToken,
  newPos: BoardToken,
  seat: number,
  tokenIdx: number
): Array<{ x: number; y: number }> {
  const waypoints: Array<{ x: number; y: number }> = [];

  if (oldPos.kind === 'base' && newPos.kind === 'path') {
    // Deploying from base socket to starting track cell with smooth arcing launch
    const baseC = getCoordForPos(oldPos, seat, tokenIdx);
    const startC = getCoordForPos(newPos, seat, tokenIdx);
    const midC = {
      x: (baseC.x + startC.x) / 2,
      y: (baseC.y + startC.y) / 2 - 4,
    };
    return [baseC, midC, startC];
  }

  if (oldPos.kind === 'path') {
    const startProgress = oldPos.progress;
    const endProgress = newPos.kind === 'path' ? newPos.progress : 50 + newPos.progress;

    waypoints.push(getCoordForPos(oldPos, seat, tokenIdx));
    for (let p = startProgress + 1; p <= endProgress; p++) {
      if (p <= 50) {
        const absCell = (START_OFFSETS[seat] + p) % 52;
        const c = TRACK_COORDS[absCell];
        waypoints.push(cellToPercent(c.col, c.row));
      } else {
        const homeProg = p - 50;
        if (homeProg >= 6) {
          waypoints.push(cellToPercent(GOAL_COORDS[seat].col, GOAL_COORDS[seat].row));
        } else {
          const step = Math.min(4, Math.max(0, homeProg - 1));
          const c = HOME_LANE_COORDS[seat][step];
          waypoints.push(cellToPercent(c.col, c.row));
        }
      }
    }
    return waypoints;
  }

  if (oldPos.kind === 'home') {
    const startProg = oldPos.progress;
    const endProg = newPos.progress;
    waypoints.push(getCoordForPos(oldPos, seat, tokenIdx));
    for (let p = startProg + 1; p <= endProg; p++) {
      if (p >= 6) {
        waypoints.push(cellToPercent(GOAL_COORDS[seat].col, GOAL_COORDS[seat].row));
      } else {
        const step = Math.min(4, Math.max(0, p - 1));
        const c = HOME_LANE_COORDS[seat][step];
        waypoints.push(cellToPercent(c.col, c.row));
      }
    }
    return waypoints;
  }

  return [getCoordForPos(newPos, seat, tokenIdx)];
}

function computeCaptureReturnWaypoints(
  oppOldPos: BoardToken,
  oppSeat: number,
  oppTokenIdx: number
): Array<{ x: number; y: number }> {
  const waypoints: Array<{ x: number; y: number }> = [];
  if (oppOldPos.kind === 'path') {
    for (let p = oppOldPos.progress; p >= 0; p--) {
      const absCell = (START_OFFSETS[oppSeat] + p) % 52;
      const c = TRACK_COORDS[absCell];
      waypoints.push(cellToPercent(c.col, c.row));
    }
  }
  // Finish inside base socket
  waypoints.push(BASE_SOCKET_PERCENTS[oppSeat]?.[oppTokenIdx] || { x: 20, y: 20 });
  return waypoints;
}

export const StarMedal: React.FC<{ size?: number }> = ({ size }) => (
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
  diceDisplay,
  legal,
  isMoving = false,
  reducedMotion = false,
  showCaptureHints = false,
  onTokenClick,
}) => {
  const activeSeats = useMemo(() => new Set(players.map((p) => p.seat)), [players]);

  // Animation states
  const [animatingPawn, setAnimatingPawn] = useState<{
    seat: number;
    tokenIdx: number;
    x: number;
    y: number;
    hopIndex: number;
    mode: 'deploy' | 'move' | 'home' | 'goal';
    stepMs: number;
    lean: number;
    size: number;
  } | null>(null);

  const [capturedPawnAnim, setCapturedPawnAnim] = useState<{
    seat: number;
    tokenIdx: number;
    x: number;
    y: number;
  } | null>(null);

  const [captureEffect, setCaptureEffect] = useState<{ x: number; y: number } | null>(null);
  const [goalBurst, setGoalBurst] = useState<{ x: number; y: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // Selection / hover preview (destination + travelled path)
  const [previewTokenIdx, setPreviewTokenIdx] = useState<number | null>(null);
  const [hoverTokenIdx, setHoverTokenIdx] = useState<number | null>(null);
  const pointerTypeRef = useRef<'mouse' | 'touch' | 'pen'>('mouse');

  const activePreviewIdx = previewTokenIdx ?? hoverTokenIdx;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      pointerTypeRef.current = e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse';
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Clear the preview whenever the actionable state changes
  useEffect(() => {
    setPreviewTokenIdx(null);
    setHoverTokenIdx(null);
  }, [tokens, diceDisplay, currentPlayer, localSeat, legal.join(',')]);

  useEffect(() => {
    if (previewTokenIdx === null && hoverTokenIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewTokenIdx(null);
        setHoverTokenIdx(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewTokenIdx, hoverTokenIdx]);

  // Destination comes from the same pure engine function the server uses — never a
  // second movement implementation.
  const movePreview = useMemo(() => {
    if (activePreviewIdx === null || diceDisplay === null) return null;
    if (localSeat < 0 || localSeat !== currentPlayer) return null;
    if (!legal.includes(activePreviewIdx)) return null;
    const currentPos = tokens[localSeat]?.[activePreviewIdx];
    if (!currentPos) return null;
    try {
      const virtualState = {
        players: players.map((p, i) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          seat: (typeof p.seat === 'number' ? p.seat : i) as any,
        })),
        tokens: tokens as any,
        currentPlayer: localSeat as any,
        dice: diceDisplay,
        consecutiveSixes: 0,
        status: 'playing',
        winner: null,
        rankings: [],
        version: 0,
      } as GameState;
      const result = advanceState(virtualState, localSeat as any, activePreviewIdx, diceDisplay);
      const destination = result.state.tokens[localSeat][activePreviewIdx] as BoardToken;
      const waypoints = computeWaypoints(currentPos, destination, localSeat, activePreviewIdx);
      return {
        destination,
        destinationPoint: waypoints[waypoints.length - 1],
        pathPoints: waypoints.slice(1, -1),
        captured: result.captured,
      };
    } catch {
      return null;
    }
  }, [activePreviewIdx, diceDisplay, legal, localSeat, currentPlayer, tokens, players]);

  // Which of my pawns can be captured on the opponent's next roll (engine rules:
  // track cell, not a safe cell, reachable within 1–6 steps, opponent still on track).
  const threatenedTokens = useMemo(() => {
    const threatened = new Set<string>();
    if (!showCaptureHints || localSeat < 0) return threatened;
    const myTokens = tokens[localSeat] || [];
    myTokens.forEach((pos, tokenIdx) => {
      if (pos.kind !== 'path') return;
      const myCell = absoluteCell(localSeat as any, pos.progress);
      if (SAFE_CELLS.has(myCell)) return;
      for (const p of players) {
        if (p.seat === localSeat) continue;
        (tokens[p.seat] || []).forEach((opponentPos) => {
          if (opponentPos.kind !== 'path' || opponentPos.progress >= 50) return;
          const opponentCell = absoluteCell(p.seat as any, opponentPos.progress);
          let distance = (myCell - opponentCell + 52) % 52;
          if (distance === 0) distance = 52;
          if (distance >= 1 && distance <= 6 && opponentPos.progress + distance <= 50) {
            threatened.add(`${localSeat}-${tokenIdx}`);
          }
        });
      }
    });
    return threatened;
  }, [showCaptureHints, tokens, players, localSeat]);

  const activatePawn = (tokenIdx: number) => {
    if (!legal.includes(tokenIdx) || isAnimating || isMoving) return;
    const isTouch = pointerTypeRef.current !== 'mouse';
    if (!isTouch || previewTokenIdx === tokenIdx) {
      setPreviewTokenIdx(null);
      setHoverTokenIdx(null);
      onTokenClick(tokenIdx);
      return;
    }
    AudioEngine.playHop();
    setHoverTokenIdx(null);
    setPreviewTokenIdx(tokenIdx);
  };

  const lastCommittedTokensRef = useRef<BoardToken[][] | null>(null);
  const animTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Clear pending animation timers on unmount
  useEffect(() => {
    return () => {
      animTimeoutsRef.current.forEach(clearTimeout);
      animTimeoutsRef.current = [];
    };
  }, []);

  // Detect state transitions and trigger cell-by-cell pawn movement & capture return
  useEffect(() => {
    const prevTokens = lastCommittedTokensRef.current;
    if (!prevTokens || prevTokens.length === 0) {
      lastCommittedTokensRef.current = tokens;
      return;
    }

    // Check if tokens actually changed
    let tokensChanged = false;
    for (let s = 0; s < tokens.length; s++) {
      const curList = tokens[s] || [];
      const prevList = prevTokens[s] || [];
      for (let t = 0; t < curList.length; t++) {
        if (!prevList[t] || curList[t].kind !== prevList[t].kind || curList[t].progress !== prevList[t].progress) {
          tokensChanged = true;
          break;
        }
      }
      if (tokensChanged) break;
    }

    // Prevent non-movement state updates (e.g. countdown timer ticks, user HUD updates) from aborting active animations
    if (!tokensChanged) {
      return;
    }

    lastCommittedTokensRef.current = tokens;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      Boolean(reducedMotion) ||
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    if (prefersReducedMotion) return;

    // Find which player's token moved
    let movedSeat: number | null = null;
    let movedTokenIdx: number | null = null;
    let oldPos: BoardToken | null = null;
    let newPos: BoardToken | null = null;

    // Check for captured token (went from path -> base)
    let capturedSeat: number | null = null;
    let capturedTokenIdx: number | null = null;
    let capturedOldPos: BoardToken | null = null;

    for (let s = 0; s < tokens.length; s++) {
      const sTokens = tokens[s] || [];
      const prevSTokens = prevTokens[s] || [];
      for (let t = 0; t < sTokens.length; t++) {
        const cur = sTokens[t];
        const prev = prevSTokens[t];
        if (!cur || !prev) continue;

        if (cur.kind !== prev.kind || cur.progress !== prev.progress) {
          // If went from path to base, this is a captured token!
          if (prev.kind === 'path' && cur.kind === 'base') {
            capturedSeat = s;
            capturedTokenIdx = t;
            capturedOldPos = prev;
          } else {
            movedSeat = s;
            movedTokenIdx = t;
            oldPos = prev;
            newPos = cur;
          }
        }
      }
    }

    if (movedSeat !== null && movedTokenIdx !== null && oldPos && newPos) {
      const waypoints = computeWaypoints(oldPos, newPos, movedSeat, movedTokenIdx);
      if (waypoints.length <= 1) return;

      // Clear any running animation timers
      animTimeoutsRef.current.forEach(clearTimeout);
      animTimeoutsRef.current = [];
      setGoalBurst(null);

      setIsAnimating(true);

      const mode: 'deploy' | 'move' | 'home' | 'goal' =
        oldPos.kind === 'base'
          ? 'deploy'
          : newPos.kind === 'home' && newPos.progress >= 6
          ? 'goal'
          : newPos.kind === 'home'
          ? 'home'
          : 'move';

      // Pacing per cell: deployments launch slower, goal entry settles slower
      const stepDuration = mode === 'deploy' ? 240 : mode === 'goal' ? 190 : 150;
      const initialDelay = 60;

      // Match the pawn size to its destination so landing does not resize the token
      const movingSize =
        newPos.kind === 'base' ? 46 : newPos.kind === 'home' && newPos.progress >= 6 ? 20 : 28;

      // Lean into horizontal travel so the pawn feels like it is running
      const leanFor = (from: { x: number; y: number }, to: { x: number; y: number }) =>
        Math.max(-12, Math.min(12, (to.x - from.x) * 2.2));

      // Set initial position
      setAnimatingPawn({
        seat: movedSeat,
        tokenIdx: movedTokenIdx,
        x: waypoints[0].x,
        y: waypoints[0].y,
        hopIndex: 0,
        mode,
        stepMs: stepDuration,
        lean: 0,
        size: movingSize,
      });

      // Animate through subsequent waypoints; CSS interpolates left/top between them
      waypoints.slice(1).forEach((wp, idx) => {
        const stepNum = idx + 1;
        const lean = leanFor(waypoints[stepNum - 1], wp);

        const t = setTimeout(() => {
          setAnimatingPawn({
            seat: movedSeat!,
            tokenIdx: movedTokenIdx!,
            x: wp.x,
            y: wp.y,
            hopIndex: stepNum,
            mode,
            stepMs: stepDuration,
            lean,
            size: movingSize,
          });
          AudioEngine.playHop();

          // Last hop of moving token
          if (stepNum === waypoints.length - 1) {
            // Check capture
            if (capturedSeat !== null && capturedTokenIdx !== null && capturedOldPos) {
              AudioEngine.playStrike();
              setCaptureEffect({ x: wp.x, y: wp.y });
              const effectTimer = setTimeout(() => setCaptureEffect(null), 700);
              animTimeoutsRef.current.push(effectTimer);

              const returnWaypoints = computeCaptureReturnWaypoints(
                capturedOldPos,
                capturedSeat,
                capturedTokenIdx
              );

              // Animate captured pawn spinning back to its yard
              const returnStepMs = 45;
              returnWaypoints.forEach((rwp, rIdx) => {
                const rt = setTimeout(() => {
                  setCapturedPawnAnim({
                    seat: capturedSeat!,
                    tokenIdx: capturedTokenIdx!,
                    x: rwp.x,
                    y: rwp.y,
                  });

                  if (rIdx === returnWaypoints.length - 1) {
                    AudioEngine.playExit();
                    const settle = setTimeout(() => {
                      setAnimatingPawn(null);
                      setCapturedPawnAnim(null);
                      setIsAnimating(false);
                    }, 140);
                    animTimeoutsRef.current.push(settle);
                  }
                }, rIdx * returnStepMs);
                animTimeoutsRef.current.push(rt);
              });
            } else {
              // Non-capture landing: play landing sound on safe cell
              const landedAbsCell =
                newPos!.kind === 'path'
                  ? (START_OFFSETS[movedSeat!] + newPos!.progress) % 52
                  : null;
              if (landedAbsCell !== null && SAFE_CELLS.has(landedAbsCell)) {
                AudioEngine.playLand();
              }

              if (mode === 'goal') {
                setGoalBurst({ x: wp.x, y: wp.y });
                const burstTimer = setTimeout(() => setGoalBurst(null), 800);
                animTimeoutsRef.current.push(burstTimer);
              }

              // Let the final glide finish before removing the overlay pawn
              const settle = setTimeout(() => {
                setAnimatingPawn(null);
                setIsAnimating(false);
              }, stepDuration + 90);
              animTimeoutsRef.current.push(settle);
            }
          }
        }, initialDelay + stepNum * stepDuration);

        animTimeoutsRef.current.push(t);
      });
    }
  }, [tokens]);

  // Map tokens to their visual cells:
  // Key: "track-X", "home-SEAT-INDEX", "base-SEAT-TOKEN", "goal-SEAT"
  const tokensOnBoard = useMemo(() => {
    const map: Record<string, Array<{ seat: number; tokenIdx: number; isLegal: boolean }>> = {};

    tokens.forEach((seatTokens, seat) => {
      if (!activeSeats.has(seat)) return;
      seatTokens.forEach((token, tokenIdx) => {
        const isLegal =
          !isAnimating &&
          !isMoving &&
          localSeat === currentPlayer &&
          seat === localSeat &&
          legal.includes(tokenIdx);

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
            // Home lane progress 1..5 maps to cell 0..4
            const step = Math.min(4, Math.max(0, token.progress - 1));
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
  }, [tokens, activeSeats, localSeat, currentPlayer, legal, isAnimating, isMoving]);

  const renderPawn = (seat: number, tokenIdx: number, isLegal: boolean, size = 36) => {
    // If this token is currently in flight on the animation overlay, hide its static cell instance
    if (
      (animatingPawn && animatingPawn.seat === seat && animatingPawn.tokenIdx === tokenIdx) ||
      (capturedPawnAnim && capturedPawnAnim.seat === seat && capturedPawnAnim.tokenIdx === tokenIdx)
    ) {
      return null;
    }

    const colorKey = SEAT_COLORS[seat] || 'red';
    const isSelected = previewTokenIdx === tokenIdx && seat === localSeat;

    return (
      <PawnToken
        key={`pawn-${seat}-${tokenIdx}`}
        color={colorKey}
        seat={seat}
        isLegal={isLegal}
        isSelected={isSelected}
        isThreatened={seat === localSeat && threatenedTokens.has(`${seat}-${tokenIdx}`)}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          if (isLegal && !isAnimating && !isMoving) {
            activatePawn(tokenIdx);
          }
        }}
        onActivate={() => activatePawn(tokenIdx)}
        onPointerEnter={() => {
          if (isLegal && pointerTypeRef.current === 'mouse') setHoverTokenIdx(tokenIdx);
        }}
        onPointerLeave={() => {
          if (hoverTokenIdx === tokenIdx) setHoverTokenIdx(null);
        }}
        onFocus={() => {
          if (isLegal) setHoverTokenIdx(tokenIdx);
        }}
        onBlur={() => {
          if (hoverTokenIdx === tokenIdx) setHoverTokenIdx(null);
        }}
        title={`Seat ${seat + 1} (${colorKey.toUpperCase()}) - Pawn ${tokenIdx + 1}${
          isLegal ? ' (Press Enter or tap to preview the move)' : ''
        }${
          seat === localSeat && threatenedTokens.has(`${seat}-${tokenIdx}`)
            ? ' — can be captured next roll'
            : ''
        }`}
      />
    );
  };

  function renderCellTokens(trackIndex: number) {
    const occupants = tokensOnBoard[`track-${trackIndex}`] || [];
    if (occupants.length === 0) return null;
    const visibleOccupants = occupants.filter(
      (occ) =>
        !(animatingPawn && animatingPawn.seat === occ.seat && animatingPawn.tokenIdx === occ.tokenIdx) &&
        !(capturedPawnAnim && capturedPawnAnim.seat === occ.seat && capturedPawnAnim.tokenIdx === occ.tokenIdx)
    );
    if (visibleOccupants.length === 0) return null;

    const isClustered = visibleOccupants.length > 1;
    const pawnSize = isClustered ? 20 : 28;

    return (
      <div className={`tokens-cluster ${isClustered ? 'has-cluster' : ''}`}>
        {visibleOccupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSize))}
        {isClustered && <span className="cluster-badge">×{visibleOccupants.length}</span>}
      </div>
    );
  }

  function renderHomeTokens(seat: number, stepIndex: number) {
    const occupants = tokensOnBoard[`home-${seat}-${stepIndex}`] || [];
    if (occupants.length === 0) return null;
    const visibleOccupants = occupants.filter(
      (occ) =>
        !(animatingPawn && animatingPawn.seat === occ.seat && animatingPawn.tokenIdx === occ.tokenIdx)
    );
    if (visibleOccupants.length === 0) return null;

    const isClustered = visibleOccupants.length > 1;
    const pawnSize = isClustered ? 20 : 28;

    return (
      <div className={`tokens-cluster ${isClustered ? 'has-cluster' : ''}`}>
        <span className="home-lane-arrow">
          {seat === 0 ? '▶' : seat === 1 ? '▼' : seat === 2 ? '◀' : '▲'}
        </span>
        {visibleOccupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSize))}
        {isClustered && <span className="cluster-badge">×{visibleOccupants.length}</span>}
      </div>
    );
  }

  function renderGoalTokens(seat: number) {
    const occupants = tokensOnBoard[`goal-${seat}`] || [];
    if (occupants.length === 0) return null;
    const visibleOccupants = occupants.filter(
      (occ) =>
        !(animatingPawn && animatingPawn.seat === occ.seat && animatingPawn.tokenIdx === occ.tokenIdx)
    );
    if (visibleOccupants.length === 0) return null;

    return (
      <div className="goal-occupants-cluster">
        {visibleOccupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 22))}
      </div>
    );
  }

  return (
    <div className="ludo-arena-container board-v2-container">
      <PawnDefs />
      <div className="ludo-arena-frame board-v2-frame">
        <div
          className="ludo-grid board-v2-grid"
          id="ludoBoard"
          style={{ position: 'relative' }}
          onClick={() => {
            setPreviewTokenIdx(null);
            setHoverTokenIdx(null);
          }}
        >
          {/* ==================== DYNAMIC ANIMATION OVERLAY LAYER ==================== */}
          <div className="board-anim-layer" aria-hidden="true">
            {/* Move preview: destination tile, travelled cells and a ghost pawn */}
            {movePreview && activePreviewIdx !== null && (
              <>
                <div
                  className={`move-preview-target ${movePreview.captured ? 'preview-captures' : ''}`}
                  style={{
                    left: `${movePreview.destinationPoint.x}%`,
                    top: `${movePreview.destinationPoint.y}%`,
                    width: `${CELL}%`,
                    height: `${CELL}%`,
                  }}
                />
                {movePreview.pathPoints.map((point, idx) => (
                  <span
                    key={`preview-dot-${idx}`}
                    className="move-preview-dot"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  />
                ))}
                <div
                  className="move-preview-ghost"
                  style={{
                    left: `${movePreview.destinationPoint.x}%`,
                    top: `${movePreview.destinationPoint.y}%`,
                  }}
                >
                  <PawnToken
                    color={SEAT_COLORS[localSeat] || 'red'}
                    seat={localSeat}
                    size={
                      movePreview.destination.kind === 'base'
                        ? 46
                        : movePreview.destination.kind === 'home' &&
                          movePreview.destination.progress >= 6
                        ? 20
                        : 28
                    }
                  />
                </div>
              </>
            )}

            {animatingPawn && (
              <div
                key={`pawn-anim-${animatingPawn.seat}-${animatingPawn.tokenIdx}`}
                className={`animating-pawn-wrapper ${
                  animatingPawn.mode === 'deploy'
                    ? 'deploying-pawn'
                    : animatingPawn.mode === 'goal'
                    ? 'goal-entry-pawn'
                    : ''
                }`}
                style={
                  {
                    left: `${animatingPawn.x}%`,
                    top: `${animatingPawn.y}%`,
                    '--step-ms': `${animatingPawn.stepMs}ms`,
                    '--pawn-lean': `${animatingPawn.lean}deg`,
                  } as React.CSSProperties
                }
              >
                <div key={`hop-inner-${animatingPawn.hopIndex}`} className="pawn-hop-bounce-inner">
                  <PawnToken color={SEAT_COLORS[animatingPawn.seat]} size={animatingPawn.size} />
                </div>
              </div>
            )}

            {captureEffect && (
              <div
                className="capture-shockwave-ring"
                style={{
                  left: `${captureEffect.x}%`,
                  top: `${captureEffect.y}%`,
                }}
              />
            )}

            {goalBurst && (
              <div
                className="goal-landing-ring"
                style={{
                  left: `${goalBurst.x}%`,
                  top: `${goalBurst.y}%`,
                }}
              />
            )}

            {capturedPawnAnim && (
              <div
                key={`captured-anim-${capturedPawnAnim.seat}-${capturedPawnAnim.tokenIdx}`}
                className="animating-pawn-wrapper captured-return-arc"
                style={
                  {
                    left: `${capturedPawnAnim.x}%`,
                    top: `${capturedPawnAnim.y}%`,
                    '--step-ms': '45ms',
                  } as React.CSSProperties
                }
              >
                <div className="captured-pawn-inner">
                  <PawnToken color={SEAT_COLORS[capturedPawnAnim.seat]} size={40} />
                </div>
              </div>
            )}
          </div>

          {previewTokenIdx !== null && (
            <div className="move-preview-hint" role="status" aria-live="polite">
              Tap again to move
            </div>
          )}

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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasLegalMove && !isAnimating && !isMoving) {
                        const legalOcc = occupants.find((occ) => occ.isLegal);
                        if (legalOcc) onTokenClick(legalOcc.tokenIdx);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!hasLegalMove || (e.key !== 'Enter' && e.key !== ' ')) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const legalOcc = occupants.find((occ) => occ.isLegal);
                      if (legalOcc && !isAnimating && !isMoving) onTokenClick(legalOcc.tokenIdx);
                    }}
                    role="button"
                    tabIndex={hasLegalMove ? 0 : -1}
                    aria-label={`Red Yard Socket ${slotIdx + 1}${hasLegalMove ? ' - Tap to Deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 46))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-tl">
              {activeSeats.has(0) && <SeatGlyph seat={0} size={8} tone="cream" />}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasLegalMove && !isAnimating && !isMoving) {
                        const legalOcc = occupants.find((occ) => occ.isLegal);
                        if (legalOcc) onTokenClick(legalOcc.tokenIdx);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!hasLegalMove || (e.key !== 'Enter' && e.key !== ' ')) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const legalOcc = occupants.find((occ) => occ.isLegal);
                      if (legalOcc && !isAnimating && !isMoving) onTokenClick(legalOcc.tokenIdx);
                    }}
                    role="button"
                    tabIndex={hasLegalMove ? 0 : -1}
                    aria-label={`Green Yard Socket ${slotIdx + 1}${hasLegalMove ? ' - Tap to Deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 46))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-tr">
              {activeSeats.has(1) && <SeatGlyph seat={1} size={8} tone="cream" />}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasLegalMove && !isAnimating && !isMoving) {
                        const legalOcc = occupants.find((occ) => occ.isLegal);
                        if (legalOcc) onTokenClick(legalOcc.tokenIdx);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!hasLegalMove || (e.key !== 'Enter' && e.key !== ' ')) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const legalOcc = occupants.find((occ) => occ.isLegal);
                      if (legalOcc && !isAnimating && !isMoving) onTokenClick(legalOcc.tokenIdx);
                    }}
                    role="button"
                    tabIndex={hasLegalMove ? 0 : -1}
                    aria-label={`Blue Yard Socket ${slotIdx + 1}${hasLegalMove ? ' - Tap to Deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 46))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-bl">
              {activeSeats.has(3) && <SeatGlyph seat={3} size={8} tone="cream" />}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasLegalMove && !isAnimating && !isMoving) {
                        const legalOcc = occupants.find((occ) => occ.isLegal);
                        if (legalOcc) onTokenClick(legalOcc.tokenIdx);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!hasLegalMove || (e.key !== 'Enter' && e.key !== ' ')) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const legalOcc = occupants.find((occ) => occ.isLegal);
                      if (legalOcc && !isAnimating && !isMoving) onTokenClick(legalOcc.tokenIdx);
                    }}
                    role="button"
                    tabIndex={hasLegalMove ? 0 : -1}
                    aria-label={`Yellow Yard Socket ${slotIdx + 1}${hasLegalMove ? ' - Tap to Deploy' : ''}`}
                  >
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, 46))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-br">
              {activeSeats.has(2) && <SeatGlyph seat={2} size={8} tone="cream" />}
              {activeSeats.has(2) ? 'YELLOW' : 'VACANT'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

