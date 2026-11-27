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
import { createTable, joinTable } from './helpers/ui-entry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, '../../web/dist');
/** Capture output directory. Override with LUDO_ARTIFACT_DIR; defaults to docs/artifacts. */
const outDir = process.env.LUDO_ARTIFACT_DIR
  ? path.resolve(process.env.LUDO_ARTIFACT_DIR)
  : path.resolve(__dirname, '../../../../docs/artifacts');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Static file server hosting the production web build
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

async function runRealMultiplayerE2E() {
  console.log('================================================================');
  console.log('--- STARTING REAL MULTIPLAYER SOCKET.IO PLAYWRIGHT E2E TESTS ---');
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
    // PART A: REAL 2-PLAYER MATCH (RED & GREEN) - COMPLETE RED PAWN JOURNEY
    // =========================================================================
    console.log('\n--- PART A: REAL 2-PLAYER MULTIPLAYER MATCH (RED & GREEN) ---');

    // Context 1: Alice (Red, Seat 0)
    const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const p0 = await ctx0.newPage();

    // Context 2: Bob (Green, Seat 1)
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const p1 = await ctx1.newPage();

    // Step 1: Alice creates private salon in real browser
    console.log('[Step 1] Alice creates private room via browser UI...');
    await p0.goto(`http://localhost:${WEB_PORT}`);

    // Wait for lobby to render and retrieve room code from real server
    const createdCode = await createTable(p0, 'Alice');
    assert.equal(createdCode.length, 6);
    const roomCode = await p0.evaluate(() => (window as any).__GET_SNAPSHOT__().roomCode);
    console.log(`  - Real room code created: ${roomCode}`);
    assert.equal(roomCode.length, 6);

    // Step 2: Bob joins the room via browser UI
    console.log('[Step 2] Bob joins room via browser UI...');
    await p1.goto(`http://localhost:${WEB_PORT}/?room=${roomCode}`);
    await joinTable(p1, 'Bob', roomCode);

    // Wait for lobby to synchronize 2 connected players across both clients
    await p0.waitForSelector('.lobby-footer-bar:has-text("2/4 Players · 2 Connected")', { timeout: 5000 });
    await p1.waitForSelector('.lobby-footer-bar:has-text("2/4 Players · 2 Connected")', { timeout: 5000 });
    console.log('  - Both real browser clients synchronized 2/2 connected players in lobby ✅');

    // Step 3: Alice (Host) starts match via UI button
    console.log('[Step 3] Alice starts match via real UI button...');
    await p0.click('button:has-text("Start game")');

    // Wait for active 2D Ludo board to render on both browsers
    await p0.waitForSelector('#ludoBoard', { timeout: 8000 });
    await p1.waitForSelector('#ludoBoard', { timeout: 8000 });
    console.log('  - Real 2D Ludo Board rendered on both players screens ✅');

    // Verify initial server state
    const room = ludoServer.service['rooms'].get(roomCode)!;
    assert.equal(room.state.status, 'playing');
    assert.equal(room.state.currentPlayer, 0);
    assert.ok(room.state.tokens[0].every((t) => t.kind === 'base'));

    // Step 4: Alice deploys token 0 with a real roll of 6
    console.log('[Step 4] Alice rolls 6 to deploy token 0...');
    // Real server-authoritative roll via Socket.IO
    await p0.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit(
            'roll_dice',
            { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 6 },
            resolve
          );
        }),
      { roomCode }
    );

    // Wait for roll result and deployable socket glow in the browser DOM
    await p0.waitForSelector('.base-socket-red.socket-can-deploy', { timeout: 4000 });
    console.log('  - Red Yard Socket glowing with .socket-can-deploy ✅');

    // Alice clicks the glowing base socket in the browser UI
    await p0.evaluate(() => {
      const el = (document.querySelector('.base-socket-red.socket-can-deploy .traditional-pawn-wrapper') ||
        document.querySelector('.base-socket-red.socket-can-deploy')) as HTMLElement;
      el?.click();
    });

    // Wait for the deployment flight to settle on the start cell (progress 0)
    await p0.waitForSelector('.track-arm.track-left .cell-red-start .traditional-pawn-wrapper', { timeout: 8000 });
    await p1.waitForSelector('.track-arm.track-left .cell-red-start .traditional-pawn-wrapper', { timeout: 8000 });

    // Assert server authoritative state
    assert.deepEqual(room.state.tokens[0][0], { kind: 'path', progress: 0 });
    assert.equal(room.state.currentPlayer, 0); // Bonus turn for rolling 6!

    // Assert SVG DOM on both players
    const p0Cell0Pawn = await p0.locator('.track-arm.track-left .cell-red-start .traditional-pawn-wrapper').count();
    const p1Cell0Pawn = await p1.locator('.track-arm.track-left .cell-red-start .traditional-pawn-wrapper').count();
    console.log(`  - Alice sees red pawn on start cell 0: ${p0Cell0Pawn === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`  - Bob sees red pawn on start cell 0: ${p1Cell0Pawn === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    assert.equal(p0Cell0Pawn, 1);
    assert.equal(p1Cell0Pawn, 1);

    // Step 5: Advance through outer circuit to Cell 50 (progress 50) using 10 rounds of 5 steps
    console.log('\n[Step 5] Alice advances red pawn across outer circuit to Cell 50 (10 rounds of 5)...');
    for (let r = 1; r <= 10; r++) {
      const targetProg = r * 5;

      // Alice rolls 5 via real Socket.IO
      await p0.evaluate(
        ({ roomCode }) =>
          new Promise((resolve) => {
            const socket = (window as any).__SOCKET__;
            socket.emit(
              'roll_dice',
              { roomCode, actionId: `roll_alice_${Date.now()}`, deterministicDice: 5 },
              resolve
            );
          }),
        { roomCode }
      );
      await sleep(150);

      // Alice moves token 0 via Socket.IO
      await p0.evaluate(
        ({ roomCode }) =>
          new Promise((resolve) => {
            const socket = (window as any).__SOCKET__;
            socket.emit(
              'move_token',
              { roomCode, token: 0, actionId: `move_alice_${Date.now()}` },
              resolve
            );
          }),
        { roomCode }
      );
      await sleep(750); // Allow hop animation to complete

      assert.deepEqual(room.state.tokens[0][0], { kind: 'path', progress: targetProg });

      if (targetProg < 50) {
        // Turn passed to Bob (Seat 1). Bob rolls 3 with all tokens in base -> auto-pass back to Alice!
        assert.equal(room.state.currentPlayer, 1);
        await p1.evaluate(
          ({ roomCode }) =>
            new Promise((resolve) => {
              const socket = (window as any).__SOCKET__;
              socket.emit(
                'roll_dice',
                { roomCode, actionId: `roll_bob_${Date.now()}`, deterministicDice: 3 },
                resolve
              );
            }),
          { roomCode }
        );
        await sleep(300);
        assert.equal(room.state.currentPlayer, 0); // Turn returned to Alice!
      }
    }
    console.log('  - Advanced 50 steps on outer track to progress 50 (Cell 50) ✅');

    // Assert server authoritative state at Cell 50
    assert.deepEqual(room.state.tokens[0][0], { kind: 'path', progress: 50 });
    console.log('  - Server state: Red token at { kind: "path", progress: 50 } ✅');

    // Assert SVG DOM on both players
    // Cell 50 is in .track-left, 2nd row (Row 7), 1st cell
    await p0.waitForSelector('.track-arm.track-left .cell-track:has(.traditional-pawn-wrapper)', { timeout: 8000 });
    await p1.waitForSelector('.track-arm.track-left .cell-track:has(.traditional-pawn-wrapper)', { timeout: 8000 });
    const p0Cell50Pawn = await p0.locator('.track-arm.track-left .cell-track:has(.traditional-pawn-wrapper)').first().count();
    const p1Cell50Pawn = await p1.locator('.track-arm.track-left .cell-track:has(.traditional-pawn-wrapper)').first().count();
    console.log(`  - Alice sees red pawn on junction cell 50: ${p0Cell50Pawn === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`  - Bob sees red pawn on junction cell 50: ${p1Cell50Pawn === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    assert.equal(p0Cell50Pawn, 1);

    // Capture screenshot immediately before home entry
    await p0.screenshot({ path: path.join(outDir, 'real_multiplayer_red_at_cell_50.png') });
    console.log('  - Captured screenshot: real_multiplayer_red_at_cell_50.png 📸');

    // Turn passed to Bob (Seat 1). Bob rolls 4 with all tokens in base -> auto-pass back to Alice!
    console.log('\n[Step 6] Bob rolls without legal moves -> server auto-passes turn back to Alice...');
    await p1.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit(
            'roll_dice',
            { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 4 },
            resolve
          );
        }),
      { roomCode }
    );
    await sleep(300);
    assert.equal(room.state.currentPlayer, 0); // Turn returned to Alice!
    console.log('  - Server auto-passed turn back to Alice ✅');

    // Step 7: Alice rolls 1 and enters Red Home Lane Cell 0 (home progress 1)
    console.log('\n[Step 7] Alice rolls 1 and enters Red Home Lane Cell 0...');
    await p0.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit(
            'roll_dice',
            { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 1 },
            resolve
          );
        }),
      { roomCode }
    );
    await sleep(150);

    // Alice moves token 0 into home lane
    await p0.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit(
            'move_token',
            { roomCode, token: 0, actionId: `move_home_0_${Date.now()}` },
            resolve
          );
        }),
      { roomCode }
    );
    await sleep(750); // Wait for hop animation into home lane

    // Assert server authoritative state
    assert.deepEqual(room.state.tokens[0][0], { kind: 'home', progress: 1 });
    console.log('  - Server authoritative state: Red token at { kind: "home", progress: 1 } ✅');

    // Assert SVG DOM: pawn rendered inside Red Home Lane Cell 0
    await p0.waitForSelector('.cell-red-lane:has(.traditional-pawn-wrapper)', { timeout: 8000 });
    await p1.waitForSelector('.cell-red-lane:has(.traditional-pawn-wrapper)', { timeout: 8000 });
    const p0Home0Pawn = await p0.locator('.cell-red-lane').first().locator('.traditional-pawn-wrapper').count();
    const p1Home0Pawn = await p1.locator('.cell-red-lane').first().locator('.traditional-pawn-wrapper').count();
    console.log(`  - Alice sees red pawn inside first red home lane cell: ${p0Home0Pawn === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`  - Bob sees red pawn inside first red home lane cell: ${p1Home0Pawn === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    assert.equal(p0Home0Pawn, 1);
    assert.equal(p1Home0Pawn, 1);

    // Capture screenshot of home lane entry
    await p0.screenshot({ path: path.join(outDir, 'real_multiplayer_red_entering_home_lane.png') });
    console.log('  - Captured screenshot: real_multiplayer_red_entering_home_lane.png 📸');

    // Step 8: Progress through home runway cells 1, 2, 3, 4
    console.log('\n[Step 8] Alice advances red pawn through home runway steps...');
    for (let hp = 2; hp <= 5; hp++) {
      // Bob auto-passes
      await p1.evaluate(
        ({ roomCode }) =>
          new Promise((resolve) => {
            const socket = (window as any).__SOCKET__;
            socket.emit(
              'roll_dice',
              { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 2 },
              resolve
            );
          }),
        { roomCode }
      );
      await sleep(200);

      // Alice rolls 1
      await p0.evaluate(
        ({ roomCode }) =>
          new Promise((resolve) => {
            const socket = (window as any).__SOCKET__;
            socket.emit(
              'roll_dice',
              { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 1 },
              resolve
            );
          }),
        { roomCode }
      );
      await sleep(150);

      // Alice moves token 0
      await p0.evaluate(
        ({ roomCode, hp }) =>
          new Promise((resolve) => {
            const socket = (window as any).__SOCKET__;
            socket.emit(
              'move_token',
              { roomCode, token: 0, actionId: `move_hp_${hp}_${Date.now()}` },
              resolve
            );
          }),
        { roomCode, hp }
      );
      await sleep(750);

      assert.deepEqual(room.state.tokens[0][0], { kind: 'home', progress: hp });
      const cellIdx = hp - 1;
      await p0
        .waitForFunction(
          (idx) => {
            const cells = document.querySelectorAll('.cell-red-lane');
            return !!cells[idx]?.querySelector('.traditional-pawn-wrapper');
          },
          cellIdx,
          { timeout: 8000 }
        )
        .catch(() => undefined);
      const inLane = await p0.locator('.cell-red-lane').nth(cellIdx).locator('.traditional-pawn-wrapper').count();
      assert.equal(inLane, 1);
      console.log(`  - Red pawn in home lane cell ${cellIdx} (home progress ${hp}): PASS ✅`);
    }

    await p0.screenshot({ path: path.join(outDir, 'real_multiplayer_red_in_home_lane.png') });

    // Step 9: Alice exact finish into Center Goal
    console.log('\n[Step 9] Alice rolls 1 to reach Center Victory Goal...');
    // Bob auto-passes
    await p1.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit(
            'roll_dice',
            { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 4 },
            resolve
          );
        }),
      { roomCode }
    );
    await sleep(200);

    // Alice rolls 1
    await p0.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit(
            'roll_dice',
            { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 1 },
            resolve
          );
        }),
      { roomCode }
    );
    await sleep(150);

    // Alice moves token 0 into goal
    await p0.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit(
            'move_token',
            { roomCode, token: 0, actionId: `move_goal_${Date.now()}` },
            resolve
          );
        }),
      { roomCode }
    );
    await sleep(750);

    assert.deepEqual(room.state.tokens[0][0], { kind: 'home', progress: 6 });
    await p0.waitForSelector('.goal-quadrant-red .traditional-pawn-wrapper', { timeout: 8000 });
    const inGoal = await p0.locator('.goal-quadrant-red .traditional-pawn-wrapper').count();
    console.log(`  - Red pawn in Center Victory Goal: ${inGoal === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    assert.equal(inGoal, 1);
    await p0.screenshot({ path: path.join(outDir, 'real_multiplayer_red_center_goal.png') });

    await ctx0.close();
    await ctx1.close();

    // =========================================================================
    // PART B: REAL 4-PLAYER MULTIPLAYER MATCH (GREEN, YELLOW, BLUE TRANSITIONS)
    // =========================================================================
    console.log('\n--- PART B: REAL 4-PLAYER MATCH (GREEN, YELLOW, BLUE TRANSITIONS) ---');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const pageHost = await ctx.newPage();

    // Create 4-player room
    await pageHost.goto(`http://localhost:${WEB_PORT}`);
    await createTable(pageHost, 'HostP0');
    const code4P = await pageHost.evaluate(() => (window as any).__GET_SNAPSHOT__().roomCode);

    // Connect 3 socket clients for seats 1 (Green), 2 (Yellow), 3 (Blue)
    const { io: connectSocket } = await import('socket.io-client');
    const s1 = connectSocket(`http://127.0.0.1:${SERVER_PORT}`, { auth: { sessionToken: '' } });
    const s2 = connectSocket(`http://127.0.0.1:${SERVER_PORT}`, { auth: { sessionToken: '' } });
    const s3 = connectSocket(`http://127.0.0.1:${SERVER_PORT}`, { auth: { sessionToken: '' } });

    await new Promise((res) => s1.on('connect', res));
    await new Promise((res) => s2.on('connect', res));
    await new Promise((res) => s3.on('connect', res));

    await new Promise((res) => s1.emit('join_room', { roomCode: code4P, name: 'GreenP1' }, res));
    await new Promise((res) => s2.emit('join_room', { roomCode: code4P, name: 'YellowP2' }, res));
    await new Promise((res) => s3.emit('join_room', { roomCode: code4P, name: 'BlueP3' }, res));

    await pageHost.waitForSelector('.lobby-footer-bar:has-text("4/4 Players · 4 Connected")');
    console.log('  - Real 4-player lobby ready with 4 connected players ✅');

    // Host starts match
    await pageHost.click('button:has-text("Start game")');
    await pageHost.waitForSelector('#ludoBoard');
    console.log('  - 4-Player match active on board ✅');

    const room4 = ludoServer.service['rooms'].get(code4P)!;

    // --- GREEN (Seat 1): Deploy on 13, advance 50 steps to Cell 11, enter Green Home Lane ---
    console.log('\n[Green Test] Deploying Green, advancing 50 steps to Cell 11, entering Green Home Lane...');
    // Deploy Green
    room4.state.currentPlayer = 1;
    await new Promise((res) => s1.emit('roll_dice', { roomCode: code4P, deterministicDice: 6 }, res));
    await new Promise((res) => s1.emit('move_token', { roomCode: code4P, token: 0 }, res));
    assert.deepEqual(room4.state.tokens[1][0], { kind: 'path', progress: 0 }); // Cell 13
    await sleep(100);

    // Advance 50 steps: 10 rounds of 5
    for (let i = 0; i < 10; i++) {
      room4.state.currentPlayer = 1;
      room4.state.dice = null;
      await new Promise((res) => s1.emit('roll_dice', { roomCode: code4P, deterministicDice: 5 }, res));
      await new Promise((res) => s1.emit('move_token', { roomCode: code4P, token: 0 }, res));
      await sleep(100);
    }
    assert.deepEqual(room4.state.tokens[1][0], { kind: 'path', progress: 50 }); // Cell 11!

    // Roll 1 to enter Green Home Lane Cell 0
    room4.state.currentPlayer = 1;
    room4.state.dice = null;
    await new Promise((res) => s1.emit('roll_dice', { roomCode: code4P, deterministicDice: 1 }, res));
    await new Promise((res) => s1.emit('move_token', { roomCode: code4P, token: 0 }, res));
    assert.deepEqual(room4.state.tokens[1][0], { kind: 'home', progress: 1 });
    await sleep(750);

    await pageHost.waitForSelector('.cell-green-lane .traditional-pawn-wrapper', { timeout: 8000 });
    const greenInHome = await pageHost.locator('.cell-green-lane .traditional-pawn-wrapper').count();
    console.log(`  - Green pawn inside first green home lane cell: ${greenInHome === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    assert.equal(greenInHome, 1);
    await pageHost.screenshot({ path: path.join(outDir, 'real_multiplayer_green_entering_home_lane.png') });

    // --- YELLOW (Seat 2): Deploy on 26, advance 50 steps to Cell 24, enter Yellow Home Lane ---
    console.log('\n[Yellow Test] Deploying Yellow, advancing 50 steps to Cell 24, entering Yellow Home Lane...');
    room4.state.currentPlayer = 2;
    room4.state.dice = null;
    await new Promise((res) => s2.emit('roll_dice', { roomCode: code4P, deterministicDice: 6 }, res));
    await new Promise((res) => s2.emit('move_token', { roomCode: code4P, token: 0 }, res));
    assert.deepEqual(room4.state.tokens[2][0], { kind: 'path', progress: 0 }); // Cell 26
    await sleep(100);

    for (let i = 0; i < 10; i++) {
      room4.state.currentPlayer = 2;
      room4.state.dice = null;
      await new Promise((res) => s2.emit('roll_dice', { roomCode: code4P, deterministicDice: 5 }, res));
      await new Promise((res) => s2.emit('move_token', { roomCode: code4P, token: 0 }, res));
      await sleep(100);
    }
    assert.deepEqual(room4.state.tokens[2][0], { kind: 'path', progress: 50 }); // Cell 24!

    room4.state.currentPlayer = 2;
    room4.state.dice = null;
    await new Promise((res) => s2.emit('roll_dice', { roomCode: code4P, deterministicDice: 1 }, res));
    await new Promise((res) => s2.emit('move_token', { roomCode: code4P, token: 0 }, res));
    assert.deepEqual(room4.state.tokens[2][0], { kind: 'home', progress: 1 });
    await sleep(750);

    await pageHost.waitForSelector('.cell-yellow-lane .traditional-pawn-wrapper', { timeout: 8000 });
    const yellowInHome = await pageHost.locator('.cell-yellow-lane .traditional-pawn-wrapper').count();
    console.log(`  - Yellow pawn inside first yellow home lane cell: ${yellowInHome === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    assert.equal(yellowInHome, 1);
    await pageHost.screenshot({ path: path.join(outDir, 'real_multiplayer_yellow_entering_home_lane.png') });

    // --- BLUE (Seat 3): Deploy on 39, advance 50 steps to Cell 37, enter Blue Home Lane ---
    console.log('\n[Blue Test] Deploying Blue, advancing 50 steps to Cell 37, entering Blue Home Lane...');
    room4.state.currentPlayer = 3;
    room4.state.dice = null;
    await new Promise((res) => s3.emit('roll_dice', { roomCode: code4P, deterministicDice: 6 }, res));
    await new Promise((res) => s3.emit('move_token', { roomCode: code4P, token: 0 }, res));
    assert.deepEqual(room4.state.tokens[3][0], { kind: 'path', progress: 0 }); // Cell 39
    await sleep(100);

    for (let i = 0; i < 10; i++) {
      room4.state.currentPlayer = 3;
      room4.state.dice = null;
      await new Promise((res) => s3.emit('roll_dice', { roomCode: code4P, deterministicDice: 5 }, res));
      await new Promise((res) => s3.emit('move_token', { roomCode: code4P, token: 0 }, res));
      await sleep(100);
    }
    assert.deepEqual(room4.state.tokens[3][0], { kind: 'path', progress: 50 }); // Cell 37!

    room4.state.currentPlayer = 3;
    room4.state.dice = null;
    await new Promise((res) => s3.emit('roll_dice', { roomCode: code4P, deterministicDice: 1 }, res));
    await new Promise((res) => s3.emit('move_token', { roomCode: code4P, token: 0 }, res));
    assert.deepEqual(room4.state.tokens[3][0], { kind: 'home', progress: 1 });
    await sleep(750);

    await pageHost.waitForSelector('.cell-blue-lane .traditional-pawn-wrapper', { timeout: 8000 });
    const blueInHome = await pageHost.locator('.cell-blue-lane .traditional-pawn-wrapper').count();
    console.log(`  - Blue pawn inside first blue home lane cell: ${blueInHome === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    assert.equal(blueInHome, 1);
    await pageHost.screenshot({ path: path.join(outDir, 'real_multiplayer_blue_entering_home_lane.png') });

    // Composite overview with all 4 colors in home lane
    await pageHost.screenshot({ path: path.join(outDir, 'real_multiplayer_all_four_colors_home_lanes.png') });
    console.log('  - Captured composite screenshot: real_multiplayer_all_four_colors_home_lanes.png 📸');

    s1.disconnect();
    s2.disconnect();
    s3.disconnect();
    await ctx.close();

    console.log('\n================================================================');
    console.log('--- ALL REAL MULTIPLAYER E2E HOME-LANE TESTS PASSED 100% ✅ ---');
    console.log('================================================================');
  } catch (err) {
    console.error('E2E TEST RUNNER ERROR:', err);
    await browser.close().catch(() => undefined);
    webServer.close();
    ludoServer.httpServer.close();
    ludoServer.service.close();
    process.exit(1);
  }

  await browser.close().catch(() => undefined);
  webServer.close();
  ludoServer.httpServer.close();
  ludoServer.service.close();
  process.exit(0);
}

runRealMultiplayerE2E().catch((err) => {
  console.error('E2E TEST RUNNER ERROR:', err);
  process.exit(1);
});
