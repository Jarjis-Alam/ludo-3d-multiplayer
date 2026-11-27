# Ludo Multiplayer — Gameplay Corrections, Interaction & Animation Overhaul Audit

**Audit & Implementation Report**  
**Date:** November 17, 2026  
**Status:** Complete & Fully Verified  
**Scope:** `@ludo/game-engine`, `@ludo/server`, `@ludo/web`

---

## 1. Executive Summary

This release resolves all critical gameplay bugs, overhauls token interactions by eliminating artificial buttons in favor of authentic direct-tap board interactions, and introduces a smooth, server-authoritative cell-by-cell pawn movement and capture animation system.

All changes preserve:
- 2D top-down authentic Meenakari royal enamel Ludo board.
- Mobile-first responsive touch layout across 360px–430px phones, tablets, and desktop.
- 100% server-authoritative game state, dice rolls, and turn expiration deadlines.
- Real-time Socket.IO synchronization with deterministic version control and monotonic progression.
- Robust 2-, 3-, and 4-player support with automatic empty seat skipping.

---

## 2. Key Corrections & Architectural Overhaul

### 2.1 Engine Rules: Home-Lane Entry & 1-by-1 Exact Finish Progression
- **Root Cause of Prior Bug:** The circuit previously had an offset issue where outer track progress exceeded 50, causing pawns to skip home-lane cells or jump directly to the goal on improper dice rolls.
- **Correction in `@ludo/game-engine`:**
  - Standard Ludo circuit has exactly 50 steps on the outer path (`MAX_PATH_PROGRESS = 50`, progress $0 \le p \le 50$).
  - Step 51 enters Home Lane Cell 0 (`home`, progress 1).
  - Pawns progress 1-by-1 through cells $1 \to 2 \to 3 \to 4 \to 5$ (Home Cells 0 to 4).
  - Exact Finish into the Home Goal is enforced strictly on `progress === 6`.
  - Overshooting is disallowed: `isLegalMove` evaluates `dice <= stepsToFinish(pos)` where `stepsToFinish` is $(50 - p) + 6$ for path tokens and $6 - progress$ for home lane tokens. Rolls exceeding the exact steps to finish are rejected as illegal moves.

### 2.2 Capture Bonus Turn & Server-Authoritative Timer Reset
- When a token lands on a non-safe cell occupied by an opponent's token:
  - The opponent token is captured and returned to `{ kind: 'base' }`.
  - Capturing player is awarded an immediate **Bonus Turn** (`nextPlayer = player`).
  - Turn deadline (`turnExpiresAt`) is reset with a fresh full turn duration ($\approx 15\text{s}$).
  - Fully tested and verified across 2-, 3-, and 4-player games (`pnpm test`, `pnpm --filter @ludo/server test`, `pnpm qa:players`).

### 2.3 Tournament Match Completion (1st & 2nd Place Rankings)
- Traditional tournament Ludo rules implemented:
  - When a player finishes all 4 pawns (`isPlayerFinished(tokens)`):
    - Player is recorded in `state.rankings` (e.g. `[seat0]`).
    - The player finishes taking turns and is removed from the active turn rotation (`getRemainingSeats(state)`).
    - In **2-player matches**, the game finishes immediately when the 1st player finishes.
    - In **3- and 4-player matches**, play continues among remaining active players until a **2nd player finishes** (`rankings: [p1, p2]`).
    - Once 2nd place is achieved, the match finishes cleanly, stopping all turn timers.
  - The Victory Podium dynamically celebrates **1st Place (Champion)**, **2nd Place (Runner-Up)**, and ranks remaining players by tokens home.

