# Engineering Status

Last reviewed: 2026-11-28

This document replaces the earlier internal release-candidate report. It records what the repository
contains, what has actually been verified, and what is still open. Nothing here is a marketing claim:
each line is either something re-run in this repository or something implemented in the code cited.

## Where the project stands

The workspace is a single canonical pnpm monorepo under `ludo/`:

| Area | State |
| :--- | :--- |
| Rules engine (`ludo/packages/game-engine`) | Complete: deployment, movement, captures, safe cells, home lanes, exact finish, bonus turns, ranking. |
| Realtime server (`ludo/apps/server`) | Complete for a single process: rooms, seats, turns, timers, reconnects, optional PostgreSQL persistence. |
| Web client (`ludo/apps/web`) | Complete for landing, lobby, match and victory screens; responsive from 320 px to 1440 px. |
| Deployment | Vercel (static client) + Render (realtime API) + optional Supabase/PostgreSQL, documented in [DEPLOYMENT.md](DEPLOYMENT.md). |

## Verified on this revision

| Check | Command | Result |
| :--- | :--- | :--- |
| Production build | `pnpm build` | Passed — engine, server and client built. |
| Engine rules | `pnpm test:engine` | 48 tests passed (3 files). |
| Server integration, netcode, turn clock, auto-play, persistence | `pnpm test:server` | 37 tests passed (7 files). |
| Combined suite | `pnpm test:all` | 85 tests passed. |
| Layout stability | Browser measurement at 320/360/375/390/430 px | The board's bounding box was identical across turn changes, dice results, long notices, timers crossing zero and automatic-move notices. |
| Mobile scrolling (physical iPhone, Safari) | Manual device run | Home and lobby scroll to their exact maximum; the match screen fits without a scroll container; no horizontal overflow. |
| Pawn flight geometry (physical iPhone, Safari) | Manual device run | Flights started within 0.03 % of the origin cell centre and landed within 0.03 % of the destination cell centre. |

## Implemented but not re-verified in this review

- **Playwright audits** — `test:visual` (8 viewports), `verify-mobile-scroll.mts`, `e2e-quality-of-life.mts`, `e2e-real-multiplayer-home-lane.mts`. They need a production build and `playwright install chromium`; they were not executed during the documentation cleanup.
- **Simulation suites** — `pnpm sim:20` (20 seeded matches) and `test/simulation-100-matches.mts`.
- **PostgreSQL persistence and restart recovery** — `Persistence` implements `saveSession` / `loadSession(s)` and the server reloads rooms and sessions on boot (`game-server.ts`), but this was not exercised against a live database here.
- **Production deployment** — Vercel/Render configuration is committed; no deployment was performed or verified in this review.

## Security posture

- No credentials, API keys or database URLs are committed. `.env.example` contains placeholders only, and a scan of the full Git history found no secret material (only the placeholder example file was ever committed).
- `SESSION_SECRET` is mandatory in production: the server throws at startup when it is missing, shorter than 32 characters, or a known placeholder. Development uses an ephemeral random key, so no signing key is baked into the repository.
- `CLIENT_ORIGIN=*` is rejected when `NODE_ENV=production`; CORS and Socket.IO share the same allow-list.
- Socket actions are rate limited (35 per second per socket by default) and deduplicated by `actionId` per room.
- Test scripts write screenshots to `LUDO_ARTIFACT_DIR` (default `docs/artifacts`, git-ignored) instead of any absolute path.

## Open limitations

1. **Single-process rooms.** Room state lives in the Node process; horizontal scaling needs a shared room store or sticky routing.
2. **Guest identity only.** Sessions are bearer tokens; there are no accounts, password reset or cross-device login.
3. **Persistence is optional.** Without `DATABASE_URL`, an API restart drops rooms and sessions.
4. **Browser coverage.** Verified manually in Chromium and on one physical iPhone (iOS 18.7, Safari 27.2). Landscape phone layout and other browsers are not covered by an automated matrix.
5. **No social features.** No in-match chat, spectators or global leaderboard; the leaderboard entry on the landing page is a placeholder.
6. **Bundle shape.** The client ships as one ~280 kB chunk (87 kB gzip) plus Socket.IO; there is no route-level splitting.
7. **Decorated mock states.** The visual audit drives lobby, match and victory through `__SET_MOCK_SNAPSHOT__`; a mock has no signed-in seat, so the legal-move preview check is skipped there rather than exercised.

## Browser audits

The Playwright audits were moved onto the Rollverse landing page (entry sheet, `.rv-*` hero) and the current victory screen, and now pass against this revision:

| Script | Scope | Result |
| :--- | :--- | :--- |
| `test/verify-homepage-redesign.mts` | Hero copy, board artwork, 320–430 px stacking, entry sheet, room creation | Passed |
| `test/verify-visual-layout.mts` | 933 rendered-geometry checks across 8 viewports (home, lobby, match, victory, pawn motion) | Passed |
| `test/verify-modals-viewport.mts` | Settings, leave confirmation, share/QR and lobby layout across 7 viewports | Passed |
| `test/verify-layout-alignment.mts` | 320–430 px homepage and 2/3/4-player board alignment | Passed |
| `test/e2e-mobile-polish.mts` | Mobile share, settings toggles, gameplay polish | Passed |
| `test/e2e-quality-of-life.mts` | Auto-move, bonus turns, two-podium lifecycle | Passed |
| `test/e2e-real-multiplayer-home-lane.mts` | Two real clients through home lanes to the centre goal | Passed |

They need a production build (`pnpm build`) and one Playwright browser install (`pnpm --dir ludo exec playwright install chromium`). Run them all with `pnpm --dir ludo --filter @ludo/server test:audits`.

## Licence

MIT — see [LICENSE](LICENSE). Every workspace manifest declares `"license": "MIT"`.

## Historical audits

Details behind the behaviour above are kept in:

- [Game Rules Audit](docs/game-rules-audit.md)
- [Gameplay & Animation Audit](docs/gameplay-animation-audit.md)
- [Quality of Life Audit](docs/quality-of-life-audit.md)
- [Mobile UX Audit](ludo/docs/mobile-ux-audit.md)
- [UI/UX Redesign Docs](docs/ui-ux-redesign/)
