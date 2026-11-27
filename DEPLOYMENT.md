# Production Deployment Guide: LUDO Multiplayer

This guide details the complete procedure for deploying **LUDO** (Real-Time Multiplayer 3D Ludo) to production using free-tier cloud platforms while strictly preserving the server-authoritative real-time netcode and persistence architecture.

---

## 🏗️ Architecture Boundary & Topology

```
┌────────────────────────────────┐         Direct WSS (Socket.IO)         ┌─────────────────────────────────┐
│        Player Browsers         │ ══════════════════════════════════════> │          Render Backend         │
│ (Desktop / Mobile Touchscreens)│ <═════════════════════════════════════ │    (Node.js 24 + Express + WS)  │
└────────────────────────────────┘                                        └────────────────┬────────────────┘
                 │                                                                         │
                 │ HTTP GET (Static SPA Assets)                                            │ TCP (SSL Session Pooler:5432)
                 ▼                                                                         ▼
┌────────────────────────────────┐                                        ┌─────────────────────────────────┐
│         Vercel Edge CDN        │                                        │       Supabase PostgreSQL       │
│      (React + Vite SPA)        │                                        │  (game_rooms + player_sessions) │
└────────────────────────────────┘                                        └─────────────────────────────────┘
```

> [!CAUTION]
> **DO NOT** attempt to deploy the Socket.IO backend to Vercel (e.g., as Serverless Functions or API routes).
> Vercel Serverless Functions are ephemeral, stateless, and terminate after execution. They **cannot** maintain persistent WebSocket connections, in-memory concurrency locks, or monotonic version history (`actionTail`).
> The frontend is hosted on **Vercel** purely as a static SPA, and the browser establishes a **direct WebSocket connection** to the persistent **Render** service using `VITE_SERVER_URL`.

---

## Phase 1 — Supabase PostgreSQL Setup

Supabase hosts the persistent PostgreSQL database storing active room snapshots and guest player session tokens.

