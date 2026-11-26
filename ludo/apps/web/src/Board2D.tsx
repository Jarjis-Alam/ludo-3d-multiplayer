import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { absoluteCell, SAFE_CELLS, START_OFFSETS } from '@ludo/game-engine';
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
  /* The landing-page showcase keeps the original, smaller pawn scale. */
  compactPawns?: boolean;
  onTokenClick: (tokenIdx: number) => void;
}

const SEAT_COLORS = ['red', 'green', 'yellow', 'blue'] as const;

type PawnSizes = { track: number; cluster: number; base: number; goal: number };

/* Pawn sizes in px. Track pawns are allowed to stand a little taller than a cell
   so they stay readable on a phone; the base and goal pawns fill their sockets. */
const MATCH_PAWN_SIZES: PawnSizes = { track: 38, cluster: 24, base: 52, goal: 26 };
/* Unchanged scale for the landing-page showcase, which shares this board. */
const SHOWCASE_PAWN_SIZES: PawnSizes = { track: 36, cluster: 24, base: 46, goal: 22 };

type Point = { x: number; y: number };

type PawnFlight = {
  seat: number;
  tokenIdx: number;
  mode: 'deploy' | 'move' | 'home' | 'goal';
  size: number;
  /** The landed pawn's measured box, so the overlay swaps without a size snap. */
  pawnW: number;
  pawnH: number;
  stepMs: number;
  waypoints: Point[];
  captured: { seat: number; tokenIdx: number; waypoints: Point[] } | null;
  landedOnSafe: boolean;
};

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

