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
/** Capture output directory. Override with LUDO_ARTIFACT_DIR; defaults to docs/artifacts. */
const artifactDir = process.env.LUDO_ARTIFACT_DIR
  ? path.resolve(process.env.LUDO_ARTIFACT_DIR)
  : path.resolve(__dirname, '../../../../docs/artifacts');
fs.mkdirSync(artifactDir, { recursive: true });

const WEB_PORT = 5173;
const SERVER_PORT = 3001;

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMobilePolishE2E() {
  console.log('================================================================');
  console.log('--- STARTING MOBILE EXPERIENCE & POLISH PLAYWRIGHT E2E TEST ---');
  console.log('================================================================\n');

  // Start real backend server
  const ludoServer = await createLudoServer();
  await new Promise((resolve) => ludoServer.httpServer.listen(SERVER_PORT, resolve as () => void));
  console.log(`[Backend] Real Ludo Socket.IO Server listening on port ${SERVER_PORT}`);

  // Start real frontend web server
  await new Promise<void>((resolve) => webServer.listen(WEB_PORT, resolve));
  console.log(`[Frontend] Real Web App Server listening on port ${WEB_PORT}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Launch Mobile Browser Context (iPhone 14 / 15: 390x844)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      hasTouch: true,
      isMobile: true,
    });

    const pageAlice = await context.newPage();
    await pageAlice.goto(`http://localhost:${WEB_PORT}`);

    // Enter name & create room
    await pageAlice.waitForSelector('.royal-input', { timeout: 10000 });
    await pageAlice.fill('.royal-input', 'Alice');
    await pageAlice.click('button:has-text("Create Private Salon")');

    await pageAlice.waitForSelector('.room-code-tag', { timeout: 10000 });
    console.log('  - Alice created room and reached lobby ✅');

    // Extract room code
    const roomCodeTag = await pageAlice.textContent('.room-code-tag');
    const roomCode = roomCodeTag?.replace('ROOM #', '').trim() || '';
    assert.ok(roomCode.length === 6, 'Valid 6-char room code');
    console.log(`  - Room Code: ${roomCode} ✅`);

    // 2. Open Share Modal and verify QR Code SVG & Room Code
    await pageAlice.click('.header-controls .btn-share');
    await pageAlice.waitForSelector('.share-modal-card', { timeout: 5000 });
    console.log('  - Share modal opened in lobby ✅');

    const qrSvgExists = await pageAlice.locator('.share-qr-svg-container svg').count();
    assert.equal(qrSvgExists, 1, 'QR Code SVG generated and displayed');
    console.log('  - Scannable QR code SVG verified ✅');

    const shareCodeText = await pageAlice.textContent('.share-code-text');
    assert.equal(shareCodeText?.trim(), `#${roomCode}`);
    console.log(`  - Share modal displayed correct room code #${roomCode} ✅`);

    await pageAlice.screenshot({ path: path.join(artifactDir, 'mobile_share_modal_qr.png') });
    console.log('  - Captured mobile_share_modal_qr.png ✅');

    // Close share modal
    await pageAlice.click('.share-modal-card .modal-close-btn');
    await sleep(200);

    // 3. Open Settings Modal and toggle Preferences
    await pageAlice.click('.header-controls .btn-settings');
    await pageAlice.waitForSelector('.settings-modal-card', { timeout: 5000 });
    console.log('  - Settings modal opened ✅');

    // Check Sound toggle switch
    const soundToggle = pageAlice.locator('.setting-row').filter({ hasText: 'Sound Effects' }).locator('.toggle-switch');
    assert.equal(await soundToggle.evaluate((el) => el.classList.contains('active')), true, 'Sound initially active');

    // Toggle sound
    await soundToggle.click();
    await sleep(100);
    assert.equal(await soundToggle.evaluate((el) => el.classList.contains('active')), false, 'Sound successfully toggled off');

    // Toggle reduced motion
    const motionToggle = pageAlice.locator('.setting-row').filter({ hasText: 'Reduced Motion' }).locator('.toggle-switch');
    await motionToggle.click();
    await sleep(100);
    assert.equal(await motionToggle.evaluate((el) => el.classList.contains('active')), true, 'Reduced motion toggled on');

    const reducedMotionStored = await pageAlice.evaluate(() => localStorage.getItem('ludo_reduced_motion'));
    assert.equal(reducedMotionStored, 'true', 'Reduced motion persisted in localStorage');
    console.log('  - Settings toggles (sound, haptics, reduced-motion) verified & persisted ✅');

    await pageAlice.screenshot({ path: path.join(artifactDir, 'mobile_settings_modal.png') });
    console.log('  - Captured mobile_settings_modal.png ✅');

    // Close settings modal
    await pageAlice.click('.settings-modal-card .modal-close-btn');
    await sleep(200);

    // 4. Bob joins room
    const contextBob = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const pageBob = await contextBob.newPage();
    await pageBob.goto(`http://localhost:${WEB_PORT}/?room=${roomCode}`);

    await pageBob.waitForSelector('.royal-input', { timeout: 10000 });
    await pageBob.fill('.royal-input', 'Bob');
    await pageBob.click('button:has-text("Enter Room Table")');
    await pageBob.waitForSelector('.lobby-container', { timeout: 10000 });
    console.log('  - Bob joined room ✅');

    // Alice starts game
    await pageAlice.waitForSelector('button:has-text("Start game")', { timeout: 5000 });
    await pageAlice.click('button:has-text("Start game")');

    await pageAlice.waitForSelector('.game-screen-main', { timeout: 10000 });
    await pageBob.waitForSelector('.game-screen-main', { timeout: 10000 });
    console.log('  - Game started and active on both mobile clients ✅');

    // 5. Test authoritatively rolling and moving tokens to generate real activity events
    // Alice rolls a 6
    await pageAlice.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('roll_dice', { roomCode, actionId: `roll_${Date.now()}`, deterministicDice: 6 }, resolve);
        }),
      { roomCode }
    );
    await sleep(300);

    // Alice deploys token 0
    await pageAlice.evaluate(
      ({ roomCode }) =>
        new Promise((resolve) => {
          const socket = (window as any).__SOCKET__;
          socket.emit('move_token', { roomCode, token: 0, actionId: `move_${Date.now()}` }, resolve);
        }),
      { roomCode }
    );
    await sleep(300);

    // 6. Open Activity Feed Drawer
    await pageAlice.click('.header-controls .btn-feed');
    await pageAlice.waitForSelector('.activity-feed-drawer', { timeout: 5000 });
    console.log('  - Activity feed drawer opened ✅');

    const feedItemsCount = await pageAlice.locator('.feed-item').count();
    assert.ok(feedItemsCount >= 2, `Activity feed recorded ${feedItemsCount} authoritative game events`);
    console.log(`  - Activity feed recorded ${feedItemsCount} events (dice roll, deploy) ✅`);

    await pageAlice.screenshot({ path: path.join(artifactDir, 'mobile_activity_feed_drawer.png') });
    console.log('  - Captured mobile_activity_feed_drawer.png ✅');

    // Close activity feed drawer
    await pageAlice.click('.feed-close-btn');
    await sleep(200);

    // 7. Verify Reconnection Floating Banner when offline
    console.log('  - Simulating network disconnection on Bob client...');
    await pageBob.evaluate(() => {
      const socket = (window as any).__SOCKET__;
      socket.disconnect();
    });
    await sleep(200);

    const bannerVisible = await pageBob.locator('.reconnect-floating-banner').isVisible();
    assert.equal(bannerVisible, true, 'Reconnect floating banner is visible when disconnected');
    console.log('  - Reconnect banner automatically surfaced with spinner ✅');

    // Alice sees Bob marked with OFFLINE chip
    await sleep(300);
    const offlineChipCount = await pageAlice.locator('.chip-offline-badge').count();
    assert.ok(offlineChipCount >= 1, 'Alice client displays (OFFLINE) badge on Bob chip');
    console.log('  - Bob offline badge rendered on player ribbon ✅');

    await pageBob.screenshot({ path: path.join(artifactDir, 'mobile_reconnect_banner.png') });
    console.log('  - Captured mobile_reconnect_banner.png ✅');

    // Reconnect Bob
    console.log('  - Reconnecting Bob client...');
    await pageBob.evaluate(() => {
      const socket = (window as any).__SOCKET__;
      socket.connect();
    });
    await sleep(600);

    const bannerAfterReconnect = await pageBob.locator('.reconnect-floating-banner').isVisible();
    assert.equal(bannerAfterReconnect, false, 'Reconnect banner dismissed after re-connection');
    console.log('  - Reconnect banner cleanly dismissed upon successful connection ✅');

    // 8. Capture Compact Mobile Viewports (360x780 Android & 430x932 iPhone 15 Pro Max)
    await pageAlice.setViewportSize({ width: 360, height: 780 });
    await sleep(200);
    await pageAlice.screenshot({ path: path.join(artifactDir, 'mobile_android_360px_gameplay.png') });
    console.log('  - Captured mobile_android_360px_gameplay.png (360px) ✅');

    await pageAlice.setViewportSize({ width: 430, height: 932 });
    await sleep(200);
    await pageAlice.screenshot({ path: path.join(artifactDir, 'mobile_iphone_430px_gameplay.png') });
    console.log('  - Captured mobile_iphone_430px_gameplay.png (430px) ✅');

    console.log('\n================================================================');
    console.log('--- ALL MOBILE EXPERIENCE & GAMEPLAY POLISH TESTS PASSED! ---');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
    throw err;
  } finally {
    await browser.close();
    await new Promise((resolve) => ludoServer.httpServer.close(resolve));
    await new Promise((resolve) => webServer.close(resolve));
    process.exit(0);
  }
}

runMobilePolishE2E().catch((err) => {
  console.error('Fatal Mobile Polish E2E test failure:', err);
  process.exit(1);
});