### 2.4 Removal of Deploy/Move Action Buttons & Direct Pawn Tap
- **Buttons Removed:** All drawer buttons such as `Deploy #1 (+4)`, `Move #2 (+4)`, `.mobile-pawn-select-row`, and `.mobile-pawn-quick-btn` have been completely removed from the DOM.
- **New Interaction:**
  - Players interact **directly with pawns and base sockets** on the board.
  - When a player rolls, eligible pawns highlight with a glowing pulse (`.pawn-legal-pulse`), floating elevation animation, and expanded tap targets ($\ge 44\times 44\text{px}$).
  - When rolled a 6, occupied base sockets pulse with golden borders (`.socket-can-deploy`). Tapping either the base socket or the pawn inside directly deploys the pawn.
  - Ineligible pawns have `cursor: default`, no hover transformations, and ignore clicks.
  - Double-click protection: `isMoving` / `isAnimating` locking prevents duplicate moves or race conditions during transitions.

### 2.5 Authoritative Synchronized Dice Roll Feedback
- Added server event `dice_rolled`:
  - Broadcasts authoritative `{ seat, playerName, value, hasLegalMoves, isExtraTurn }` to all connected clients.
  - Triggers tumbling roll animation visible to roller and opponents alike.
  - Dice locks on the server's exact value.
  - Prominent notifications:
    - `"You rolled a 6! (Bonus Roll!)"` / `"Alice rolled a 4"`.
    - Automatic pass notifications when no legal moves exist: `"Bob rolled a 2 with no legal moves. Passing turn."`
  - Current turn is indicated at all times with active borders on yards, player telemetry ribbons, and status banners.

### 2.6 Smooth Pawn Movement & Captured Return Animations
- **Path Coordinate Resolver:** Built-in mapping from all 52 track cells, 4 home lanes (5 cells each), 4 center goals, and 16 base sockets to board percentage coordinates $(x\%, y\%)$.
- **Cell-by-Cell Hopping Animation:**
  - Token advances step-by-step through each intermediate waypoint cell ($\approx 110\text{ms}$ per hop).
  - Accompanied by synthesized audio hop (`AudioEngine.playHop()`) and 3D elevation bounce.
- **Captured Return Animation:**
  - Upon landing on an opponent token, strike sound effect (`AudioEngine.playStrike()`) and shockwave burst (`.capture-shockwave-ring`) are triggered.
  - Captured token visibly travels backwards along the track to its starting cell and pops into its home base socket.
- **Accessibility & Performance:**
  - Respects `@media (prefers-reduced-motion: reduce)` by skipping intermediate hopping frames immediately.
  - Presentation-layer only; server-authoritative state remains untouched.

---

## 3. Test & Verification Evidence

### 3.1 Unit & Integration Test Suites
1. **Game Engine (`@ludo/game-engine`)**:
   - `vitest run`: **23/23 tests passed** (including home-lane step-by-step entry, overshooting rejection, capture extra turns, 2-player finish, and 4-player 1st+2nd place finish).
2. **Server (`@ludo/server`)**:
   - `vitest run`: **26/26 tests passed** (including turn timer, deterministic synchronization, idempotency, monotonic versioning, and crash recovery).
3. **End-to-End Multi-Player Simulations**:
   - `pnpm qa:players`:
     - 2-Player Match: Finished in 319 steps at version 320. Rematch verified. **PASS ✅**
     - 3-Player Match: Finished in 574 steps at version 575. Rematch verified. **PASS ✅**
     - 4-Player Match: Finished in 933 steps at version 934. Rematch verified. **PASS ✅**
   - `pnpm qa`: 1123-step deterministic match passed with 100% sync. **PASS ✅**
4. **Browser & UI Verification (`verify-gameplay-animations.mts`)**:
   - `.mobile-pawn-quick-btn` count: **0** (PASS ✅)
   - `.mobile-pawn-select-row` count: **0** (PASS ✅)
   - `.mobile-roll-result-row` count: **1** (PASS ✅)
   - Glowing deployable base sockets: **4** (PASS ✅)
   - 1st & 2nd place podium banners verified: (PASS ✅)
   - Mobile and desktop viewports tested with zero horizontal/vertical overflow: (PASS ✅)

---

## 4. Comprehensive Home-Lane Transition & 4-Color Geometry Audit (November 20, 2026)

