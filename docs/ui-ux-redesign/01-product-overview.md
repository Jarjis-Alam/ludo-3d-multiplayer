# Product Overview & System Architecture

## 1. Executive Summary

**LUDO** is an engine-first, server-authoritative, real-time multiplayer implementation of the classic Ludo board game. Built for seamless web play across modern desktop, tablet, and mobile browsers, the product enables 2 to 4 players to gather in private, link-shareable rooms and compete under strict international Ludo tournament rules.

The game is currently transitioning from an early Three.js/React Three Fiber 3D visual prototype to a **state-of-the-art, fully 2D top-down vector interface**. This document establishes the product vision, full-stack architecture, engine rules, and design rationale for this transition.

---

## 2. Product Vision & Value Proposition

- **Effortless Social Play**: No downloads, app stores, or account registrations. A player creates a room in one click, copies a 6-character code or invitation link, and friends join instantly.
- **Server-Authoritative Fairness**: All random number generation (dice), legal move validation, capture detection, monotonic versioning, and turn transitions execute strictly on the Node.js server. The client is a deterministic rendering interface.
- **Dynamic 2–4 Player Scalability**: Matches seamlessly adapt to 2, 3, or 4 players without requiring artificial bots. Turn rotations dynamically skip unoccupied seats while keeping all standard board quadrants intact.
- **Fault-Tolerant Reconnection**: Players can refresh, experience network handoffs, or temporarily disconnect without forfeiting their position or desynchronizing match state. Active sessions persist to PostgreSQL.
- **Premium 2D Board-Game Aesthetic**: Replacing fragile 3D camera controls with a crisp, beautifully illustrated, top-down 15×15 vector board featuring rich tactile animations, unmistakable turn hierarchy, and effortless touch interactions.

---

## 3. Full-Stack Architecture Boundary

The application is structured as a pnpm monorepo maintaining a strict separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER CLIENTS                                 │
│          Desktop (1440px+) · Tablet (768px-1023px) · Mobile (360px-767px)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                      Direct WebSocket (Socket.IO WSS)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RENDER BACKEND                                 │
│            Node.js 24 LTS · Express · Socket.IO Server · pg.Pool            │
├─────────────────────────────────────────────────────────────────────────────┤
│  • LudoService: In-memory room manager, action serializer (actionTail)      │
│  • Memory / Postgres Persistence layer: atomic JSONB snapshots              │
│  • Rate limiting & anti-abuse throttles                                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    TCP / SSL Session Pooler (Port 5432)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE POSTGRESQL                               │
│              Tables: `game_rooms` (JSONB) · `player_sessions`               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Monorepo Workspaces

1. **`packages/game-engine` (`@ludo/game-engine`)**:
   - Zero-dependency, pure TypeScript mathematical core.
   - Computes board geometry, legal moves, captures, home lanes, dice outcomes, and victory states.
   - Fully isomorphic: shared between the Node.js backend and browser Vite bundle.
2. **`apps/server` (`@ludo/server`)**:
   - Express HTTP server exposing health check diagnostics (`/health`) and Socket.IO real-time hub.
   - Manages room lifecycles, host migrations, monotonic version sequencing, and persistent storage.
3. **`apps/web` (`@ludo/web`)**:
   - React 18 single-page application built with Vite and TypeScript.
   - Consumes Socket.IO events, binds local UI state, and renders the interactive board and HUD.

---

## 4. Game Engine Rules & State Machine

The game engine strictly implements the standard cross-track Ludo rule set:

### Board Constants
- **Main Path Length**: Exactly 52 shared perimeter cells (`PATH_LENGTH = 52`).
- **Home Lane Length**: Exactly 6 private colored cells per quadrant (`HOME_LENGTH = 6`).
- **Player Capacity**: 2 to 4 players.
- **Quadrant Seats & Starting Offsets**:
  - **Seat 0 (Red)**: Start cell offset `0`
  - **Seat 1 (Green)**: Start cell offset `13`
  - **Seat 2 (Yellow)**: Start cell offset `26`
  - **Seat 3 (Blue)**: Start cell offset `39`
