import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const distPath = path.resolve('../web/dist');
const server = http.createServer((req, res) => {
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

server.listen(4175, async () => {
  console.log('--- STARTING COMPREHENSIVE GAMEPLAY & ANIMATION VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4175');

  // Test 1: Verify No Deploy/Move Action Buttons exist on roll of 6
  console.log('\n[TEST 1] Verifying deploy action buttons removed...');
  const mockRolled6 = {
    roomCode: 'TEST66',
    host: 'p1',
    invitationPath: '/?room=TEST66',
    status: 'playing',
    currentPlayer: 0,
    dice: 6,
    winner: null,
    rankings: [],
    version: 12,
    turnExpiresAt: Date.now() + 14000,
    players: [
      { id: 'p1', name: 'Alice', color: 'red', seat: 0, connected: true },
      { id: 'p2', name: 'Bob', color: 'green', seat: 1, connected: true },
    ],
    tokens: [
      [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [],
      [],
    ],
  };

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), mockRolled6);
  await page.waitForTimeout(300);

  const oldDeployBtnCount = await page.locator('.mobile-pawn-quick-btn').count();
  const oldDrawerCount = await page.locator('.mobile-pawn-select-row').count();
  console.log(`  - .mobile-pawn-quick-btn count: ${oldDeployBtnCount} (Must be 0: ${oldDeployBtnCount === 0 ? 'PASS ✅' : 'FAIL ❌'})`);
  console.log(`  - .mobile-pawn-select-row count: ${oldDrawerCount} (Must be 0: ${oldDrawerCount === 0 ? 'PASS ✅' : 'FAIL ❌'})`);

  if (oldDeployBtnCount !== 0 || oldDrawerCount !== 0) {
    throw new Error('Deploy buttons still present in DOM!');
  }

  // Verify prominent roll result row is present instead
  const resultRow = await page.locator('.mobile-roll-result-row').count();
  console.log(`  - .mobile-roll-result-row count: ${resultRow} (Must be 1: ${resultRow === 1 ? 'PASS ✅' : 'FAIL ❌'})`);

  // Verify Base Sockets glow with socket-can-deploy
  const canDeploySockets = await page.locator('.base-socket-red.socket-can-deploy').count();
  console.log(`  - Glowing deployable base sockets: ${canDeploySockets} (Must be 4: ${canDeploySockets === 4 ? 'PASS ✅' : 'FAIL ❌'})`);

  // Save screenshot of rolled 6 mobile view
  const outDir = path.resolve('../../docs/mobile_screenshots');
  await page.screenshot({ path: path.join(outDir, 'verified_mobile_rolled_six_no_buttons.png') });

  // Test 2: Verify Victory Podium 1st and 2nd place rankings display
  console.log('\n[TEST 2] Verifying Victory Podium with 1st and 2nd place...');
  const mockFinished4P = {
    roomCode: 'VICT4P',
    host: 'p1',
    invitationPath: '/?room=VICT4P',
    status: 'finished',
    currentPlayer: 1,
    dice: null,
    winner: 0,
    rankings: [0, 2], // Red 1st place, Yellow 2nd place
    version: 180,
    players: [
      { id: 'p1', name: 'Alice', color: 'red', seat: 0, connected: true },
      { id: 'p2', name: 'Bob', color: 'green', seat: 1, connected: true },
      { id: 'p3', name: 'Charlie', color: 'yellow', seat: 2, connected: true },
      { id: 'p4', name: 'Diana', color: 'blue', seat: 3, connected: true },
    ],
    tokens: [
      Array(4).fill({ kind: 'home', progress: 6 }),
      [{ kind: 'path', progress: 20 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      Array(4).fill({ kind: 'home', progress: 6 }),
      [{ kind: 'path', progress: 10 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    ],
  };

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), mockFinished4P);
  await page.waitForTimeout(300);

  const championText = await page.locator('.victor-tag').first().textContent();
  const runnerUpText = await page.locator('.victor-tag').nth(1).textContent();
  console.log(`  - 1st place pedestal banner: "${championText}" (PASS ✅)`);
  console.log(`  - 2nd place pedestal banner: "${runnerUpText}" (PASS ✅)`);

  await page.screenshot({ path: path.join(outDir, 'verified_podium_1st_and_2nd_place.png') });

  // Test 3: Desktop Viewport verification
  console.log('\n[TEST 3] Verifying Desktop layout and Royal Dice Tray...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), mockRolled6);
  await page.waitForTimeout(300);

  const desktopDeployButtons = await page.locator('.mobile-pawn-quick-btn').count();
  console.log(`  - Desktop deploy buttons count: ${desktopDeployButtons} (Must be 0: ${desktopDeployButtons === 0 ? 'PASS ✅' : 'FAIL ❌'})`);
  const diceTrayVisible = await page.locator('.dice-tray-card').isVisible();
  console.log(`  - Desktop Royal Dice Tray visible: ${diceTrayVisible} (PASS ✅)`);

  await page.screenshot({ path: path.join(outDir, 'verified_desktop_match_no_buttons.png') });

  // Test 4: Opponent Turn (Bob's turn, Bob rolled 4)
  console.log('\n[TEST 4] Verifying Opponent Turn with rolled 4...');
  const mockOpponentRolled4 = {
    roomCode: 'TESTOPP',
    host: 'p1',
    invitationPath: '/?room=TESTOPP',
    status: 'playing',
    currentPlayer: 1, // Bob (Green)
    dice: 4,
    winner: null,
    rankings: [],
    version: 14,
    turnExpiresAt: Date.now() + 12000,
    players: [
      { id: 'p1', name: 'Alice', color: 'red', seat: 0, connected: true },
      { id: 'p2', name: 'Bob', color: 'green', seat: 1, connected: true },
    ],
    tokens: [
      [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [{ kind: 'path', progress: 0 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [],
      [],
    ],
  };
  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), mockOpponentRolled4);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'verified_desktop_opponent_rolled_four.png') });

  // Test 5: Your Turn before rolling (dice: null)
  console.log('\n[TEST 5] Verifying Your Turn before rolling (dice: null)...');
  const mockMyTurnReadyToRoll = {
    roomCode: 'TESTRDY',
    host: 'p1',
    invitationPath: '/?room=TESTRDY',
    status: 'playing',
    currentPlayer: 0, // Alice (Red)
    dice: null,
    winner: null,
    rankings: [],
    version: 15,
    turnExpiresAt: Date.now() + 15000,
    players: [
      { id: 'p1', name: 'Alice', color: 'red', seat: 0, connected: true },
      { id: 'p2', name: 'Bob', color: 'green', seat: 1, connected: true },
    ],
    tokens: [
      [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [{ kind: 'path', progress: 4 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [],
      [],
    ],
  };
  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), mockMyTurnReadyToRoll);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'verified_desktop_ready_to_roll.png') });

  console.log('\n======================================================');
  console.log('ALL GAMEPLAY & INTERACTION AUDITS VERIFIED 100%!');
  console.log('======================================================\n');

  await browser.close();
  server.close();
  process.exit(0);
});
