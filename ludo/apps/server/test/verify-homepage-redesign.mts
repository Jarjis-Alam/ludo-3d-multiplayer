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
import { createTable } from './helpers/ui-entry.js';

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

const heroColumns = (page: any) =>
  page.evaluate(() => {
    const el = document.querySelector('.rv-hero');
    if (!el) return 0;
    return window.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length;
  });

async function runHomepageVerification() {
  console.log('================================================================');
  console.log('--- STARTING HOMEPAGE (ROLLVERSE) PLAYWRIGHT AUDIT ---');
  console.log('================================================================\n');

  const ludoServer = await createLudoServer();
  await new Promise((resolve) => ludoServer.httpServer.listen(SERVER_PORT, resolve as () => void));
  console.log(`[Backend] Server listening on port ${SERVER_PORT}`);

  await new Promise<void>((resolve) => webServer.listen(WEB_PORT, resolve));
  console.log(`[Frontend] Web app listening on port ${WEB_PORT}`);

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // 1. Desktop landing (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`http://localhost:${WEB_PORT}`);
    await page.waitForSelector('main.rv-home', { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await sleep(400);

    const titleText = (await page.textContent('.rv-title'))?.replace(/\s+/g, ' ').trim();
    assert.ok(titleText?.includes('Classic Ludo.'), 'Headline reads "Classic Ludo."');
    assert.ok(titleText?.includes('Multiplayer Fun.'), 'Headline accent reads "Multiplayer Fun."');
    console.log('  - Hero headline verified ✅');

    const lede = (await page.textContent('.rv-lede')) ?? '';
    assert.ok(lede.includes('Create private rooms'), 'Description explains private rooms and codes');
    console.log('  - Hero description verified ✅');

    const ctaLabels = await page.locator('.rv-cta-row > button').allTextContents();
    assert.equal(ctaLabels.length, 2, 'Two calls to action render');
    assert.ok(ctaLabels[0].includes('Play Now'), 'Primary call to action is "Play Now"');
    assert.ok(ctaLabels[1].includes('Play with Friends'), 'Secondary call to action is "Play with Friends"');
    console.log('  - Both calls to action verified ✅');

    const navLabels = await page.locator('.rv-nav-item').allTextContents();
    for (const expected of ['Home', 'Play', 'Leaderboard', 'How to Play']) {
      assert.ok(
        navLabels.some((label) => label.includes(expected)),
        `Navigation keeps "${expected}"`
      );
    }
    console.log('  - Header navigation verified ✅');

    // The hero artwork is the real board renderer, not an image.
    const ludoGridCount = await page.locator('.rv-board .ludo-grid').count();
    assert.equal(ludoGridCount, 1, 'The real 15x15 Ludo grid renders in the hero artwork');
    const boardCells = await page.locator('.rv-board .ludo-grid .cell').count();
    assert.ok(boardCells >= 16, `Hero board renders its grid cells (${boardCells})`);
    console.log('  - Genuine 15x15 Ludo board rendering verified ✅');

    const statLabels = await page.locator('.rv-stat').allTextContents();
    assert.equal(statLabels.length, 3, 'Three hero facts render (players, downloads, instant play)');
    console.log('  - Hero stats strip verified ✅');

    assert.equal(await heroColumns(page), 2, 'Desktop hero uses a two-column layout');

    await page.screenshot({ path: path.join(artifactDir, 'homepage_desktop_1440.png'), fullPage: true });
    console.log('  - Captured homepage_desktop_1440.png ✅');

    // 2. Mobile viewports: 320, 360, 375, 390, 430
    const mobileWidths = [
      { name: 'compact_320', w: 320, h: 650 },
      { name: 'android_360', w: 360, h: 780 },
      { name: 'iphone_375', w: 375, h: 812 },
      { name: 'iphone_390', w: 390, h: 844 },
      { name: 'max_430', w: 430, h: 932 },
    ];

    for (const dev of mobileWidths) {
      await page.setViewportSize({ width: dev.w, height: dev.h });
      await sleep(250);

      assert.equal(await heroColumns(page), 1, `Hero collapses to one column on ${dev.name} (${dev.w}px)`);

      const artBelowCopy = await page.evaluate(() => {
        const copy = document.querySelector('.rv-hero-copy')?.getBoundingClientRect();
        const art = document.querySelector('.rv-hero-art')?.getBoundingClientRect();
        if (!copy || !art) return false;
        return art.top >= copy.bottom - 8;
      });
      assert.ok(artBelowCopy, `Board artwork stacks below the copy on ${dev.name}`);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      assert.ok(scrollWidth <= clientWidth, `No horizontal overflow on ${dev.name} (${dev.w}px)`);

      const ctaVisible = await page.locator('.rv-cta-row > button').first().isVisible();
      assert.ok(ctaVisible, `Primary call to action is visible on ${dev.name}`);

      await page.screenshot({ path: path.join(artifactDir, `homepage_${dev.name}.png`), fullPage: false });
      console.log(`  - Verified ${dev.name} (${dev.w}px): single column, art stacked, 0 overflow ✅`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifactDir, 'homepage_iphone_390_fullpage.png'), fullPage: true });

    // 3. Entry sheet: create a table from the landing page
    await page.setViewportSize({ width: 390, height: 844 });
    const roomCode = await createTable(page, 'Maharaja');
    assert.equal(roomCode.length, 6, `Room creation returns a six-character code (${roomCode})`);
    console.log(`  - Room creation tested successfully: ROOM #${roomCode} ✅`);

    const seatCount = await page.locator('.master-slot-card').count();
    assert.equal(seatCount, 4, 'Lobby renders all four seats after creation');
    console.log('  - Lobby reached with four seats ✅');

    console.log('\n================================================================');
    console.log('--- ALL HOMEPAGE AUDIT TESTS PASSED! ---');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Homepage audit failed:', err);
    await browser.close().catch(() => undefined);
    ludoServer.httpServer.close();
    ludoServer.io.close();
    webServer.close();
    process.exit(1);
  }

  await browser.close();
  ludoServer.httpServer.close();
  ludoServer.io.close();
  webServer.close();
  process.exit(0);
}

runHomepageVerification().catch((err) => {
  console.error('Fatal Homepage Audit failure:', err);
  process.exit(1);
});