- **Safe Cells**: Exactly 8 cells immune to opponent captures (`SAFE_CELLS = {0, 8, 13, 21, 26, 34, 39, 47}`):
  - 4 Starting Cells: `0` (Red), `13` (Green), `26` (Yellow), `39` (Blue).
  - 4 Track Resting Stars: `8`, `21`, `34`, `47`.

### Core Gameplay Mechanics
1. **Base Deployment**: Tokens start in the player's home base (`kind: 'base'`). A dice roll of **6** is strictly required to deploy a token onto the player's starting cell (`kind: 'path', progress: 0`).
2. **Path Traversal**: Tokens advance forward along the 52-cell track by the rolled dice value.
3. **Captures**: If a token lands on a non-safe cell occupied by an opponent's token, the opponent's token is captured and returned to its base (`kind: 'base'`).
4. **Home Entry**: After traversing the full 52-cell perimeter (`progress >= 52`), tokens enter the player's private home lane (`kind: 'home', progress: 0..6`).
5. **Exact Finish**: Entering the central victory triangle (`kind: 'home', progress: 6`) requires an **exact roll**. Overshooting is considered an illegal move.
6. **Extra Rolls**: Rolling a **6** grants the player an immediate extra turn.
7. **Triple-Six Forfeit Penalty**: Rolling three consecutive sixes forfeits the player's turn and passes play to the next active player.
8. **Automated Turn Passing**: If a player has no legal moves for their rolled dice value, the server automatically passes the turn to the next player.
9. **Dynamic Turn Rotation**: During 2-player or 3-player matches, turn progression cycles strictly through occupied seats via `getNextPlayer(current, activeSeats)`:
   - 2 Players (Seats 0 and 1): `0 → 1 → 0 → 1`
   - 2 Players (Non-adjacent Seats 0 and 2): `0 → 2 → 0 → 2`
   - 3 Players (Seats 0, 1, 2): `0 → 1 → 2 → 0` (Seat 3 skipped)
   - 4 Players: `0 → 1 → 2 → 3 → 0`
10. **Victory Condition**: The first player whose 4 tokens all reach `home, progress: 6` is declared the winner (`status: 'finished'`).

---

## 5. Technical Decision: Replacing 3D with 2D Top-Down Board

### Critique of the Existing 3D Implementation (`Three.js` / `@react-three/fiber`)
The original 3D prototype suffered from significant UX and technical liabilities:
- **Perspective Distortion**: Angled 3D projection distorted the far quadrant cells relative to near quadrant cells, making cell distances hard to judge.
- **Touch & Gesture Conflicts**: Mobile users attempting to pan or tap tokens constantly triggered OrbitControls camera rotation instead of token selection.
- **Camera Viewport Clipping**: On portrait mobile screens, board corners were cropped unless elevated camera hacks and high FOV angles were applied.
- **Mobile GPU Overhead**: WebGL rendering with real-time shadow maps and high pixel ratios drained mobile batteries and caused thermal throttling on mid-tier phones.
- **Excessive Bundle Footprint**: Three.js and `@react-three/fiber` accounted for over 1.1 MB of compressed JavaScript bundle size.

### Advantages of the New 2D Vector Direction
- **True Top-Down Clarity**: 100% geometric parity with physical Ludo boards. Every cell, base, and home lane is uniformly visible and unmistakable.
- **Flawless Responsive Scaling**: Built with an SVG coordinate matrix (`viewBox="0 0 1500 1500"`), the board scales infinitely from 360px mobile viewports to 4K ultra-wide monitors without pixelation or clipping.
- **Pixel-Perfect Touch Hitboxes**: Every token and cell possesses an explicit, accessible 44px+ bounding box for zero-miss mobile touch selection.
- **Ultra-Lightweight & Instantaneous**: Native SVG/CSS/Canvas rendering boots in milliseconds with zero WebGL initialization overhead.
- **Aesthetic Distinction**: Allows a sophisticated, illustrated, flat digital board-game look with subtle depth shadows, avoiding cheap 3D video game clichés.
