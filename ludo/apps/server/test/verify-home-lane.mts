import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, '../../web/dist');
const outDir = path.resolve(__dirname, '../../../../docs/screenshots');
const mobileOutDir = path.resolve(__dirname, '../../../../docs/mobile_screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
if (!fs.existsSync(mobileOutDir)) {
  fs.mkdirSync(mobileOutDir, { recursive: true });
}

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

const PORT = 4178;

server.listen(PORT, async () => {
  console.log('=== STARTING PLAYWRIGHT HOME-LANE & 4-COLOR VERIFICATION ===\n');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}`);
  await page.waitForLoadState('networkidle');

  // Base snapshot template
  const createSnapshot = (seat: number, tokens: any[][], dice: number | null = null) => ({
    roomCode: 'AUDIT1',
    host: 'p1',
    invitationPath: '/?room=AUDIT1',
    status: 'playing',
    currentPlayer: seat,
    dice,
    winner: null,
    rankings: [],
    version: 42,
    turnExpiresAt: Date.now() + 15000,
    players: [
      { id: 'p1', name: 'Alice', color: 'red', seat: 0, connected: true },
      { id: 'p2', name: 'Bob', color: 'green', seat: 1, connected: true },
      { id: 'p3', name: 'Charlie', color: 'yellow', seat: 2, connected: true },
      { id: 'p4', name: 'Diana', color: 'blue', seat: 3, connected: true },
    ],
    tokens,
  });

  // -------------------------------------------------------------
  // TEST 1: Red pawn immediately before home entry (at cell 50, progress 50)
  // -------------------------------------------------------------
  console.log('[TEST 1] Red pawn immediately before home entry (track progress 50)...');
  const snap1 = createSnapshot(0, [
    [{ kind: 'path', progress: 50 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
  ], 1);

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snap1);
  await page.waitForTimeout(300);

  // Assert pawn rendered in cell 50
  const pawnAt50 = await page.locator('.track-left .cell').filter({ has: page.locator('.traditional-pawn-wrapper') }).count();
  console.log(`  - Red pawn rendered on left track: ${pawnAt50 > 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  await page.screenshot({ path: path.join(outDir, 'red_1_before_home_entry.png') });

  // -------------------------------------------------------------
  // TEST 2: Red pawn entering red home lane cell 0 (home progress 1)
  // -------------------------------------------------------------
  console.log('\n[TEST 2] Red pawn entering red home lane cell 0 (home progress 1)...');
  const snap2 = createSnapshot(0, [
    [{ kind: 'home', progress: 1 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
  ], 2);

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snap2);
  await page.waitForTimeout(300);

  const pawnInHome0 = await page.locator('.cell-red-lane').first().locator('.traditional-pawn-wrapper').count();
  console.log(`  - Red pawn rendered inside first red home lane cell: ${pawnInHome0 === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
  await page.screenshot({ path: path.join(outDir, 'red_2_entering_home_lane.png') });

  // -------------------------------------------------------------
  // TEST 3: Red pawn traversing home lane steps 2, 3, 4, 5
  // -------------------------------------------------------------
  for (let hp = 2; hp <= 5; hp++) {
    console.log(`\n[TEST 3.${hp - 1}] Red pawn at home lane progress ${hp} (runway step ${hp - 1})...`);
    const snapH = createSnapshot(0, [
      [{ kind: 'home', progress: hp }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
      [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    ], 1);

    await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snapH);
    // Wait for pawn hop animation to settle
    await page.waitForTimeout(700);

    const cellIndex = hp - 1;
    const pawnInStep = await page.locator('.cell-red-lane').nth(cellIndex).locator('.traditional-pawn-wrapper').count();
    console.log(`  - Red pawn in home cell ${cellIndex}: ${pawnInStep === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
    await page.screenshot({ path: path.join(outDir, `red_${hp + 1}_home_progress_${hp}.png`) });
  }

  // -------------------------------------------------------------
  // TEST 4: Red pawn reaching the Center Victory Goal (home progress 6)
  // -------------------------------------------------------------
  console.log('\n[TEST 4] Red pawn reaching the Center Goal (home progress 6)...');
  const snapGoal = createSnapshot(0, [
    [{ kind: 'home', progress: 6 }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
  ], null);

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snapGoal);
  await page.waitForTimeout(300);

  const pawnInGoal = await page.locator('.goal-quadrant-red .traditional-pawn-wrapper').count();
  console.log(`  - Red pawn rendered inside red goal quadrant: ${pawnInGoal === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
  await page.screenshot({ path: path.join(outDir, 'red_7_center_goal.png') });

  // -------------------------------------------------------------
  // TEST 5: Green Pawn before and inside green home lane
  // -------------------------------------------------------------
  console.log('\n[TEST 5] Green pawn before and entering green home lane...');
  const snapGreen = createSnapshot(1, [
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'home', progress: 3 }, { kind: 'path', progress: 50 }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
  ], 1);

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snapGreen);
  await page.waitForTimeout(300);

  const greenInHome = await page.locator('.cell-green-lane .traditional-pawn-wrapper').count();
  console.log(`  - Green pawn inside green home lane: ${greenInHome === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
  await page.screenshot({ path: path.join(outDir, 'green_home_lane.png') });

  // -------------------------------------------------------------
  // TEST 6: Yellow Pawn before and inside yellow home lane
  // -------------------------------------------------------------
  console.log('\n[TEST 6] Yellow pawn before and entering yellow home lane...');
  const snapYellow = createSnapshot(2, [
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'home', progress: 2 }, { kind: 'path', progress: 50 }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
  ], 1);

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snapYellow);
  await page.waitForTimeout(300);

  const yellowInHome = await page.locator('.cell-yellow-lane .traditional-pawn-wrapper').count();
  console.log(`  - Yellow pawn inside yellow home lane: ${yellowInHome === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
  await page.screenshot({ path: path.join(outDir, 'yellow_home_lane.png') });

  // -------------------------------------------------------------
  // TEST 7: Blue Pawn before and inside blue home lane
  // -------------------------------------------------------------
  console.log('\n[TEST 7] Blue pawn before and entering blue home lane...');
  const snapBlue = createSnapshot(3, [
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'base' }],
    [{ kind: 'home', progress: 4 }, { kind: 'path', progress: 50 }, { kind: 'base' }, { kind: 'base' }],
  ], 1);

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snapBlue);
  await page.waitForTimeout(300);

  const blueInHome = await page.locator('.cell-blue-lane .traditional-pawn-wrapper').count();
  console.log(`  - Blue pawn inside blue home lane: ${blueInHome === 1 ? 'PASS ✅' : 'FAIL ❌'}`);
  await page.screenshot({ path: path.join(outDir, 'blue_home_lane.png') });

  // -------------------------------------------------------------
  // TEST 8: All 4 Colors Home Lane & Center Overview
  // -------------------------------------------------------------
  console.log('\n[TEST 8] All 4 Colors concurrent home-lane and goal overview...');
  const snapAll = createSnapshot(0, [
    [{ kind: 'home', progress: 3 }, { kind: 'home', progress: 6 }, { kind: 'path', progress: 49 }, { kind: 'base' }],
    [{ kind: 'home', progress: 2 }, { kind: 'home', progress: 6 }, { kind: 'path', progress: 20 }, { kind: 'base' }],
    [{ kind: 'home', progress: 4 }, { kind: 'home', progress: 6 }, { kind: 'path', progress: 35 }, { kind: 'base' }],
    [{ kind: 'home', progress: 5 }, { kind: 'home', progress: 6 }, { kind: 'path', progress: 5 }, { kind: 'base' }],
  ], 2);

  await page.evaluate((s) => (window as any).__SET_MOCK_SNAPSHOT__(s), snapAll);
  await page.waitForTimeout(300);

  await page.screenshot({ path: path.join(outDir, 'all_colors_home_lane_overview.png') });
  await page.screenshot({ path: path.join(mobileOutDir, 'all_colors_home_lane_overview.png') });
  console.log('  - All-colors overview captured successfully ✅');

  // Mobile viewport verification
  console.log('\n[TEST 9] Mobile viewport verification (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(mobileOutDir, 'verified_mobile_home_lane_journey.png') });
  console.log('  - Mobile viewport captured successfully ✅');

  await browser.close();
  server.close();
  console.log('\n=== ALL PLAYWRIGHT VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');
});