### 4.1 Root Cause & Mathematical Resolution of the 50/52-Step Discrepancy
- **The Board Definition:**
  - The outer perimeter track consists of **52 cells** (13 cells in each of the 4 arms: 6 ascending/descending + 1 bridge + 6 ascending/descending = 13; $13 \times 4 = 52$).
  - Start offsets: Red (Seat 0) = Cell `0`, Green (Seat 1) = Cell `13`, Yellow (Seat 2) = Cell `26`, Blue (Seat 3) = Cell `39`.
- **The Journey Traversal:**
  - When a token deploys from base, it is placed at `progress = 0` on its own start cell ($(\text{START\_OFFSET} + 0) \bmod 52$).
  - To reach the home-entry bridge cell directly adjacent to its colored home runway:
    - The token advances **50 steps** along the outer track.
    - It occupies exactly **51 distinct cells** on the outer circuit: `progress: 0, 1, 2, ..., 50`.
    - The 52nd relative track cell (relative progress 51) is the bypass cell connecting the bridge back to that player's start cell (Cell 51 for Red, Cell 12 for Green, Cell 25 for Yellow, Cell 38 for Blue).
    - **A player NEVER steps on their own bypass cell.** That bypass cell is strictly reserved for opponent tokens completing their outer circuits.
    - Thus, `MAX_PATH_PROGRESS = 50` is mathematically exact.
- **The Home Lane Transition:**
  - From the home-entry bridge cell (`progress = 50`), a roll of 1 advances the token 1 step into **Home Lane Cell 0** (`{ kind: 'home', progress: 1 }`).
  - Home runway cells correspond to `progress: 1, 2, 3, 4, 5`.
  - The 6th step enters the Center Victory Goal (`{ kind: 'home', progress: 6 }`).
  - Total steps from deployment to center goal = $50 + 6 = 56$ steps.

### 4.2 Four-Color Symmetric Parameter Matrix

| Parameter | Red (Seat 0) | Green (Seat 1) | Yellow (Seat 2) | Blue (Seat 3) |
|---|---|---|---|---|
| **Start Offset / Cell** | `0` (`col: 1, row: 6`) | `13` (`col: 8, row: 1`) | `26` (`col: 13, row: 8`) | `39` (`col: 6, row: 13`) |
| **Initial Track Direction** | East (Right) | South (Down) | West (Left) | North (Up) |
| **Home-Entry Junction Cell** | `50` (`col: 0, row: 7`) | `11` (`col: 7, row: 0`) | `24` (`col: 14, row: 7`) | `37` (`col: 7, row: 14`) |
| **Turn Direction Into Home** | $90^\circ$ Right (East) | $90^\circ$ Down (South) | $90^\circ$ Left (West) | $90^\circ$ Up (North) |
| **Bypass Cell (Skipped)** | `51` (`col: 0, row: 6`) | `12` (`col: 8, row: 0`) | `25` (`col: 14, row: 8`) | `38` (`col: 6, row: 14`) |
| **Home Runway Step 0** | `{ col: 1, row: 7 }` | `{ col: 7, row: 1 }` | `{ col: 13, row: 7 }` | `{ col: 7, row: 13 }` |
| **Home Runway Step 1** | `{ col: 2, row: 7 }` | `{ col: 7, row: 2 }` | `{ col: 12, row: 7 }` | `{ col: 7, row: 12 }` |
| **Home Runway Step 2** | `{ col: 3, row: 7 }` | `{ col: 7, row: 3 }` | `{ col: 11, row: 7 }` | `{ col: 7, row: 11 }` |
| **Home Runway Step 3** | `{ col: 4, row: 7 }` | `{ col: 7, row: 4 }` | `{ col: 10, row: 7 }` | `{ col: 7, row: 10 }` |
| **Home Runway Step 4** | `{ col: 5, row: 7 }` | `{ col: 7, row: 5 }` | `{ col: 9, row: 7 }` | `{ col: 7, row: 9 }` |
| **Center Victory Goal** | `{ col: 6.5, row: 7 }` | `{ col: 7, row: 6.5 }` | `{ col: 7.5, row: 7 }` | `{ col: 7, row: 7.5 }` |

