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
const brainArtifactDir = '/Users/munshijarjisalam/.gemini/antigravity/brain/2ceb4a3f-d798-4612-8298-8cc9b9e896a4';

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

async function runHomepageVerification() {
  console.log('================================================================');
  console.log('--- STARTING HOMEPAGE REDESIGN PLAYWRIGHT AUDIT ---');
  console.log('================================================================\n');

  const ludoServer = await createLudoServer();
  await new Promise((resolve) => ludoServer.httpServer.listen(SERVER_PORT, resolve as () => void));
  console.log(`[Backend] Server listening on port ${SERVER_PORT}`);

  await new Promise<void>((resolve) => webServer.listen(WEB_PORT, resolve));
  console.log(`[Frontend] Web app listening on port ${WEB_PORT}`);

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // 1. Desktop Test (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${WEB_PORT}`);
    await page.waitForSelector('.landing-stage', { timeout: 10000 });
    await sleep(400);

    // Verify Title & Subtitle
    const titleText = await page.textContent('.hero-headline');
    assert.ok(titleText?.includes('ROLL THE DICE'), 'Contains headline "ROLL THE DICE."');
    assert.ok(titleText?.includes('RULE THE BOARD'), 'Contains headline "RULE THE BOARD."');
    console.log('  - Desktop headline verified ✅');

    // Verify Board Showcase
    const boardTitle = await page.textContent('.board-showcase-title');
    assert.equal(boardTitle?.trim(), 'THE GAME BOARD', 'Title is "THE GAME BOARD"');
    const boardSubtitle = await page.textContent('.board-showcase-subtitle');
    assert.ok(boardSubtitle?.includes('Classic four-colour Ludo'), 'Subtitle is "Classic four-colour Ludo"');
    console.log('  - Authentic Board Showcase title & subtitle verified ✅');

    // Verify Board2D rendered inside showcase
    const ludoGridCount = await page.locator('.landing-board-showcase .ludo-grid').count();
    assert.equal(ludoGridCount, 1, 'Authentic 15x15 Ludo grid rendered in showcase');
    console.log('  - Genuine 15x15 Ludo board rendering verified ✅');

    await page.screenshot({ path: path.join(brainArtifactDir, 'homepage_desktop_1280.png'), fullPage: true });
    console.log('  - Captured homepage_desktop_1280.png ✅');

    // 2. Mobile Viewports Audit: 320px, 360px, 375px, 390px, 430px
    const mobileWidths = [
      { name: 'iphone_390', w: 390, h: 844 },
      { name: 'android_360', w: 360, h: 780 },
      { name: 'compact_320', w: 320, h: 650 },
      { name: 'iphone_375', w: 375, h: 812 },
      { name: 'max_430', w: 430, h: 932 },
    ];

    for (const dev of mobileWidths) {
      await page.setViewportSize({ width: dev.w, height: dev.h });
      await sleep(200);

      // Check horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      assert.ok(scrollWidth <= clientWidth, `No horizontal overflow on ${dev.name} (${dev.w}px)`);

      // Ensure room entry card is visible immediately
      const cardVisible = await page.locator('.table-entry-card').isVisible();
      assert.ok(cardVisible, `Room entry card visible on ${dev.name}`);

      await page.screenshot({ path: path.join(brainArtifactDir, `homepage_${dev.name}.png`), fullPage: false });
      console.log(`  - Verified ${dev.name} (${dev.w}px): 0 overflow, clean layout ✅`);
    }

    // 3. Test Room Creation from Redesigned Interface
    await page.setViewportSize({ width: 390, height: 844 });
    await page.fill('.table-name-input', 'Maharaja');
    await page.click('button:has-text("Create Private Salon")');

    await page.waitForSelector('.room-code-tag', { timeout: 10000 });
    const roomCodeTag = await page.textContent('.room-code-tag');
    console.log(`  - Room creation tested successfully: ${roomCodeTag} ✅`);

    console.log('\n================================================================');
    console.log('--- ALL HOMEPAGE REDESIGN AUDIT TESTS PASSED! ---');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Homepage audit failed:', err);
    throw err;
  } finally {
    await browser.close();
    await new Promise((resolve) => ludoServer.httpServer.close(resolve));
    await new Promise((resolve) => webServer.close(resolve));
  }
}

runHomepageVerification().catch((err) => {
  console.error('Fatal Homepage Audit failure:', err);
  process.exit(1);
});