const Board2DComponent: React.FC<Board2DProps> = ({
  players,
  tokens,
  currentPlayer,
  localSeat,
  diceDisplay,
  legal,
  isMoving = false,
  reducedMotion = false,
  showCaptureHints = false,
  compactPawns = false,
  onTokenClick,
}) => {
  const activeSeats = useMemo(() => new Set(players.map((p) => p.seat)), [players]);
  const pawnSizes = compactPawns ? SHOWCASE_PAWN_SIZES : MATCH_PAWN_SIZES;
  /* Seats are labelled by player name instead of colour so the board reads as people. */
  const nameForSeat = (seat: number) => players.find((p) => p.seat === seat)?.name || `Seat ${seat + 1}`;

  // One pawn in flight at a time. Its position is written straight to the DOM by a
  // requestAnimationFrame loop, so no React render happens while a pawn is moving.
  const [flight, setFlight] = useState<PawnFlight | null>(null);
  const [captureEffect, setCaptureEffect] = useState<{ x: number; y: number } | null>(null);
  const [goalBurst, setGoalBurst] = useState<{ x: number; y: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const moverRef = useRef<HTMLDivElement | null>(null);
  const moverInnerRef = useRef<HTMLDivElement | null>(null);
  const capturedRef = useRef<HTMLDivElement | null>(null);
  const capturedInnerRef = useRef<HTMLDivElement | null>(null);

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
    onTokenClick(tokenIdx);
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

  // Detect state transitions and trigger cell-by-cell pawn movement & capture return.
  // A layout effect runs before the browser paints the committed snapshot, so the
  // pawn never flashes at its destination before the flight starts from its origin.
  useLayoutEffect(() => {
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

      animTimeoutsRef.current.forEach(clearTimeout);
      animTimeoutsRef.current = [];
      setGoalBurst(null);
      setCaptureEffect(null);

      const mode: 'deploy' | 'move' | 'home' | 'goal' =
        oldPos.kind === 'base'
          ? 'deploy'
          : newPos.kind === 'home' && newPos.progress >= 6
          ? 'goal'
          : newPos.kind === 'home'
          ? 'home'
          : 'move';

      // Pacing per cell: deployments launch slower, goal entry settles slower
      const stepMs = mode === 'deploy' ? 240 : mode === 'goal' ? 210 : 170;

      const landedOnSafe =
        newPos.kind === 'path' && SAFE_CELLS.has((START_OFFSETS[movedSeat] + newPos.progress) % 52);

      // The committed snapshot already renders the pawn in its new cell. Measure
      // that box so the overlay flies at exactly the size the pawn will land at;
      // otherwise the 38px flight pawn snaps down to the cell-sized pawn on
      // arrival, which reads as a hitch even at a steady frame rate.
      const movedEl =
        document.querySelector<HTMLElement>(`[data-pawn="${movedSeat}-${movedTokenIdx}"]`) ??
        // If that pawn is still in flight from the previous move it is not in the
        // DOM; any pawn resting in a track cell is the same size.
        document.querySelector<HTMLElement>('#ludoBoard .cell .traditional-pawn-wrapper[data-pawn]');
      const movedRect = movedEl?.getBoundingClientRect();
      const pawnW =
        movedRect && movedRect.width > 0
          ? Math.round(movedRect.width * 100) / 100
          : flight?.pawnW ?? pawnSizes.track;
      const pawnH =
        movedRect && movedRect.height > 0
          ? Math.round(movedRect.height * 100) / 100
          : flight?.pawnH ?? pawnSizes.track;

      // A track or home-lane cell that already holds another pawn switches to the
      // cluster layout, which renders the smaller square pawn. The committed
      // snapshot is measured before the overlay hides the mover, so it still shows
      // a lone pawn; count the pawns already at the destination and fly at the
      // cluster box instead, otherwise the pawn shrinks a pixel after landing.
      const destSeat = movedSeat;
      const destTokenIdx = movedTokenIdx;
      const destPos = newPos;
      const destCell =
        destPos.kind === 'path' ? (START_OFFSETS[destSeat] + destPos.progress) % 52 : null;
      let sharesDestination = false;
      if (destCell !== null || (destPos.kind === 'home' && destPos.progress < 6)) {
        tokens.forEach((seatTokens, s) => {
          seatTokens.forEach((p, ti) => {
            if (s === destSeat && ti === destTokenIdx) return;
            if (destCell !== null) {
              if (p.kind === 'path' && (START_OFFSETS[s] + p.progress) % 52 === destCell) {
                sharesDestination = true;
              }
            } else if (s === destSeat && p.kind === 'home' && p.progress === destPos.progress) {
              sharesDestination = true;
            }
          });
        });
      }
      // Cluster pawns use the same cell clamp, so scaling the measured box down to
      // the cluster size lands on exactly the box the board will render next.
      const flightW = sharesDestination ? Math.min(pawnSizes.cluster, pawnW) : pawnW;
      const flightH = sharesDestination ? Math.min(pawnSizes.cluster, pawnH) : pawnH;

      const captured =
        capturedSeat !== null && capturedTokenIdx !== null && capturedOldPos
          ? {
              seat: capturedSeat,
              tokenIdx: capturedTokenIdx,
              waypoints: computeCaptureReturnWaypoints(
                capturedOldPos,
                capturedSeat,
                capturedTokenIdx
              ),
            }
          : null;

      setIsAnimating(true);
      setFlight({
        seat: movedSeat,
        tokenIdx: movedTokenIdx,
        mode,
        size: mode === 'goal' ? pawnSizes.goal : pawnSizes.track,
        pawnW: flightW,
        pawnH: flightH,
        stepMs,
        waypoints,
        captured,
        landedOnSafe,
      });
    }
  }, [tokens]);

  // Flight driver. One requestAnimationFrame loop writes GPU transforms directly to
  // the pawn, so the whole move is continuous (no per-hop timers, no layout work,
  // no React renders) and runs at the display refresh rate.
  useEffect(() => {
    if (!flight) return;
    const mover = moverRef.current;
    const moverInner = moverInnerRef.current;

    // Fail-safe bookkeeping. Whatever goes wrong inside a flight — a missing
    // node, a throwing audio/DOM call, or a frame loop the browser pauses — the
    // overlay pawn is always cleared and tapping is never left locked.
    let raf = 0;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const settle = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      if (safetyTimer) clearTimeout(safetyTimer);
      setFlight(null);
      setIsAnimating(false);
    };

    if (!mover || !moverInner) {
      settle();
      return;
    }

    const rect = boardRef.current?.getBoundingClientRect();
    const boardW = rect?.width || 360;
    const boardH = rect?.height || 360;

    const points = flight.waypoints;
    const segCount = Math.max(1, points.length - 1);
    const lengths: number[] = [];
    let totalLen = 0;
    for (let i = 0; i < segCount; i++) {
      const len =
        Math.hypot(
          ((points[i + 1].x - points[i].x) / 100) * boardW,
          ((points[i + 1].y - points[i].y) / 100) * boardH
        ) || 1;
      lengths.push(len);
      totalLen += len;
    }

    const origin = points[0];
    const delta = (p: Point) => ({
      dx: ((p.x - origin.x) / 100) * boardW,
      dy: ((p.y - origin.y) / 100) * boardH,
    });

    const placeMover = (dx: number, dy: number, lift: number, sx: number, sy: number) => {
      mover.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      moverInner.style.transform = `translate3d(0, ${-lift}px, 0) scale(${sx}, ${sy})`;
    };
    // A deployment starts on a full-size yard pawn and lands on a cell-sized one.
    // Scale the flight pawn down across the journey so both ends match the board.
    const launchScale = flight.mode === 'deploy' ? pawnSizes.base / Math.max(flight.pawnW, flight.pawnH) : 1;
    const start = delta(points[0]);
    // First painted frame already matches the pawn's size at the origin, so a
    // deployment does not pop from the yard size down to the cell size.
    placeMover(start.dx, start.dy, 0, launchScale, launchScale);

    const capturePoints = flight.captured?.waypoints ?? [];
    const captureOrigin = capturePoints[0];
    const captureSegCount = Math.max(0, capturePoints.length - 1);
    const captureLengths: number[] = [];
    let captureTotal = 0;
    for (let i = 0; i < captureSegCount; i++) {
      const len =
        Math.hypot(
          ((capturePoints[i + 1].x - captureOrigin.x) / 100) * boardW,
          ((capturePoints[i + 1].y - captureOrigin.y) / 100) * boardH
        ) || 1;
      captureLengths.push(len);
      captureTotal += len;
    }

    const capturedEl = capturedRef.current;
    const capturedInner = capturedInnerRef.current;
    const captureDelta = (p: Point) => ({
      dx: ((p.x - captureOrigin.x) / 100) * boardW,
      dy: ((p.y - captureOrigin.y) / 100) * boardH,
    });
    const placeCaptured = (dx: number, dy: number, rot: number, scale: number) => {
      if (!capturedEl || !capturedInner) return;
      capturedEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      capturedInner.style.transform = `rotate(${rot}deg) scale(${scale})`;
    };

    const cellPx = Math.min(boardW, boardH) / 15;
    const hopLift =
      flight.mode === 'deploy' ? cellPx * 2 : flight.mode === 'goal' ? cellPx * 0.5 : cellPx * 0.72;

    const moveDuration = segCount * flight.stepMs;
    const settleMs = 80;
    const captureDelay = 120;
    const captureDuration = captureSegCount * 28;
    const finishAt =
      moveDuration + settleMs + (flight.captured ? captureDelay + captureDuration + 40 : 40);

    let startedAt = 0;
    let lastSeg = 0;
    let landed = false;
    let exitPlayed = false;

    const step = (now: number) => {
      if (!startedAt) startedAt = now;
      const t = now - startedAt;

      if (t < moveDuration) {
        // Ease the whole journey rather than each cell, so the pawn never stops
        // between cells — it accelerates once, flows, and settles on arrival.
        const p = Math.min(1, t / moveDuration);
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const sizeScale = launchScale === 1 ? 1 : launchScale + (1 - launchScale) * eased;
        let remaining = totalLen * eased;
        let seg = 0;
        while (seg < segCount - 1 && remaining > lengths[seg]) {
          remaining -= lengths[seg];
          seg += 1;
        }
        const u = Math.min(1, remaining / lengths[seg]);
        const from = delta(points[seg]);
        const to = delta(points[seg + 1]);
        const arc = Math.sin(Math.PI * u);
        const squash = u > 0.86 ? Math.sin(Math.PI * ((u - 0.86) / 0.14)) : 0;
        placeMover(
          from.dx + (to.dx - from.dx) * u,
          from.dy + (to.dy - from.dy) * u,
          arc * hopLift,
          (1 + 0.05 * squash + 0.02 * arc) * sizeScale,
          (1 - 0.07 * squash + 0.03 * arc) * sizeScale
        );
        if (seg > lastSeg) {
          lastSeg = seg;
          AudioEngine.playHop();
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      if (!landed) {
        landed = true;
        const dest = points[points.length - 1];
        const destDelta = delta(dest);
        placeMover(destDelta.dx, destDelta.dy, 0, 1, 1);

        if (flight.captured) {
          AudioEngine.playStrike();
          setCaptureEffect({ x: dest.x, y: dest.y });
          const ringTimer = setTimeout(() => setCaptureEffect(null), 650);
          animTimeoutsRef.current.push(ringTimer);
          placeCaptured(destDelta.dx, destDelta.dy, 0, 0.86);
        } else {
          if (flight.landedOnSafe) AudioEngine.playLand();
          if (flight.mode === 'goal') {
            setGoalBurst({ x: dest.x, y: dest.y });
            const burstTimer = setTimeout(() => setGoalBurst(null), 760);
            animTimeoutsRef.current.push(burstTimer);
          }
        }
      }

      if (flight.captured && captureSegCount > 0) {
        const ct = t - moveDuration - settleMs - captureDelay;
        if (ct >= 0) {
          const cp = Math.min(1, ct / captureDuration);
          const eased = 1 - Math.pow(1 - cp, 2);
          let remaining = captureTotal * eased;
          let seg = 0;
          while (seg < captureSegCount - 1 && remaining > captureLengths[seg]) {
            remaining -= captureLengths[seg];
            seg += 1;
          }
          const u = Math.min(1, remaining / captureLengths[seg]);
          const from = captureDelta(capturePoints[seg]);
          const to = captureDelta(capturePoints[seg + 1]);
          placeCaptured(
            from.dx + (to.dx - from.dx) * u,
            from.dy + (to.dy - from.dy) * u,
            -540 * eased,
            0.86 + 0.14 * eased
          );
          if (!exitPlayed && cp >= 1) {
            exitPlayed = true;
            AudioEngine.playExit();
          }
        }
      }

      if (t >= finishAt) {
        settle();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const frame = (now: number) => {
      if (done) return;
      try {
        step(now);
      } catch (error) {
        // Never strand the flight: snap the pawn to its destination, drop the
        // overlay and unlock tapping so the board stays usable.
        try {
          const dest = delta(points[points.length - 1]);
          placeMover(dest.dx, dest.dy, 0, 1, 1);
        } catch {
          /* the overlay is removed below regardless */
        }
        console.warn('[Board2D] pawn animation aborted, settling immediately', error);
        settle();
      }
    };

    raf = requestAnimationFrame(frame);
    // Watchdog: even if the frame loop stops being called, release the board.
    safetyTimer = setTimeout(settle, finishAt + 1500);

    return () => {
      cancelAnimationFrame(raf);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [flight]);

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

  const renderPawn = (seat: number, tokenIdx: number, isLegal: boolean, size = pawnSizes.track) => {
    // While a pawn is in flight, its overlay copy is the visible one.
    if (
      (flight && flight.seat === seat && flight.tokenIdx === tokenIdx) ||
      (flight?.captured && flight.captured.seat === seat && flight.captured.tokenIdx === tokenIdx)
    ) {
      return null;
    }

    return (
      <PawnToken
        key={`pawn-${seat}-${tokenIdx}`}
        color={SEAT_COLORS[seat] || 'red'}
        seat={seat}
        tokenIndex={tokenIdx}
        isLegal={isLegal}
        isThreatened={seat === localSeat && threatenedTokens.has(`${seat}-${tokenIdx}`)}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          if (isLegal && !isAnimating && !isMoving) {
            activatePawn(tokenIdx);
          }
        }}
        onActivate={() => activatePawn(tokenIdx)}
        title={`${nameForSeat(seat)} - Pawn ${tokenIdx + 1}${
          isLegal ? ' (tap to move)' : ''
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
        !(flight && flight.seat === occ.seat && flight.tokenIdx === occ.tokenIdx) &&
        !(flight?.captured && flight.captured.seat === occ.seat && flight.captured.tokenIdx === occ.tokenIdx)
    );
    if (visibleOccupants.length === 0) return null;

    const isClustered = visibleOccupants.length > 1;
    const pawnSize = isClustered ? pawnSizes.cluster : pawnSizes.track;

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
      (occ) => !(flight && flight.seat === occ.seat && flight.tokenIdx === occ.tokenIdx)
    );
    if (visibleOccupants.length === 0) return null;

    const isClustered = visibleOccupants.length > 1;
    const pawnSize = isClustered ? pawnSizes.cluster : pawnSizes.track;

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
      (occ) => !(flight && flight.seat === occ.seat && flight.tokenIdx === occ.tokenIdx)
    );
    if (visibleOccupants.length === 0) return null;

    return (
      <div className="goal-occupants-cluster">
        {visibleOccupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSizes.goal))}
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
          ref={boardRef}
        >
          {/* ==================== DYNAMIC ANIMATION OVERLAY LAYER ==================== */}
          <div className="board-anim-layer" aria-hidden="true">
            {flight && (
              <div
                className={`animating-pawn-wrapper ${
                  flight.mode === 'deploy'
                    ? 'deploying-pawn'
                    : flight.mode === 'goal'
                    ? 'goal-entry-pawn'
                    : ''
                }`}
                style={{
                  left: `${flight.waypoints[0].x}%`,
                  top: `${flight.waypoints[0].y}%`,
                }}
                ref={moverRef}
              >
                <div className="pawn-flight-inner" ref={moverInnerRef}>
                  <PawnToken
                    color={SEAT_COLORS[flight.seat]}
                    seat={flight.seat}
                    size={flight.size}
                    width={flight.pawnW}
                    height={flight.pawnH}
                  />
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

            {flight?.captured && (
              <div
                className="animating-pawn-wrapper captured-return-arc"
                style={{
                  left: `${flight.captured.waypoints[0].x}%`,
                  top: `${flight.captured.waypoints[0].y}%`,
                }}
                ref={capturedRef}
              >
                <div className="pawn-flight-inner captured-pawn-inner" ref={capturedInnerRef}>
                  <PawnToken
                    color={SEAT_COLORS[flight.captured.seat]}
                    seat={flight.captured.seat}
                    size={40}
                    width={flight.pawnW}
                    height={flight.pawnH}
                  />
                </div>
              </div>
            )}
          </div>

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
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSizes.base))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-tl">
              {activeSeats.has(0) && <SeatGlyph seat={0} size={8} tone="cream" />}
              {activeSeats.has(0) ? nameForSeat(0) : 'VACANT'}
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
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSizes.base))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-tr">
              {activeSeats.has(1) && <SeatGlyph seat={1} size={8} tone="cream" />}
              {activeSeats.has(1) ? nameForSeat(1) : 'VACANT'}
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
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSizes.base))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-bl">
              {activeSeats.has(3) && <SeatGlyph seat={3} size={8} tone="cream" />}
              {activeSeats.has(3) ? nameForSeat(3) : 'VACANT'}
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
                    {occupants.map((occ) => renderPawn(occ.seat, occ.tokenIdx, occ.isLegal, pawnSizes.base))}
                  </div>
                );
              })}
            </div>
            <span className="yard-badge yard-badge-br">
              {activeSeats.has(2) && <SeatGlyph seat={2} size={8} tone="cream" />}
              {activeSeats.has(2) ? nameForSeat(2) : 'VACANT'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* The board is a large, mostly static tree. Memoising it keeps the turn
   countdown and other HUD state from re-rendering 52 cells and 16 pawn SVGs
   every second, including while a pawn is in flight. */
export const Board2D = React.memo(Board2DComponent);