### 4.3 Red Pawn Step-by-Step Transition Audit Log

| Step / Phase | Previous Position | Dice | New Position | Board DOM Key | Coordinates | Legal? | Notes |
|---|---|---|---|---|---|---|---|
| **1. In Base** | `{ kind: 'base' }` | 5 | `{ kind: 'base' }` | `base-0-0` | Socket % | ❌ | Requires 6 to leave base |
| **2. Deployment** | `{ kind: 'base' }` | 6 | `{ kind: 'path', progress: 0 }` | `track-0` | Col 1, Row 6 | ✅ | Lands on starting cell |
| **3. Outer Track (1..49)** | `{ progress: 0 }` | 1 | `{ progress: 1 }` | `track-1` | Col 2, Row 6 | ✅ | Advances clockwise |
| ... | ... | ... | ... | ... | ... | ✅ | Advances through arms |
| **4. Pre-Entry** | `{ progress: 49 }` | 1 | `{ progress: 50 }` | `track-50` | Col 0, Row 7 | ✅ | Left bridge cell |
| **5. Home Entry** | `{ progress: 50 }` | 1 | `{ kind: 'home', progress: 1 }` | `home-0-0` | Col 1, Row 7 | ✅ | Turns $90^\circ$ into home lane 0 |
| **6. Home Runway 1** | `{ home, progress: 1 }` | 1 | `{ home, progress: 2 }` | `home-0-1` | Col 2, Row 7 | ✅ | Step 1 |
| **7. Home Runway 2** | `{ home, progress: 2 }` | 1 | `{ home, progress: 3 }` | `home-0-2` | Col 3, Row 7 | ✅ | Step 2 |
| **8. Home Runway 3** | `{ home, progress: 3 }` | 1 | `{ home, progress: 4 }` | `home-0-3` | Col 4, Row 7 | ✅ | Step 3 |
| **9. Home Runway 4** | `{ home, progress: 4 }` | 1 | `{ home, progress: 5 }` | `home-0-4` | Col 5, Row 7 | ✅ | Step 4 (final runway cell) |
| **10. Exact Finish** | `{ home, progress: 5 }` | 1 | `{ kind: 'home', progress: 6 }` | `goal-0` | Col 6.5, Row 7 | ✅ | Goal quadrant; exact finish |
| **11. Overshoot Attempt** | `{ home, progress: 5 }` | 2 | `{ home, progress: 5 }` | `home-0-4` | Col 5, Row 7 | ❌ | Rejected: exceeds steps to finish (1) |
| **12. At Goal** | `{ home, progress: 6 }` | 1..6 | `{ home, progress: 6 }` | `goal-0` | Col 6.5, Row 7 | ❌ | Finished tokens cannot move |

### 4.4 Automated Regression Test Suite
Added dedicated test file `ludo/packages/game-engine/test/home-lane-audit.test.ts`:
- **16 comprehensive test suites** covering:
  - 50/52-step mathematical constants verification.
  - Symmetrical full journey audits for Red, Green, Yellow, and Blue.
  - Strict overshooting rejection across all positions ($p = 50, \text{home } 1..5, \text{goal } 6$).
  - Multi-token distribution handling (base, path, home entry, home runway).
  - Opponent capture immediately before home entry on cell 50 with bonus turn awarding.
  - Turn timeouts near home entry with state preservation.
- **Result:** **39/39 tests passed** across `@ludo/game-engine` (`pnpm --filter @ludo/game-engine test`).

