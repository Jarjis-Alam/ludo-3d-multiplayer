# 🎲 LUDO Monorepo Workspace

The canonical monorepo workspace containing the game engine, backend server, and web client.

## 📦 Packages & Applications

| Path | Name | Description |
| :--- | :--- | :--- |
| `packages/game-engine` | `@ludo/game-engine` | Pure TypeScript deterministic Ludo rules engine, state transitions, legal move validator, and podium ranking logic. |
| `apps/server` | `@ludo/server` | Authoritative Node.js + Express + Socket.IO server with atomic action queues, turn timer orchestration, and PostgreSQL / Supabase persistence. |
| `apps/web` | `@ludo/web` | Mobile-first React 18 + Vite frontend featuring Royal Arena 2D styling, enamel pawns, GPU movement interpolation, and tactile audio. |

---

## 🛠️ Monorepo Scripts

```bash
# Run unit & integration tests
pnpm test          # Game engine rules tests (48 tests)
pnpm test:server   # Server integration, netcode sync, & persistence tests (26 tests)
pnpm test:all      # All packages test suite (74 tests)

# Build all packages (game-engine, web, server)
pnpm build

# Launch development environment (server on :3001, web client on :5173)
pnpm dev

# QA & Simulation Suites
pnpm qa:players    # Dynamic 2, 3, & 4-player seat rotation verification
pnpm --filter @ludo/server exec tsx test/e2e-quality-of-life.mts # Playwright real multiplayer E2E
pnpm --filter @ludo/server exec tsx test/run-20-matches.mts     # 20-match Monte Carlo simulation
```

For the complete project overview, visual showcase, and deployment guide, see the root [README.md](../README.md).