### Step 1: Create Supabase Project
1. Sign in to [Supabase](https://supabase.com).
2. Click **New Project**.
3. Choose an organization, enter **Name** (e.g. `ludo-db`), set a strong **Database Password**, and select a region close to your target users (e.g. `us-east-1` to match Render's Oregon/Ohio/Frankfurt regions).
4. Click **Create new project** and wait ~2 minutes for provisioning to finish.

### Step 2: Obtain Connection String (CRITICAL: Session Pooler IPv4)
> [!IMPORTANT]
> **Use the Supabase Session Pooler URI on Port 5432 (IPv4).**
> - **Direct connections** (`db.[project-ref].supabase.co:5432`) resolve strictly via **IPv6** on modern Supabase free projects. Free container runtimes on Render do not have outbound IPv6 connectivity.
> - **Session Pooler vs Transaction Pooler**:
>   - Our backend is a **persistent Node.js process** running 24/7 on Render. It manages its own client connection pool (`pg.Pool` with `max: 5`).
>   - The **Session Pooler (port 5432)** provides standard PostgreSQL session semantics, fully supports DDL statements (`CREATE TABLE IF NOT EXISTS`), and avoids PgBouncer transaction-mode query restrictions and pipeline edge cases.
>   - The **Transaction Pooler (port 6543)** is designed for ephemeral serverless functions (e.g. AWS Lambda) and restricts session-level features.
>   - Therefore, the **Session Pooler on port 5432** is the recommended mode for our Node.js service. It provides reliable IPv4 routing to Render at zero additional cost.

#### How to copy the connection string:
> [!TIP]
> **Do not construct the connection string manually.** Copy it directly from the Supabase dashboard:
1. In the Supabase Dashboard, click the **Settings** (gear icon in left sidebar) -> **Database**.
2. Scroll down to the **Connection string** section.
3. Select the **URI** tab.
4. Set the mode dropdown to **Connection pooler** and select **Session** mode (port `5432`).
5. Click the **Copy** button. The copied string will resemble:
   ```text
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
   ```
6. Replace `[YOUR-PASSWORD]` with your actual database password.
7. **Password URL-Encoding**: If your database password contains special characters (such as `@`, `#`, `$`, `%`, `:`, `!`, `/`), you **MUST** URL-encode them (e.g., `@` becomes `%40`, `#` becomes `%23`). If left unencoded, Node.js connection string parsers will fail to connect.

### Step 3: Run Database Migration
1. In the Supabase Dashboard, click **SQL Editor** (terminal icon in left sidebar).
2. Click **New query**.
3. Copy and paste the contents of [`ludo/apps/server/migrations/001_ludo.sql`](ludo/apps/server/migrations/001_ludo.sql):

```sql
CREATE TABLE IF NOT EXISTS player_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT UNIQUE NOT NULL,
  username VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_rooms (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,
  host_player_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lobby','playing','finished')),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_rooms_updated_at_idx ON game_rooms(updated_at);
CREATE INDEX IF NOT EXISTS player_sessions_token_hash_idx ON player_sessions(session_token_hash);
```
4. Click **Run** (green button). You should see `Success. No rows returned`.

### Step 4: Verify Schema
Run this query in SQL Editor to confirm tables and indexes exist:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
```
*(Note: Even if you skip manual execution, the backend service also executes `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` automatically upon boot).*

---

## Phase 2 — Render Backend Deployment

Render hosts the persistent Node.js Express server running the authoritative Ludo game engine and Socket.IO real-time hub.

### Step 1: Create Web Service
1. Sign in to [Render](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your Git repository containing the LUDO project.

### Step 2: Configure Service Settings
| Field | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `ludo-backend` | Appears in your URL: `https://ludo-backend.onrender.com` |
| **Region** | Closest to Supabase (e.g. `Oregon (US West)` or `Frankfurt`) | Minimizes DB latency |
| **Branch** | `main` | Production branch |
| **Root Directory** | *(leave empty)* | Uses repository root |
| **Runtime** | `Node` | Standard Node runtime |
| **Build Command** | `npm install -g pnpm@9.15.0 && pnpm --dir ludo install --frozen-lockfile && pnpm --dir ludo --filter @ludo/game-engine build && pnpm --dir ludo --filter @ludo/server build` | Installs workspace deps and builds packages |
| **Start Command** | `node ludo/apps/server/dist/index.js` | Runs the compiled server entry point |
| **Instance Type** | `Free` | Zero cost |

> [!NOTE]
> If deploying via **Render Blueprint (`render.yaml`)**, Render will automatically configure all of the above when you select **New +** -> **Blueprint**.

### Step 3: Configure Environment Variables
In the Render dashboard under **Environment**:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security, SSL enforcement, and CORS validation |
| `NODE_VERSION` | `24.22.3` | **Pin to LTS Node 24** |
| `PORT` | `10000` | Port automatically routed by Render |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-[reg].pooler.supabase.com:5432/postgres?sslmode=require` | Supabase IPv4 **Session Pooler** URI |
| `CLIENT_ORIGIN` | `https://your-ludo.vercel.app` | **Exact production frontend origin** (see CORS section below) |
| `SESSION_SECRET` | *(click "Generate", or use `openssl rand -hex 32`)* | HMAC key for hashing player tokens. **At least 32 characters**; the server refuses to start in production without it |

> [!IMPORTANT]
> `SESSION_SECRET` is mandatory in production. The server aborts startup when the value is missing, shorter than 32 characters, or a published placeholder, so a forgotten secret cannot silently sign session tokens with a known key. Local development may omit it: the server then generates an ephemeral key and logs a single warning. Sessions signed with that key end when the process restarts.

### Step 4: Strict CORS Configuration
> [!IMPORTANT]
> **Wildcard `CLIENT_ORIGIN=*` is strictly prohibited and rejected in production.**
> Modern browsers reject WebSocket and HTTP requests with credentials when origin is `*`.
> - **Single Deployed Origin**: `CLIENT_ORIGIN=https://your-ludo.vercel.app`
> - **Dual Origin (Production + Local Development)**: If you also test locally against the deployed backend, provide a comma-separated list:
>   ```text
>   CLIENT_ORIGIN=https://your-ludo.vercel.app,http://localhost:5173
>   ```
> Both Express and Socket.IO strictly validate incoming requests against this allowlist.

### Step 5: Health Check Path
Under **Advanced**:
- **Health Check Path**: `/health`
- Render periodically checks this path. The server returns HTTP 200:
  ```json
  {"ok":true,"service":"ludo-server","version":"0.2.0","minPlayers":2,"maxPlayers":4,"supportedFeatures":["2-4-players","dynamic-seat-skipping","monotonic-versioning"],"persistence":"postgres"}
  ```

### Step 6: Deploy & Verify
1. Click **Create Web Service** (or **Manual Deploy -> Deploy latest commit** if updating an existing service).
2. Wait for the build and deployment logs to display:
   ```
   Ludo server listening on 10000
   ```
3. Test the health endpoint in your browser or terminal:
   ```bash
   curl -i https://ludo-backend.onrender.com/health
   ```
   Confirm HTTP `200 OK`, `"version":"0.2.0"`, `"minPlayers":2`, and `"persistence":"postgres"`. If `"minPlayers"` is missing, Render is running an outdated cached commit and must be redeployed with **Manual Deploy -> Deploy latest commit**.

---

## Phase 3 — Vercel Frontend Deployment

Vercel hosts the static React single-page application.

### Step 1: Import Project to Vercel
1. Sign in to [Vercel](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your Git repository.

### Step 2: Configure Project Settings
> [!IMPORTANT]
> In pnpm monorepos, **DO NOT** set Root Directory to `ludo/apps/web`.
> The `@ludo/web` app imports the shared `@ludo/game-engine` package from `packages/game-engine`. Leaving Root Directory as repository root `.` ensures pnpm has access to the full workspace lockfile and packages.

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Auto-detected |
| **Root Directory** | `./` | Monorepo root |
| **Build Command** | `pnpm --dir ludo --filter @ludo/game-engine build && pnpm --dir ludo --filter @ludo/web build` | Builds engine package, then Vite web app |
| **Output Directory** | `ludo/apps/web/dist` | Location of Vite production build |

*(If you initialized your Git repo directly inside the `ludo/` folder, use Root Directory: `./`, Build Command: `pnpm --filter @ludo/game-engine build && pnpm --filter @ludo/web build`, and Output Directory: `apps/web/dist`).*

### Step 3: Configure Environment Variables
Under **Environment Variables**:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_SERVER_URL` | `https://ludo-backend.onrender.com` | **Your live Render backend URL** (no trailing slash) |

> [!TIP]
> Vite embeds `import.meta.env.VITE_SERVER_URL` into the JavaScript bundle at build time. Whenever you change this variable, trigger a redeployment in Vercel.

### Step 4: Deploy & Sync CORS
1. Click **Deploy**.
2. Once complete, copy your production Vercel URL (e.g. `https://ludo-multiplayer.vercel.app`).
3. Return to the **Render Dashboard** -> `ludo-backend` -> **Environment**, and update `CLIENT_ORIGIN` to your exact Vercel URL:
   ```text
   CLIENT_ORIGIN=https://ludo-multiplayer.vercel.app
   ```
4. Save changes on Render (triggers an automatic zero-downtime redeploy).

---

### Deployment configuration files in this repository

| File | Use when |
| :--- | :--- |
| `vercel.json` (repository root) | **Canonical.** Vercel project root = repository root, which is what the instructions above assume. |
| `ludo/vercel.json` | Only when the Vercel project root is the `ludo/` workspace folder. Build and output paths are relative to it. |
| `ludo/apps/web/vercel.json` | Only when the Vercel project root is `ludo/apps/web`. The engine package is still installed from the workspace above it, so the root layout above remains the safer choice. |
| `render.yaml` (repository root) | **Canonical** Render blueprint for the API. |
| `package.json` / `pnpm-lock.yaml` at the root | Root proxy scripts and dev tooling; the application workspace is `ludo/`. |
| `ludo/package.json` / `ludo/pnpm-lock.yaml` | The workspace itself — both hosting providers install from here (`pnpm --dir ludo install --frozen-lockfile`). |

## Phase 4 — Post-Deployment Verification Test Plan

Execute these 9 tests to verify complete end-to-end functionality in production:

| # | Test | Procedure | Expected Result |
| :--- | :--- | :--- | :--- |
| **1** | **Health Check** | Run `curl -s https://[render-backend]/health` | HTTP 200 with `{"ok":true,"service":"ludo-server","persistence":"postgres"}` |
| **2** | **Frontend Loading** | Open `https://[vercel-frontend]` in desktop browser | Landing page loads with the board preview, create-table and join-with-code entry points. No 404s in DevTools Console. |
| **3** | **WebSocket Connection** | Inspect DevTools Network tab -> Filter `WS` | Single active WebSocket connection to `wss://[render-backend]/socket.io/...` with status `101 Switching Protocols`. |
| **4** | **4-Player Room Creation** | Player 1 clicks "Create Room"; Players 2, 3, 4 open the invite link or enter room code in separate browsers/incognito windows | All 4 seats fill in real-time (`Red`, `Green`, `Yellow`, `Blue`). All players see player names. Start button is enabled for host. |
| **5** | **Match Play & Rule Engine** | Host clicks "Start Match". Players take turns rolling dice and selecting legal tokens | Dice animations synchronize across all 4 screens. Legal tokens highlight; invalid tokens cannot be moved. Turns rotate clockwise. Captures and safe cells execute correctly. |
| **6** | **Monotonic Rematch** | Complete match or trigger rematch | Board resets to starting layout, but authoritative state version strictly increments past previous match version (never resets to 1). |
| **7** | **Browser Refresh Recovery** | Player 2 refreshes their browser mid-game | Player 2 automatically re-joins Seat 1 with their active color without losing match state. Other players briefly see reconnection indicator. |
| **8** | **PostgreSQL Persistence** | In Supabase SQL Editor: `SELECT room_code, status, updated_at FROM game_rooms;` | The active room appears with current snapshot JSON and timestamp. |
| **9** | **Backend Restart Recovery** | In Render Dashboard, click **Manual Deploy** -> **Restart Service** while players are in a match. Once restarted, players take another action or refresh | Match state and session tokens reload from Supabase; game continues from the exact state version without state divergence. |

---

## Phase 5 — Free-Tier Cloud Characteristics & Operational Limits

Be aware of the following platform constraints on free tiers:

### 1. Render Free Web Service
- **Inactivity Spin-Down**: Free web services automatically spin down (sleep) after **15 minutes of zero HTTP/WebSocket traffic**.
- **Cold Start**: When a player visits the app after a spin-down, the first request will take **~50 seconds** while Render spins up the container. Once awake, performance is instant and real-time.
- **Resource Caps**: 512 MB RAM, 0.1 CPU core, and 750 free hours per month (sufficient for a single service running 24/7 in a month).

### 2. Supabase Free Database
- **Auto-Pause**: Free Supabase projects pause after **7 days of zero database activity**. You can unpause from the Supabase dashboard with one click.
- **Connection Limits**: Direct connections are capped at 60 connections; the Session Pooler handles concurrent connections reliably.
- **Storage**: 500 MB database storage (adequate for >50,000 active Ludo room records).

### 3. Vercel Free Hobby Tier
- **Bandwidth**: 100 GB/month.
- **Instant Response**: Zero cold starts for frontend static files served via Vercel's global Anycast Edge CDN.
