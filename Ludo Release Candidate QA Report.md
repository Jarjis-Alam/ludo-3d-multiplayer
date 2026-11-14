# Ludo Release Candidate QA Report

Date: 2026-11-14

## Executive summary

The automated foundation is green, but this build is **not release-ready**. The short four-client integration suite passes, while the genuine randomized full-match driver stalled after hundreds of actions while waiting for all four clients to receive the next authoritative version. Supabase, browser/device, backend-restart and performance testing were not executed because no real database credentials, deployed environment or browser-device harness was available.

## 1. Automated tests actually executed

| Check | Result |
|---|---|
| Game-engine rule suite | **PASS — 12 tests** |
| Socket.IO integration suite | **PASS — 3 tests** |
| Production builds (`pnpm -r build`) | **PASS — engine, server and web** |
| Local health endpoint | **PASS — HTTP 200; reports `persistence: memory-local`** |

The passing Socket.IO tests cover room creation, four-seat assignment, color assignment, room-full rejection, host-only start, invalid non-active roll, synchronized state and reconnecting to the same seat.

## 2. Four-client complete-match test

A real driver connected four independent Socket.IO clients to the local server, created and filled a room, started the game, used server-generated random dice, selected only engine-reported legal tokens, compared authoritative snapshots across all clients, and attempted a rematch.

Observed result: **FAIL / BLOCKED**. The driver advanced through hundreds of actions, then timed out waiting for all clients to reach the next expected authoritative version. The failure occurred around version 664 during a move by seat 1; the observed client versions regressed/stayed at version 1 in the diagnostic snapshot. The full match therefore cannot be marked passed, and captures, extra turns, triple-six handling, winner declaration and rematch were not validated end-to-end through four live clients.

The engine-level tests for captures, safe cells, consecutive sixes and winner detection do pass, but they are not a substitute for a complete four-client match.

## 3. Reconnection testing

| Scenario | Result |
|---|---|
| Reconnect during the same running server process | **PASS in automated test** |
| Browser refresh during active gameplay | **Not tested in a browser** |
| Temporary network loss | **Not tested** |
| Host disconnect and reassignment | **Not tested end-to-end** |
| Reconnect after backend restart | **Not supported / not passed** |

The current in-memory session map is process-local. Although the SQL migration defines a `player_sessions` table, the persistence adapter does not read or write guest sessions. Restarting the backend loses session identity and prevents reliable seat recovery.

## 4. Database verification

| Check | Result |
|---|---|
| Real Supabase connection | **Not tested — `DATABASE_URL` absent** |
| Migration against PostgreSQL | **Not tested** |
| Room persistence in PostgreSQL | **Not tested** |
| Game snapshot persistence in PostgreSQL | **Not tested** |
| Guest session persistence | **Not implemented in adapter** |
| Recovery after backend restart | **Not passed** |
| Health adapter reporting | **PASS for local fallback** |

No `DATABASE_URL` or `SUPABASE_URL` was available. The health endpoint accurately reported `memory-local` in this environment.

## 5. Security checks

Validated through the automated suite:

- Room-full rejection: **PASS**
- Host-only start: **PASS**
- Non-active player roll rejection: **PASS**
- Invalid dice handling: **PASS at engine/integration level**
- Server-authoritative token movement: **PASS at integration level**

Not yet hardened or fully tested:

- No rate limiting or room-code abuse protection was found.
- No idempotency key or duplicate-event suppression exists for repeated roll/move submissions.
- `SESSION_SECRET` is documented but not used; sessions rely on random bearer tokens held in memory.
- Guest sessions are not persisted despite the migration table.
- Forged action, replay and high-volume abuse tests are not present.

## 6. Browser, device and performance testing

All are **not tested**:

- Desktop browser gameplay
- Tablet layout
- Mobile layout
- Touch token selection
- Dice and token animation frame rate
- Memory consumption
- WebSocket stability over real network conditions
- Four separate physical devices

The production web bundle builds successfully but emits a chunk-size warning: the main JavaScript bundle is approximately 1.15 MB before gzip.

## 7. Deployment readiness

Production build verification: **PASS**.

Not complete:

- No Vercel configuration was found.
- No Render configuration was found.
- Supabase deployment instructions exist only at a basic migration/documentation level.
- No deployed four-client verification was performed.
- No paid service or deployment was initiated.

## Release blockers

1. Investigate and fix the long-running four-client synchronization failure before release.
2. Add a deterministic or robust full-match integration scenario that genuinely reaches winner state and rematch.
3. Implement persistent guest sessions and verify recovery after backend restart.
4. Run the actual Supabase migration and persistence tests with a user-provided Free project.
5. Add duplicate-event, replay, forged-action and room-abuse protections/tests.
6. Complete browser and four-device validation, including mobile touch testing.
7. Add and verify Vercel/Render production configuration before deployment approval.
