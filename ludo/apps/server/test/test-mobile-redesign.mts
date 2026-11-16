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

const mock4pPlaying = {
  roomCode: '9C687B',
  host: 'p1',
  invitationPath: '/?room=9C687B',
  status: 'playing',
  currentPlayer: 0,
  dice: null,
  winner: null,
  version: 24,
  turnExpiresAt: Date.now() + 14000,
  players: [
    { id: 'p1', name: 'Alice', color: 'red', seat: 0, connected: true },
    { id: 'p2', name: 'Bob', color: 'green', seat: 1, connected: true },
    { id: 'p3', name: 'Charlie', color: 'yellow', seat: 2, connected: true },
    { id: 'p4', name: 'Diana', color: 'blue', seat: 3, connected: true },
  ],
  tokens: [
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'path', progress: 8 }, { kind: 'home', progress: 6 }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'path', progress: 3 }, { kind: 'path', progress: 14 }],
    [{ kind: 'base' }, { kind: 'path', progress: 18 }, { kind: 'home', progress: 2 }, { kind: 'home', progress: 6 }],
    [{ kind: 'base' }, { kind: 'base' }, { kind: 'base' }, { kind: 'path', progress: 29 }],
  ],
};

const mock4pRolled6 = {
  ...mock4pPlaying,
  dice: 6,
};

const mock4pLobby = {
  roomCode: '9C687B',
  host: 'p1',
  invitationPath: '/?room=9C687B',
  status: 'lobby',
  currentPlayer: 0,
  dice: null,
  winner: null,
  version: 4,
  players: [
    { id: 'p1', name: 'Alice', color: 'red', seat: 0, connected: true },
    { id: 'p2', name: 'Bob', color: 'green', seat: 1, connected: true },
    { id: 'p3', name: 'Charlie', color: 'yellow', seat: 2, connected: true },
  ],
  tokens: [[], [], [], []],
};

const mock4pFinished = {
  ...mock4pPlaying,
  status: 'finished',
  winner: 0,
};

server.listen(4174, async () => {
  const browser = await chromium.launch({ headless: true });
  const outDir = path.resolve('../../docs/mobile_screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const viewports = [
    { name: '01_small_phone_360x800', width: 360, height: 800, isMobile: true },
    { name: '02_compact_phone_375x812', width: 375, height: 812, isMobile: true },
    { name: '03_standard_phone_390x844', width: 390, height: 844, isMobile: true },
    { name: '04_modern_phone_393x852', width: 393, height: 852, isMobile: true },
    { name: '05_large_phone_430x932', width: 430, height: 932, isMobile: true },
    { name: '06_landscape_phone_844x390', width: 844, height: 390, isMobile: true },
    { name: '07_tablet_portrait_768x1024', width: 768, height: 1024, isMobile: false },
    { name: '08_tablet_landscape_1024x768', width: 1024, height: 768, isMobile: false },
    { name: '09_desktop_1440x900', width: 1440, height: 900, isMobile: false },
  ];

  console.log('--- STARTING MOBILE-FIRST VIEWPORT AUDIT ---');
  let allPassed = true;

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await context.newPage();
    await page.goto('http://localhost:4174');
    await page.waitForTimeout(300);

    // 1. Set 4-Player active game state
    await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mock4pPlaying);
    await page.waitForTimeout(400);

    // Check board square aspect ratio
    const boardBox = await page.locator('.ludo-arena-frame').boundingBox();
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));

    const hasHorizontalOverflow = metrics.scrollWidth > metrics.clientWidth;
    // For mobile portrait & landscape, verify zero vertical overflow
    const hasVerticalOverflow = vp.isMobile && metrics.scrollHeight > metrics.clientHeight + 4;
    const isSquare = boardBox ? Math.abs(boardBox.width - boardBox.height) <= 1.5 : false;

    console.log(`[${vp.name}]`);
    console.log(`  Board Size: ${boardBox?.width.toFixed(1)}px x ${boardBox?.height.toFixed(1)}px (Square: ${isSquare})`);
    console.log(`  Viewport: ${metrics.clientWidth}x${metrics.clientHeight} | Document: ${metrics.scrollWidth}x${metrics.scrollHeight}`);
    console.log(`  Horizontal Overflow: ${hasHorizontalOverflow ? 'FAIL ❌' : 'PASS ✅'}`);
    console.log(`  Vertical Overflow: ${hasVerticalOverflow ? 'FAIL ❌' : 'PASS ✅'}`);

    if (hasHorizontalOverflow || hasVerticalOverflow || !isSquare) {
      allPassed = false;
    }

    // Capture gameplay screenshot
    const shotPath = path.join(outDir, `${vp.name}_gameplay.png`);
    await page.screenshot({ path: shotPath, fullPage: false });

    // 2. Set Rolled 6 state to verify quick-action pawn buttons
    if (vp.isMobile && vp.width < 500) {
      await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mock4pRolled6);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `${vp.name}_rolled_six.png`), fullPage: false });
    }

    await context.close();
  }

  // 3. Test Landing Page, Lobby & Victory Screens on Standard Phone (390x844)
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const phonePage = await phoneContext.newPage();

  // A. Landing Page
  await phonePage.goto('http://localhost:4174');
  await phonePage.waitForTimeout(300);
  await phonePage.screenshot({ path: path.join(outDir, `03_phone_landing_page.png`), fullPage: false });

  // Input font size check to ensure no iOS auto-zoom
  const inputFontSize = await phonePage.evaluate(() => {
    const input = document.querySelector('.royal-input');
    return input ? window.getComputedStyle(input).fontSize : null;
  });
  console.log(`[Landing Page Input Font Size] ${inputFontSize} (>= 16px to prevent iOS auto-zoom: ${parseFloat(inputFontSize || '0') >= 16 ? 'PASS ✅' : 'FAIL ❌'})`);

  // B. Lobby Screen
  await phonePage.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mock4pLobby);
  await phonePage.waitForTimeout(300);
  await phonePage.screenshot({ path: path.join(outDir, `03_phone_lobby_screen.png`), fullPage: false });

  // C. Victory Screen
  await phonePage.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mock4pFinished);
  await phonePage.waitForTimeout(300);
  await phonePage.screenshot({ path: path.join(outDir, `03_phone_victory_screen.png`), fullPage: false });

  await phoneContext.close();
  await browser.close();
  server.close();

  if (allPassed) {
    console.log('\n======================================================');
    console.log('ALL MOBILE VIEWPORT AUDITS PASSED 100% WITH ZERO OVERFLOW!');
    console.log('======================================================');
    process.exit(0);
  } else {
    console.error('\nSOME VIEWPORT AUDITS FAILED! CHECK OUTPUT.');
    process.exit(1);
  }
});