process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.CLIENT_ORIGIN = '*';

import { chromium, type Browser } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import { createLudoServer } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, '../../web/dist');
const mobileOutDir = path.resolve(__dirname, '../../../../docs/mobile_screenshots');
const brainArtifactDir = '/Users/munshijarjisalam/.gemini/antigravity/brain/2ceb4a3f-d798-4612-8298-8cc9b9e896a4';

if (!fs.existsSync(mobileOutDir)) {
  fs.mkdirSync(mobileOutDir, { recursive: true });
}

// Static web server
const webServer = http.createServer((req, res) => {
  let reqUrl = req.url?.split('?')[0] || '/';
  if (reqUrl === '/') reqUrl = '/index.html';
  const filePath = path.join(distPath, reqUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
    };
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(distPath, 'index.html')).pipe(res);
  }
});

const WEB_PORT = 5173;
const SERVER_PORT = 3001;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function copyToBrain(filename: string) {
  const src = path.join(mobileOutDir, filename);
  const dest = path.join(brainArtifactDir, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

async function runQoLE2E() {
  console.log('================================================================');
  console.log('--- STARTING QUALITY OF LIFE UPDATE 2 REAL PLAYWRIGHT E2E ---');
  console.log('================================================================\n');

  // Start real backend server
  const ludoServer = await createLudoServer();
  await new Promise((resolve) => ludoServer.httpServer.listen(SERVER_PORT, resolve as () => void));
  console.log(`[Backend] Real Ludo Socket.IO Server listening on port ${SERVER_PORT}`);

  // Start real frontend web server
  await new Promise((resolve) => webServer.listen(WEB_PORT, resolve as () => void));
  console.log(`[Frontend] Real Web App Server listening on port ${WEB_PORT}`);

  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // =========================================================================
    // PART 1: MOBILE CONTROLS & ROLL 3 MOVEMENT VERIFICATION
    // =========================================================================
    console.log('\n--- PART 1: MOBILE VIEWPORT & CONTROLS AUDIT ---');

    // Context 1: Alice on iPhone (390x844)
    const ctxAlice = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const pAlice = await ctxAlice.newPage();
    pAlice.on('console', (msg) => console.log('[Alice console]', msg.type(), msg.text()));
    pAlice.on('pageerror', (err) => console.log('[Alice pageerror]', err.message));

    // Context 2: Bob on iPhone (390x844)
    const ctxBob = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const pBob = await ctxBob.newPage();
    pBob.on('console', (msg) => console.log('[Bob console]', msg.type(), msg.text()));
    pBob.on('pageerror', (err) => console.log('[Bob pageerror]', err.message));

    // Alice creates room
    await pAlice.goto(`http://localhost:${WEB_PORT}`);
    await pAlice.waitForSelector('.royal-input', { timeout: 10000 });
    await pAlice.fill('.royal-input', 'Alice');
    await pAlice.click('button:has-text("Create Private Salon")');

    await pAlice.waitForSelector('.room-code-tag', { timeout: 10000 });
    const roomCode = await pAlice.evaluate(() => (window as any).__GET_SNAPSHOT__().roomCode);
    console.log(`  - Room created on mobile: ${roomCode}`);

    // Bob joins room
    await pBob.goto(`http://localhost:${WEB_PORT}`);
    await pBob.click('button:has-text("Join with Code")');
    await pBob.fill('input[placeholder="Enter your name"]', 'Bob');
    await pBob.fill('input[placeholder="ROOM CODE"]', roomCode);
    await pBob.click('button:has-text("Enter Room Table")');

    await pAlice.waitForSelector('.lobby-footer-bar:has-text("2/4 Players · 2 Connected")', { timeout: 5000 });
    await pBob.waitForSelector('.lobby-footer-bar:has-text("2/4 Players · 2 Connected")', { timeout: 5000 });
    console.log('  - Both mobile players connected in lobby ✅');

    // Wait for start button to become enabled
    await pAlice.waitForSelector('button:has-text("Start game"):not([disabled])', { timeout: 5000 });
    await sleep(200);
    await pAlice.click('button:has-text("Start game"):not([disabled])');
    await pAlice.waitForSelector('#ludoBoard', { timeout: 8000 });
    await pBob.waitForSelector('#ludoBoard', { timeout: 8000 });
    console.log('  - Game board active on both mobile clients ✅');

    const room = ludoServer.service['rooms'].get(roomCode)!;

    // Verify Mobile Bottom Dock Elements
    await pAlice.waitForSelector('.mobile-bottom-dock', { timeout: 5000 });
    await pAlice.waitForSelector('.mobile-unified-control-card', { timeout: 5000 });
    await pAlice.waitForSelector('.mobile-central-dice-area', { timeout: 5000 });
    await pAlice.waitForSelector('.mobile-prominent-roll-btn', { timeout: 5000 });

    const btnTextAlice = await pAlice.textContent('.mobile-prominent-roll-btn');
    console.log(`  - Alice prompt button text: "${btnTextAlice?.trim()}"`);
    assert.ok(btnTextAlice?.includes('TAP TO ROLL'), 'Must show TAP TO ROLL button');

    const btnTextBob = await pBob.textContent('.mobile-prominent-roll-btn');
    console.log(`  - Bob waiting button text: "${btnTextBob?.trim()}"`);
    assert.ok(btnTextBob?.includes('WAITING FOR'), 'Bob must see WAITING FOR');

    // Screenshot: Mobile Portrait Initial Active Turn
    await pAlice.screenshot({ path: path.join(mobileOutDir, 'mobile_portrait_gameplay.png') });
    copyToBrain('mobile_portrait_gameplay.png');
    console.log('  - Captured mobile_portrait_gameplay.png ✅');

    // Deploy Alice Token 0 with roll 6
    await pAlice.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 6 }, resolve);
        }),
      { roomCode }
    );
    await pAlice.waitForSelector('.base-socket-red.socket-can-deploy', { timeout: 4000 });
    const clickRes = await pAlice.evaluate(() => {
      const el = document.querySelector('.base-socket-red.socket-can-deploy .traditional-pawn-wrapper') as HTMLElement;
      if (!el) return 'NO_PAWN_EL';
      el.click();
      return 'CLICKED_PAWN';
    });
    console.log('pAlice CLICK RESULT:', clickRes);
    await sleep(500);

    assert.deepEqual(room.state.tokens[0][0], { kind: 'path', progress: 0 });
    console.log('  - Alice Token 0 deployed to path cell 0 ✅');

    // Now roll 3: Test Priority 1 (Dice Movement Mathematical Correctness)
    console.log('\n--- VERIFYING ROLL 3 MOVES EXACTLY 3 CELLS ---');
    await pAlice.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 3 }, resolve);
        }),
      { roomCode }
    );
    await sleep(200);

    // Alice moves token 0 via Socket.IO
    await pAlice.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('move_token', { roomCode, token: 0, actionId: `move_alice_${Date.now()}` }, resolve);
        }),
      { roomCode }
    );
    await sleep(800); // Allow hop animation to complete

    // Assert server state progress is exactly 3 (0 + 3 = 3)
    assert.deepEqual(room.state.tokens[0][0], { kind: 'path', progress: 3 });
    assert.equal(room.state.tokens[0][0].progress - 0, 3, 'Must advance exactly 3 cells');
    console.log('  - Roll 3 moved pawn from progress 0 to progress 3 (exact delta === 3) ✅');

    // Screenshot of Mobile Dock during Bob turn
    await pBob.screenshot({ path: path.join(mobileOutDir, 'mobile_unified_bottom_dock_active.png') });
    copyToBrain('mobile_unified_bottom_dock_active.png');
    console.log('  - Captured mobile_unified_bottom_dock_active.png ✅');

    // =========================================================================
    // PART 2: FINISHING BONUS TURN VERIFICATION
    // =========================================================================
    console.log('\n--- PART 2: FINISHING BONUS TURN AUDIT ---');

    // Bob rolls 3 with all pawns in base -> engine auto-passes turn back to Alice
    console.log('  - Bob rolls 3 with base pawns -> auto-passing turn back to Alice...');
    const bobRollAck = await pBob.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode, actionId: `roll_bob_${Date.now()}`, deterministicDice: 3 }, resolve);
        }),
      { roomCode }
    );
    await sleep(400);
    console.log('  - Bob roll ack:', bobRollAck);
    assert.equal(room.state.currentPlayer, 0, 'Turn must return to Alice');

    // Set Alice pawn 0 at home progress 5 directly on the server
    room.state.tokens[0][0] = { kind: 'home', progress: 5 };
    ludoServer.service['emitRoom'](ludoServer.io, room);
    await sleep(300);

    // Alice rolls 1 to bring pawn 0 into Center Goal (progress 6)
    const rollAck = await pAlice.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 1 }, resolve);
        }),
      { roomCode }
    );
    console.log('  - Alice roll 1 ack:', rollAck);
    await sleep(200);

    // Alice moves token 0 into home goal
    const moveAck = await pAlice.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('move_token', { roomCode, token: 0, actionId: `move_alice_home_${Date.now()}` }, resolve);
        }),
      { roomCode }
    );
    console.log('  - Alice move token into home goal ack:', moveAck);
    await sleep(800);

    // Assert server authoritative state
    assert.deepEqual(room.state.tokens[0][0], { kind: 'home', progress: 6 });
    assert.equal(room.state.currentPlayer, 0, 'Must award bonus turn to Alice');
    assert.equal(room.state.dice, null, 'Must allow Alice to roll again');
    assert.equal(room.state.lastNotice?.type, 'extra_turn');
    assert.ok(room.state.lastNotice?.message.includes('Pawn reached home — Bonus turn!'));
    console.log(`  - Server notice emitted: "${room.state.lastNotice?.message}" ✅`);
    console.log(`  - Alice retains turn: currentPlayer === ${room.state.currentPlayer} ✅`);

    // Verify directive in mobile DOM
    const directiveText = await pAlice.textContent('.mobile-control-directive');
    console.log(`  - Alice mobile directive text: "${directiveText?.trim()}"`);
    assert.ok(directiveText?.includes('Bonus turn') || directiveText?.includes('Pawn reached home'), 'Directive must reflect bonus turn');

    // Screenshot of Bonus Turn Banner
    await pAlice.screenshot({ path: path.join(mobileOutDir, 'mobile_bonus_turn_banner.png') });
    copyToBrain('mobile_bonus_turn_banner.png');
    console.log('  - Captured mobile_bonus_turn_banner.png ✅');

    // Capture Tablet and Landscape viewports of the active game
    await pAlice.setViewportSize({ width: 768, height: 1024 });
    await sleep(400);
    await pAlice.screenshot({ path: path.join(mobileOutDir, 'tablet_gameplay.png') });
    copyToBrain('tablet_gameplay.png');
    console.log('  - Captured tablet_gameplay.png ✅');

    await pAlice.setViewportSize({ width: 844, height: 390 });
    await sleep(400);
    await pAlice.screenshot({ path: path.join(mobileOutDir, 'mobile_landscape_gameplay.png') });
    copyToBrain('mobile_landscape_gameplay.png');
    console.log('  - Captured mobile_landscape_gameplay.png ✅');

    // =========================================================================
    // PART 3: 3-PLAYER MATCH TWO-WINNER LIFECYCLE
    // =========================================================================
    console.log('\n--- PART 3: 3-PLAYER MATCH TWO-WINNER LIFECYCLE ---');

    // Create 3-player room
    const pHost = await browser.newPage();
    await pHost.goto(`http://localhost:${WEB_PORT}`);
    await pHost.waitForSelector('.royal-input', { timeout: 10000 });
    await pHost.fill('.royal-input', 'Host3P');
    await pHost.click('button:has-text("Create Private Salon")');
    await pHost.waitForSelector('.room-code-tag', { timeout: 10000 });
    const roomCode3P = await pHost.evaluate(() => (window as any).__GET_SNAPSHOT__().roomCode);

    const pGuest1 = await browser.newPage();
    await pGuest1.goto(`http://localhost:${WEB_PORT}`);
    await pGuest1.click('button:has-text("Join with Code")');
    await pGuest1.fill('input[placeholder="Enter your name"]', 'Guest1');
    await pGuest1.fill('input[placeholder="ROOM CODE"]', roomCode3P);
    await pGuest1.click('button:has-text("Enter Room Table")');

    const pGuest2 = await browser.newPage();
    await pGuest2.goto(`http://localhost:${WEB_PORT}`);
    await pGuest2.click('button:has-text("Join with Code")');
    await pGuest2.fill('input[placeholder="Enter your name"]', 'Guest2');
    await pGuest2.fill('input[placeholder="ROOM CODE"]', roomCode3P);
    await pGuest2.click('button:has-text("Enter Room Table")');

    await pHost.waitForSelector('.lobby-footer-bar:has-text("3/4 Players · 3 Connected")', { timeout: 5000 });
    await pHost.waitForSelector('button:has-text("Start game"):not([disabled])', { timeout: 5000 });
    await sleep(200);
    await pHost.click('button:has-text("Start game"):not([disabled])');
    await pHost.waitForSelector('#ludoBoard', { timeout: 8000 });

    const room3P = ludoServer.service['rooms'].get(roomCode3P)!;
    assert.equal(room3P.state.players.length, 3);

    // Player 0 brings all 4 pawns home
    room3P.state.tokens[0] = [
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 5 },
    ];
    room3P.state.currentPlayer = 0;
    room3P.state.dice = null;

    ludoServer.service['emitRoom'](ludoServer.io, room3P);
    await sleep(300);

    // Player 0 rolls 1 and finishes 4th pawn
    await pHost.evaluate(
      ({ roomCode3P }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode: roomCode3P, actionId: `roll_p0_${Date.now()}`, deterministicDice: 1 }, resolve);
        }),
      { roomCode3P }
    );
    await sleep(200);

    const moveRes1: any = await pHost.evaluate(
      ({ roomCode3P }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('move_token', { roomCode: roomCode3P, token: 3, actionId: `move_p0_${Date.now()}` }, resolve);
        }),
      { roomCode3P }
    );

    assert.equal(moveRes1.ok, true);
    assert.equal(room3P.state.status, 'playing', 'Match must continue after 1st place in 3P game');
    assert.deepEqual(room3P.state.rankings, [0], 'Player 0 is 1st place');
    assert.equal(room3P.state.currentPlayer, 1, 'Turn passes to Player 1');
    console.log('  - 1st place finished! 3-Player Match continues between seats 1 and 2 ✅');

    // Player 0 attempts to roll -> must be rejected
    const illegalRoll: any = await pHost.evaluate(
      ({ roomCode3P }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode: roomCode3P, actionId: `illegal_roll_${Date.now()}`, deterministicDice: 4 }, resolve);
        }),
      { roomCode3P }
    );
    assert.equal(illegalRoll.ok, false);
    console.log('  - Finished Player 0 prevented from rolling ✅');

    // Player 1 finishes all 4 pawns
    room3P.state.tokens[1] = [
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 6 },
      { kind: 'home', progress: 5 },
    ];
    ludoServer.service['emitRoom'](ludoServer.io, room3P);
    await sleep(300);

    await pGuest1.evaluate(
      ({ roomCode3P }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode: roomCode3P, actionId: `roll_p1_${Date.now()}`, deterministicDice: 1 }, resolve);
        }),
      { roomCode3P }
    );
    await sleep(200);

    const moveRes2: any = await pGuest1.evaluate(
      ({ roomCode3P }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('move_token', { roomCode: roomCode3P, token: 3, actionId: `move_p1_${Date.now()}` }, resolve);
        }),
      { roomCode3P }
    );

    assert.equal(moveRes2.ok, true);
    assert.equal(room3P.state.status, 'finished', 'Match finishes when 2nd place finishes in 3P game');
    assert.deepEqual(room3P.state.rankings, [0, 1], 'Rankings are [0, 1]');
    console.log('  - 2nd place finished! Match completed successfully with 2 podium winners ✅');

    console.log('\n================================================================');
    console.log('--- ALL QUALITY OF LIFE UPDATE 2 E2E AUDIT TESTS PASSED! ---');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Caught error in runQoLE2E:', err);
    throw err;
  } finally {
    await browser.close();
    await new Promise((resolve) => ludoServer.httpServer.close(resolve));
    await new Promise((resolve) => webServer.close(resolve));
  }
}

runQoLE2E()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal E2E test failure:', err);
    process.exit(1);
  });
