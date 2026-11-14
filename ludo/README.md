# LUDO Monorepo Workspace

This directory is the canonical monorepo workspace for the LUDO project.

## Workspaces
- `packages/game-engine`: Deterministic game rules and logic.
- `apps/server`: Authoritative Node.js + Express + Socket.IO server.
- `apps/web`: React + Vite + Three.js / React Three Fiber client.

## Commands
```bash
# Run tests
pnpm test          # Game engine tests
pnpm test:server   # Server integration, sync, & persistence tests
pnpm test:all      # All tests

# Build all packages
pnpm -r build

# Start dev mode
pnpm dev
```
