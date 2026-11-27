# Ludo Multiplayer — Quality of Life Update 2 Audit Report

## 1. Executive Summary

This audit and implementation addresses gameplay precision, rule completeness, animation smoothness, and mobile ergonomics for the production 2D Ludo multiplayer application.

Key achievements:
- **Dice Movement Mathematical Precision**: Fixed the critical bug where rolling a 3 caused pawns to move only 2 cells. Pawns now advance with exact mathematical correspondence (`newProgress - oldProgress === diceValue`) across all colors, outer tracks, and home lanes.
- **Finishing & Capture Bonus Turns**: Individual pawns entering the Center Goal (`progress === 6`) now award a bonus turn ("Pawn reached home — Bonus turn!"), reset the turn timer, and allow rolling immediately. Capturing opponent pawns similarly awards an extra turn.
- **Two-Winner Match Lifecycle**: 3-player and 4-player games continue after 1st place finishes, concluding only when 2nd place reaches the goal. Finished players are removed from active turn rotation and strictly prevented from rolling or moving.
- **Continuous Smooth Movement Animations**: Waypoint hops are separated into linear coordinate interpolation (`left, top 115ms linear`) and subtle vertical hop bounces (`translateY(-8px)`). Base deployment features an arcing launch trajectory, and captured pawns return with an animated return arc. React re-render collision protection prevents state updates from cancelling active animations.
- **Mobile Bottom Controls Redesign**: The mobile control area now features a unified cohesive card with a contextual status directive, a centered 74px dice tray, and a prominent "TAP TO ROLL" button directly below the dice.

---

## 2. Root Cause Analysis & Engineering Fixes

### Priority 1: The "Roll 3 Moving 2 Cells" Bug
- **Symptom**: During live games, players observed that rolling a 3 often resulted in the pawn hopping only 2 cells and then halting.
- **Root Cause**: In `Board2D.tsx`, `useEffect` watched `[tokens]`. Because `main.tsx` updated the snapshot from both the Socket.IO `room_state` broadcast AND the `move_token` ack callback with distinct object references, a secondary re-render fired while hop 1 or 2 was still executing. The previous `useEffect` implementation unconditionally executed `animTimeoutsRef.current.forEach(clearTimeout)`, abruptly cancelling pending timeouts for hops 2 and 3 mid-flight.
- **Resolution**:
  1. Implemented deep token equality checking using `lastCommittedTokensRef`. Snapshot updates without actual position changes no longer cancel or restart active waypoint timers.
  2. Assigned stable DOM keys to animation containers (`pawn-anim-${seat}-${tokenIdx}`).
  3. Replaced stepped DOM position jumps with CSS continuous interpolation: `transition: left 115ms linear, top 115ms linear`.
  4. Verified via Vitest unit tests and real multiplayer Socket.IO Playwright tests that rolling 3 advances exactly 3 cells.

### Priority 2: Finishing Bonus Turns
- **Symptom**: Finishing a pawn into the Center Goal (`progress === 6`) passed the turn to the next player unless all 4 pawns had finished.
- **Resolution**:
  1. Updated `moveToken` in `game-engine`:
     ```ts
     const pawnReachedHome =
       landed.kind === 'home' &&
       landed.progress === HOME_LENGTH &&
       (old.kind !== 'home' || old.progress !== HOME_LENGTH);
     ```
  2. Awarded extra turn when `pawnReachedHome && !justFinished`:
     ```ts
     if (captured || dice === 6 || pawnReachedHome) {
       earnsExtraTurn = true;
       nextPlayer = player;
     }
     ```
  3. Added contextual notification: `{ type: 'extra_turn', message: 'Pawn reached home — Bonus turn!' }`.
  4. Emitted `pawnReachedHome` in Socket.IO `token_moved` payload and reset the server-authoritative turn timer.

### Priority 3: Two-Winner Match Lifecycle
- **Specification**:
  - 2-Player Match: Ends when 1st player finishes.
  - 3-Player Match: Continues after 1st place finishes; ends when 2nd place finishes.
  - 4-Player Match: Continues after 1st place finishes; ends when 2nd place finishes.
- **Resolution**:
  1. Enforced match completion condition:
     ```ts
     const isMatchFinished =
       totalPlayers <= 2
         ? updatedRankings.length >= 1
         : updatedRankings.length >= 2 || remainingSeats.length <= 1;
     ```
  2. Guarded `roll` and `moveToken` in both `game-engine` and `game-server.ts`:
     ```ts
     if (state.rankings && state.rankings.includes(player)) {
       throw new Error('player already finished');
     }
     ```
  3. Fixed turn fallback in `handleTurnTimeout` to strictly filter out finished seats.

### Priority 4: Movement Animations & Deployment Arc
- **Smooth Interpolation**: Separated spatial movement (`left`, `top` on `.animating-pawn-wrapper`) from the vertical hop (`transform: translateY(-8px)` on inner `.pawn-hop-bounce-inner`). This eliminates jitter between coordinate translation and vertical bouncing.
- **Deployment Arc**: Added a 3-point parabolic waypoint arc (`[baseC, midC, startC]`) when deploying from the base socket to the track start cell.
- **Capture Return**: Added a 55ms rapid return transition with spinning shrink keyframes when a pawn is captured.

### Priority 5: Mobile Bottom Controls Redesign
- **Unified Card Layout**: Centered the controls in a single thumb-reachable card directly beneath the board.
- **Contextual Directive**: Dynamically displays game state with custom styling for `action`, `waiting`, `bonus`, and `notice`.
- **Centered Dice Tray**: 74px radial tray with rolling tumble animation and high-contrast numerical corner badge.
- **Prominent "TAP TO ROLL" Button**: Positioned directly beneath the dice, providing clear feedback:
  - `🎲 TAP TO ROLL (15s)` when local turn to roll.
  - `👉 CHOOSE A PAWN (3)` after rolling.
  - `⏳ WAITING FOR BOB (12s)` when opponent's turn.
  - Disabled during movement animations and when not local turn.

---

## 3. Verification & Test Evidence

### Test Suites Executed
1. **Game Engine Unit Tests**:
   - `test/quality-of-life.test.ts`: 9/9 passed.
   - `test/home-lane-audit.test.ts`: 16/16 passed.
   - `test/rules.test.ts`: 23/23 passed.
   - **Total Engine Tests**: 48 passed.
2. **Server Integration Tests**:
   - `test/deterministic-sync.test.ts`: 7/7 passed.
   - `test/turn-timer.test.ts`: 10/10 passed.
   - `test/integration.test.ts`: 8/8 passed.
   - `test/postgres-persistence.test.ts`: 1/1 passed.
   - **Total Server Tests**: 26 passed.
3. **Playwright Real Multiplayer E2E Tests**:
   - Verified real Socket.IO room creation, join, start, roll 3 move, home goal bonus turn, and 3-player match two-winner lifecycle.
   - Mobile portrait (390×844), mobile landscape (844×390), and tablet (768×1024) screenshots captured.

---

## 4. Visual Artifacts

Per-viewport captures from this audit are generated by the Playwright scripts and are not committed. Representative screens live in [`docs/screenshots/`](screenshots/).