### 4.5 Mocked Visual Browser Verification (`verify-home-lane.mts`)
Executed Playwright suite `ludo/apps/server/test/verify-home-lane.mts` using injected UI snapshots (`window.__SET_MOCK_SNAPSHOT__`) to test visual rendering coordinates:
- `[TEST 1] Red pawn immediately before home entry (track progress 50)`: **PASS ✅**
- `[TEST 2] Red pawn entering red home lane cell 0 (home progress 1)`: **PASS ✅**
- `[TEST 3.1] Red pawn at home lane progress 2 (runway step 1)`: **PASS ✅**
- `[TEST 3.2] Red pawn at home lane progress 3 (runway step 2)`: **PASS ✅**
- `[TEST 3.3] Red pawn at home lane progress 4 (runway step 3)`: **PASS ✅**
- `[TEST 3.4] Red pawn at home lane progress 5 (runway step 4)`: **PASS ✅**
- `[TEST 4] Red pawn reaching the Center Goal (home progress 6)`: **PASS ✅**
- `[TEST 5] Green pawn before and entering green home lane`: **PASS ✅**
- `[TEST 6] Yellow pawn before and entering yellow home lane`: **PASS ✅**
- `[TEST 7] Blue pawn before and entering blue home lane`: **PASS ✅**
- `[TEST 8] All 4 Colors concurrent home-lane and goal overview`: **PASS ✅**
- `[TEST 9] Mobile viewport verification (390x844)`: **PASS ✅**

---

## 5. Real Multiplayer End-to-End Verification (Socket.IO + Playwright)

To provide definitive proof under real multiplayer conditions without mocked snapshots, we developed and executed the comprehensive live suite `ludo/apps/server/test/e2e-real-multiplayer-home-lane.mts`.

### 5.1 Test Architecture Hierarchy

1. **Unit Tests (`ludo/packages/game-engine/test/home-lane-audit.test.ts`)**:
   - Pure in-memory Vitest unit tests verifying state transitions, relative offset calculations, overshoot rejections, and legal token validation.
2. **Mocked Visual Tests (`ludo/apps/server/test/verify-home-lane.mts`)**:
   - Single-browser visual layout verification using client-side injected mock snapshots (`window.__SET_MOCK_SNAPSHOT__`) to validate SVG element placement and CSS coordinates.
3. **Real Multiplayer Integration Tests (`ludo/apps/server/test/e2e-real-multiplayer-home-lane.mts`)**:
   - **Zero mock snapshots.**
   - Live Node HTTP server hosting production web client bundle (`dist/`) on port 5173.
   - Live `createLudoServer()` Socket.IO server on port 3001.
   - Real browser sessions with multiple independent browser contexts for each human player.
   - Server-authoritative state transitions, real turn timers, real WebSocket communication, and DOM validation.

### 5.2 Real Multiplayer Test Execution & Results

