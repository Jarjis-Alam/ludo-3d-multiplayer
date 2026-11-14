# LUDO — Local multiplayer game

A zero-budget, local-first four-player Ludo implementation. The server is authoritative for rooms, sessions, dice, turns and token positions. Browser storage only retains the guest session token; it is never used as multiplayer state.

## Stack

React + TypeScript + Vite, Three.js / React Three Fiber, Node.js + Express + Socket.IO, Vitest, and an optional Supabase Free PostgreSQL connection prepared through `DATABASE_URL`.

## Run locally

```bash
pnpm install
pnpm test
pnpm dev
```

Open `http://localhost:5173` in up to four separate browser sessions. The current milestone also includes a real React Three Fiber board with 52 cells, four bases, safe cells, home lanes, 16 rendered tokens, clickable legal-token highlighting, animated dice, token interpolation, turn/player panels, victory UI and host-controlled rematches.

## Optional Supabase Free persistence

Set `DATABASE_URL` to a Supabase PostgreSQL connection string before starting the server. The server creates the required `game_rooms` table on startup; the reference migration is also available at `apps/server/migrations/001_ludo.sql`. Without `DATABASE_URL`, local development uses an explicit in-memory adapter so tests and offline development remain zero-budget.

Run the current automated checks with `pnpm test`, `pnpm --filter @ludo/server test` and `pnpm -r build`. The database adapter still needs verification against a real Supabase project, and a complete four-browser match plus backend-restart session recovery remain open in `TODO.md`.

No deployment or paid service is configured by this repository.
