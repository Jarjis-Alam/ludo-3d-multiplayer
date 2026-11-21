process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.CLIENT_ORIGIN = '*';

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import { createLudoServer } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, '../../web/dist');
const brainArtifactDir = '/Users/munshijarjisalam/.gemini/antigravity/brain/2ceb4a3f-d798-4612-8298-8cc9b9e896a4';

const WEB_PORT = 5173;
const SERVER_PORT = 3001;

// Static web server serving dist
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

async function runModalsViewportAudit() {
  console.log('================================================================');
  console.log('--- STARTING COMPREHENSIVE VIEWPORT & MODAL SYSTEM AUDIT ---');
  console.log('================================================================\n');

  const ludoServer = await createLudoServer();
  await new Promise((resolve) => ludoServer.httpServer.listen(SERVER_PORT, resolve as () => void));
  console.log(`[Backend] Socket.IO Server listening on port ${SERVER_PORT}`);

  await new Promise<void>((resolve) => webServer.listen(WEB_PORT, resolve));
  console.log(`[Frontend] Web app listening on port ${WEB_PORT}`);

  const browser = await chromium.launch({ headless: true });

  try {
    const desktopViewports = [
      { name: 'desktop_1440x900', width: 1440, height: 900, isMobile: false },
      { name: 'desktop_1280x720', width: 1280, height: 720, isMobile: false },
      { name: 'desktop_1024x768', width: 1024, height: 768, isMobile: false },
    ];

    const mobileViewports = [
      { name: 'mobile_430x932', width: 430, height: 932, isMobile: true },
      { name: 'mobile_390x844', width: 390, height: 844, isMobile: true },
      { name: 'mobile_375x667', width: 375, height: 667, isMobile: true },
      { name: 'mobile_320x568', width: 320, height: 568, isMobile: true },
    ];

    const allViewports = [...desktopViewports, ...mobileViewports];

    // Helper: test modal bounds and background scroll locking
    async function verifyModalInViewport(
      page: any,
      vp: { name: string; width: number; height: number },
      modalSelector: string,
      modalName: string
    ) {
      await page.waitForSelector(modalSelector, { state: 'visible', timeout: 5000 });
      await sleep(250);

      const bbox = await page.locator(modalSelector).boundingBox();
      assert.ok(bbox, `Modal ${modalName} must have valid bounding box`);

      // Verify modal fits within viewport
      console.log(`    [${modalName}] size: ${Math.round(bbox.width)}x${Math.round(bbox.height)}, pos: (${Math.round(bbox.x)}, ${Math.round(bbox.y)}) in ${vp.width}x${vp.height}`);
      assert.ok(bbox.width <= vp.width, `${modalName} width (${bbox.width}px) exceeds viewport width (${vp.width}px)`);
      assert.ok(bbox.height <= vp.height, `${modalName} height (${bbox.height}px) exceeds viewport height (${vp.height}px)`);
      assert.ok(bbox.y >= 0, `${modalName} top (${bbox.y}px) is off-screen`);
      assert.ok(bbox.y + bbox.height <= vp.height + 2, `${modalName} bottom (${bbox.y + bbox.height}px) extends beyond viewport bottom (${vp.height}px)`);

      // Verify body scroll is locked
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      assert.equal(bodyOverflow, 'hidden', `Body scroll must be locked ('hidden') when ${modalName} is open`);

      // Verify close button is visible and clickable
      const closeBtn = page.locator(`${modalSelector} .modal-close-btn, ${modalSelector} .feed-close-btn`).first();
      assert.ok(await closeBtn.isVisible(), `Close button on ${modalName} must be visible`);

      // Capture screenshot for key viewports
      if (['desktop_1440x900', 'mobile_390x844', 'mobile_320x568'].includes(vp.name)) {
        const shotPath = path.join(brainArtifactDir, `${vp.name}_${modalName}.png`);
        await page.screenshot({ path: shotPath });
        console.log(`    📸 Saved screenshot: ${shotPath}`);
      }
    }

    for (const vp of allViewports) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
      });

      const page = await context.newPage();
      await page.goto(`http://localhost:${WEB_PORT}`);
      await page.waitForSelector('#player-name-input');
      await page.fill('#player-name-input', 'Host');
      await page.click('button:has-text("Create Private Salon")');
      await page.waitForSelector('.room-code-tag');
      const roomCode = (await page.textContent('.room-code-tag'))?.replace('ROOM #', '').trim();

      // 1. Test Settings Modal
      console.log('  1. Opening Settings Modal...');
      await page.click('.btn-settings');
      await verifyModalInViewport(page, vp, '.settings-modal-card', 'settings_modal');

      // 2. Test Leave Table Confirmation inside Settings Modal
      console.log('  2. Testing Leave Confirmation inside Settings...');
      await page.click('.btn-danger-outline');
      await page.waitForSelector('.leave-confirmation-card', { state: 'visible', timeout: 3000 });
      assert.ok(await page.locator('.leave-confirm-actions button:has-text("Yes, Leave")').isVisible());
      assert.ok(await page.locator('.leave-confirm-actions button:has-text("Cancel")').isVisible());

      if (['desktop_1440x900', 'mobile_390x844', 'mobile_320x568'].includes(vp.name)) {
        const leaveShot = path.join(brainArtifactDir, `${vp.name}_leave_confirmation.png`);
        await page.screenshot({ path: leaveShot });
        console.log(`    📸 Saved screenshot: ${leaveShot}`);
      }

      // Close settings modal via close button
      await page.click('.settings-modal-card .modal-close-btn');
      await sleep(200);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Body scroll restored after closing settings');

      // 3. Test QR / Share Modal
      console.log('  3. Opening QR / Share Modal...');
      await page.click('.btn-share');
      await verifyModalInViewport(page, vp, '.share-modal-card', 'share_qr_modal');

      // Verify QR Code SVG fits cleanly inside wrapper
      const qrBox = await page.locator('.share-qr-wrapper').boundingBox();
      const qrSvgBox = await page.locator('.share-qr-svg-container svg').boundingBox();
      assert.ok(qrBox && qrSvgBox, 'QR Code wrapper and SVG must exist');
      console.log(`    [QR Code] wrapper: ${Math.round(qrBox.width)}x${Math.round(qrBox.height)}, svg: ${Math.round(qrSvgBox.width)}x${Math.round(qrSvgBox.height)}`);
      assert.ok(qrSvgBox.width <= qrBox.width + 1 && qrSvgBox.height <= qrBox.height + 1, 'QR SVG must fit entirely inside wrapper');

      // Close share modal
      await page.click('.share-modal-card .modal-close-btn');
      await sleep(200);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Body scroll restored after closing share modal');

      // 4. Test Activity Feed Drawer
      console.log('  4. Opening Activity Feed...');
      await page.click('.activity-feed-toggle-btn');
      await verifyModalInViewport(page, vp, '.activity-feed-drawer', 'activity_feed');

      // Close activity feed
      await page.click('.activity-feed-drawer .feed-close-btn');
      await sleep(200);

      // 5. Test Lobby Layout
      if (['desktop_1440x900', 'mobile_390x844'].includes(vp.name)) {
        console.log('  5. Capturing Lobby Layout...');
        const lobbyBox = await page.locator('.lobby-container').boundingBox();
        assert.ok(lobbyBox && lobbyBox.width <= 760, 'Lobby container max-width constrained properly');
        const lobbyShot = path.join(brainArtifactDir, `${vp.name}_lobby.png`);
        await page.screenshot({ path: lobbyShot });
        console.log(`    📸 Saved screenshot: ${lobbyShot}`);
      }

      await context.close();
    }

    console.log('\n================================================================');
    console.log('🎉 ALL MODALS AND VIEWPORTS (DESKTOP & MOBILE) AUDITED & PASSED!');
    console.log('================================================================\n');
  } finally {
    await browser.close();
    webServer.close();
    ludoServer.httpServer.close();
    ludoServer.io.close();
  }
}

runModalsViewportAudit().catch((err) => {
  console.error('VIEWPORT AUDIT FAILED:', err);
  process.exit(1);
});