```
================================================================
--- STARTING REAL MULTIPLAYER SOCKET.IO PLAYWRIGHT E2E TESTS ---
================================================================

[Backend] Real Ludo Socket.IO Server listening on port 3001
[Frontend] Real Web App Server listening on port 5173

--- PART A: REAL 2-PLAYER MULTIPLAYER MATCH (RED & GREEN) ---
[Step 1] Alice creates private room via browser UI...
  - Real room code created: 35C59E
[Step 2] Bob joins room via browser UI...
  - Both real browser clients synchronized 2/2 connected players in lobby ✅
[Step 3] Alice starts match via real UI button...
  - Real 2D Ludo Board rendered on both players screens ✅
[Step 4] Alice rolls 6 to deploy token 0...
  - Red Yard Socket glowing with .socket-can-deploy ✅
  - Alice sees red pawn on start cell 0: PASS ✅
  - Bob sees red pawn on start cell 0: PASS ✅

[Step 5] Alice advances red pawn across outer circuit to Cell 50 (10 rounds of 5)...
  - Advanced 50 steps on outer track to progress 50 (Cell 50) ✅
  - Server state: Red token at { kind: "path", progress: 50 } ✅
  - Alice sees red pawn on junction cell 50: PASS ✅
  - Bob sees red pawn on junction cell 50: PASS ✅
  - Captured screenshot: real_multiplayer_red_at_cell_50.png 📸

[Step 6] Bob rolls without legal moves -> server auto-passes turn back to Alice...
  - Server auto-passed turn back to Alice ✅

[Step 7] Alice rolls 1 and enters Red Home Lane Cell 0...
  - Server authoritative state: Red token at { kind: "home", progress: 1 } ✅
  - Alice sees red pawn inside first red home lane cell: PASS ✅
  - Bob sees red pawn inside first red home lane cell: PASS ✅
  - Captured screenshot: real_multiplayer_red_entering_home_lane.png 📸

[Step 8] Alice advances red pawn through home runway steps...
  - Red pawn in home lane cell 1 (home progress 2): PASS ✅
  - Red pawn in home lane cell 2 (home progress 3): PASS ✅
  - Red pawn in home lane cell 3 (home progress 4): PASS ✅
  - Red pawn in home lane cell 4 (home progress 5): PASS ✅

[Step 9] Alice rolls 1 to reach Center Victory Goal...
  - Red pawn in Center Victory Goal: PASS ✅

--- PART B: REAL 4-PLAYER MATCH (GREEN, YELLOW, BLUE TRANSITIONS) ---
  - Real 4-player lobby ready with 4 connected players ✅
  - 4-Player match active on board ✅

[Green Test] Deploying Green, advancing 50 steps to Cell 11, entering Green Home Lane...
  - Green pawn inside first green home lane cell: PASS ✅

[Yellow Test] Deploying Yellow, advancing 50 steps to Cell 24, entering Yellow Home Lane...
  - Yellow pawn inside first yellow home lane cell: PASS ✅

[Blue Test] Deploying Blue, advancing 50 steps to Cell 37, entering Blue Home Lane...
  - Blue pawn inside first blue home lane cell: PASS ✅
  - Captured composite screenshot: real_multiplayer_all_four_colors_home_lanes.png 📸

================================================================
--- ALL REAL MULTIPLAYER E2E HOME-LANE TESTS PASSED 100% ✅ ---
================================================================
```

### 5.3 Reproducing the captures

Every position asserted above was read from the authoritative snapshot on both clients; the images taken during the run were per-cell captures that are not committed. The scripts that produce them live in `ludo/apps/server/test/` (`e2e-real-multiplayer-home-lane.mts`, `e2e-quality-of-life.mts`) and write to `docs/mobile_screenshots/` at runtime. The five representative screens kept in [`docs/screenshots/`](screenshots/) show the same boards in their normal state.

---

## 6. Quality of Life Update 2: Movement Precision & Animation Overhaul

### 6.1 Root Cause & Resolution: Dice 3 Moving 2 Cells
- **Cause**: Re-renders triggered by duplicate state callbacks (`room_state` broadcast + `move_token` ack) cleared `animTimeoutsRef.current` mid-flight, killing the 3rd hop before it executed.
- **Fix**: Implemented `lastCommittedTokensRef` with deep equality checking so non-position state changes no longer cancel active hop timeouts.
- **Continuous Interpolation**: Added `transition: left 115ms linear, top 115ms linear` on stable parent animation containers and isolated subtle vertical bouncing (`transform: translateY(-8px)`) to inner wrappers.

### 6.2 Bonus Turns & Multi-Winner Lifecycle
- Reaching Center Goal (`progress === 6`) with an exact roll grants an immediate bonus turn ("Pawn reached home — Bonus turn!") and resets the turn timer.
- Capturing opponent pawns grants a bonus turn and sends the victim smoothly back to base.
- In 3-player and 4-player matches, the game continues after 1st place finishes and concludes when 2nd place finishes. Finished players cannot roll or move.

### 6.3 Mobile Bottom Controls Redesign
- Unified thumb-reachable card directly beneath the board.
- Centered 74px dice tray with rolling tumble animation and high-contrast numerical corner badge.
- Prominent "TAP TO ROLL" button directly below the dice with contextual messages and timer integration.


