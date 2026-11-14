# LUDO — Real-Time Multiplayer 3D Ludo

A zero-budget, server-authoritative 3D multiplayer Ludo web application built with React, Three.js / React Three Fiber, Node.js, Socket.IO, and PostgreSQL.

---

## 🏛️ Repository Architecture

The monorepo located in `./ludo` is the **single source of truth** for all code, packages, and tests.

```text
.
├── package.json               # Root proxy scripts
├── README.md                  # Main project documentation
└── ludo/                      # Canonical monorepo workspace
    ├── pnpm-workspace.yaml    # Monorepo configuration
    ├── package.json           # Monorepo scripts
    ├── apps/
    │   ├── server/            # Node.js + Express + Socket.IO multiplayer backend
    │   └── web/               # React + Vite + Three.js / R3F 3D frontend
    └── packages/
        └── game-engine/       # Pure TypeScript server-authoritative game engine
```

### Packages Overview
- **`@ludo/game-engine`**: Pure deterministic game logic. Handles board paths (52 shared tiles, 4 home lanes of 6 cells), safe cells, token captures, consecutive-six forfeits, winner determination, and monotonic state versioning.
- **`@ludo/server`**: Authoritative Socket.IO and Express server. Features per-room action serialization (`actionTail`), duplicate action suppression via `actionId`, monotonic version guarantees across games and rematches, snapshot resynchronization, rate limiting, room abuse defense, and pluggable persistence (in-memory local or PostgreSQL/Supabase).
- **`@ludo/web`**: Responsive client featuring a 3D board rendered with React Three Fiber and Three.js, animated dice, real-time player status panels, touch-optimized mobile controls, and reconnection support.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js >= 24.x LTS (verified with v24.22.3)
- pnpm >= 9.x
- (Optional) PostgreSQL database for persistent session/room testing

### Install Dependencies
```bash
pnpm --dir ludo install
```

### Run All Tests
```bash
# Run all game engine rules tests
pnpm test:engine

# Run all server integration, deterministic sync, and persistence tests
pnpm test:server

# Run the complete test suite across all workspace packages
pnpm test:all
```

### Run Multiplayer Simulation Suites
```bash
# Run 4-client full match & monotonic rematch verification
pnpm qa

# Run 20 complete randomized 4-client matches with PRNG seeds
pnpm sim:20
```

### Start Development Server
```bash
pnpm dev
```
- Backend starts at `http://localhost:3001`
- Frontend starts at `http://localhost:5173`

Open `http://localhost:5173` in multiple browser windows or devices on your local network to play!

---

## 🔒 State Synchronization & Netcode

- **Authoritative Versioning**: Every state mutation increments the state version monotonically ($v_{t+1} = v_t + 1$), preserved seamlessly across rematches.
- **Action Serialization**: Actions in a room are queued through an asynchronous promise tail to prevent concurrent mutation race conditions.
- **Snapshot Recovery**: Clients detecting a version gap can request an authoritative snapshot (`request_game_state`) to recover without restarting the room.
- **Deduplication**: Actions carry unique IDs; duplicates return cached authoritative results.

---

## 🌐 Production Deployment

See [DEPLOYMENT.md](file:///Users/munshijarjisalam/Documents/Projects/Build%20a%20Real-Time%20Multiplayer%203D%20Ludo%20Game/DEPLOYMENT.md) for the complete step-by-step production deployment guide.

- **Frontend (Static SPA)**: Deploy to **Vercel** with `VITE_SERVER_URL` pointing directly to your Render backend.
- **Backend (Persistent WebSocket Server)**: Deploy to **Render** using the provided `render.yaml` blueprint with persistent WebSockets enabled.
- **Database (PostgreSQL)**: Use **Supabase Free PostgreSQL** with the IPv4 Connection Pooler URI and SSL.
*(Note: Vercel serverless functions cannot host persistent Socket.IO connections).*
