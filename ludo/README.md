# Ludo Monorepo Workspace

The canonical pnpm workspace containing the game engine, realtime server and web client for Ludo Royal Arena.

## Packages and applications

| Path | Package | Description |
| :--- | :--- | :--- |
| `packages/game-engine` | `@ludo/game-engine` | Pure, deterministic Ludo rules: legal moves, state transitions, home lanes and podium ranking. |
| `apps/server` | `@ludo/server` | Authoritative Node.js + Express + Socket.IO API with per-room action queues, turn timers and optional PostgreSQL persistence. |
| `apps/web` | `@ludo/web` | Mobile-first React 18 + Vite client implementing the Neo Arcade design system, animated pawns and tactile audio. |

## Scripts

Run the following from this directory (`ludo/`). From the repository root, prefix workspace scripts with `pnpm --dir ludo`.

```bash
# Development — API on :3001, web client on :5173
pnpm dev

# Build the engine, client and server
pnpm build

# Tests
pnpm test           # Game engine rules (48 tests)
pnpm test:server    # Server integration, netcode, turn clock and persistence (29 tests)
pnpm test:all       # Complete workspace suite (77 tests)

# Mobile scrolling & modal lock audit (Playwright, 8 viewports)
pnpm --filter @ludo/server exec tsx test/verify-mobile-scroll.mts

# Responsive visual layout audit (Playwright, 8 viewports, screenshots)
pnpm --filter @ludo/server test:visual

# Real multiplayer end-to-end match (Socket.IO + live browsers)
pnpm --filter @ludo/server exec tsx test/e2e-quality-of-life.mts

# QA and simulation
pnpm qa:players     # 2 / 3 / 4-player rotation and lifecycle checks
pnpm --filter @ludo/server exec tsx test/run-20-matches.mts
```

The visual audit requires the Chromium browser once:

```bash
pnpm exec playwright install chromium
```

Its screenshots are written to `../docs/layout-qa/after/`.

For the project overview, architecture, deployment guide and visual showcase, see the root [README.md](../README.md).
