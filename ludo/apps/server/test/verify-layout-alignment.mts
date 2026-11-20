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

async function runLayoutVerification() {
  console.log('================================================================');
  console.log('--- STARTING UI ALIGNMENT & LAYOUT CORRECTION VERIFICATION ---');
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
    const viewports = [
      { name: 'compact_320', width: 320, height: 568 },
      { name: 'iphone_se_375', width: 375, height: 667 },
      { name: 'iphone_14_390', width: 390, height: 844 },
      { name: 'iphone_plus_414', width: 414, height: 896 },
      { name: 'iphone_pro_max_430', width: 430, height: 932 },
    ];

    // 1. Verify Viewports & Zero Horizontal Scrolling on Homepage
    console.log('\n--- 1. Testing Homepage across viewports (320px - 430px) ---');
    for (const vp of viewports) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });
      await page.goto(`http://localhost:${WEB_PORT}`);
      await page.waitForSelector('.landing-stage', { timeout: 10000 });

      const hasHorizScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      console.log(`  - Viewport ${vp.width}x${vp.height} (${vp.name}): horizontal scroll = ${hasHorizScroll} (expected false)`);
      assert.equal(hasHorizScroll, false, `Viewport ${vp.width} has horizontal overflow!`);

      if (vp.width === 390) {
        const shotPath = path.join(brainArtifactDir, 'homepage_mobile_390.png');
        await page.screenshot({ path: shotPath, fullPage: false });
        console.log(`  📸 Saved Homepage screenshot: ${shotPath}`);
      }
      await page.close();
    }

    // 2. Setup 2-player match
    console.log('\n--- 2. Setting up 2-Player Match ---');
    const mobileOpts = {
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    };

    const ctx1 = await browser.newContext(mobileOpts);
    const p1 = await ctx1.newPage();
    await p1.goto(`http://localhost:${WEB_PORT}`);
    await p1.waitForSelector('#player-name-input');
    await p1.fill('#player-name-input', 'Jarvis');
    await p1.click('button:has-text("Create Private Salon")');
    await p1.waitForSelector('.room-code-tag');
    const roomCodeTag = await p1.textContent('.room-code-tag');
    const roomCode = roomCodeTag?.replace('ROOM #', '').trim();
    console.log(`  - Jarvis created room: ${roomCode}`);

    const ctx2 = await browser.newContext(mobileOpts);
    const p2 = await ctx2.newPage();
    await p2.goto(`http://localhost:${WEB_PORT}/?room=${roomCode}`);
    await p2.waitForSelector('#player-name-input');
    await p2.fill('#player-name-input', 'Odonil');
    await p2.click('button:has-text("Enter Room Table")');
    await p2.waitForSelector('.lobby-container');
    console.log('  - Odonil joined room');

    // Start 2-player game
    await p1.waitForSelector('button:has-text("Start game")');
    await p1.click('button:has-text("Start game")');
    await p1.waitForSelector('#ludoBoard', { timeout: 10000 });
    await p2.waitForSelector('#ludoBoard', { timeout: 10000 });
    await sleep(600);

    // Verify 2-player cards and board alignment
    const cards2p = await p1.$$('.master-player-card');
    console.log(`  - Rendered player cards: ${cards2p.length} (expected 2)`);
    assert.equal(cards2p.length, 2);

    const shot2p = path.join(brainArtifactDir, 'match_2_players.png');
    await p1.screenshot({ path: shot2p });
    console.log(`  📸 Saved 2-Player Match screenshot: ${shot2p}`);

    await ctx1.close();
    await ctx2.close();

    // 3. Setup 3-player match
    console.log('\n--- 3. Setting up 3-Player Match ---');
    const hostCtx3 = await browser.newContext(mobileOpts);
    const host3 = await hostCtx3.newPage();
    await host3.goto(`http://localhost:${WEB_PORT}`);
    await host3.waitForSelector('#player-name-input');
    await host3.fill('#player-name-input', 'Jarvis');
    await host3.click('button:has-text("Create Private Salon")');
    await host3.waitForSelector('.room-code-tag');
    const roomCodeTag3 = await host3.textContent('.room-code-tag');
    const roomCode3 = roomCodeTag3?.replace('ROOM #', '').trim();

    const guestContexts3: any[] = [];
    for (const name of ['Odonil', 'Jaggu']) {
      const gCtx = await browser.newContext(mobileOpts);
      guestContexts3.push(gCtx);
      const p = await gCtx.newPage();
      await p.goto(`http://localhost:${WEB_PORT}/?room=${roomCode3}`);
      await p.waitForSelector('#player-name-input');
      await p.fill('#player-name-input', name);
      await p.click('button:has-text("Enter Room Table")');
      await p.waitForSelector('.lobby-container');
    }

    await host3.waitForSelector('button:has-text("Start game")');
    await host3.click('button:has-text("Start game")');
    await host3.waitForSelector('#ludoBoard', { timeout: 10000 });
    await sleep(600);

    const cards3p = await host3.$$('.master-player-card');
    console.log(`  - Rendered player cards: ${cards3p.length} (expected 3)`);
    assert.equal(cards3p.length, 3);

    const shot3p = path.join(brainArtifactDir, 'match_3_players.png');
    await host3.screenshot({ path: shot3p });
    console.log(`  📸 Saved 3-Player Match screenshot: ${shot3p}`);

    await hostCtx3.close();
    for (const g of guestContexts3) await g.close();

    // 4. Setup 4-player match
    console.log('\n--- 4. Setting up 4-Player Match ---');
    const hostCtx4 = await browser.newContext(mobileOpts);
    const host4 = await hostCtx4.newPage();
    await host4.goto(`http://localhost:${WEB_PORT}`);
    await host4.waitForSelector('#player-name-input');
    await host4.fill('#player-name-input', 'Jarvis');
    await host4.click('button:has-text("Create Private Salon")');
    await host4.waitForSelector('.room-code-tag');
    const roomCodeTag4 = await host4.textContent('.room-code-tag');
    const roomCode4 = roomCodeTag4?.replace('ROOM #', '').trim();

    const guestContexts4: any[] = [];
    for (const name of ['Odonil', 'Jaggu', 'Tinni']) {
      const gCtx = await browser.newContext(mobileOpts);
      guestContexts4.push(gCtx);
      const p = await gCtx.newPage();
      await p.goto(`http://localhost:${WEB_PORT}/?room=${roomCode4}`);
      await p.waitForSelector('#player-name-input');
      await p.fill('#player-name-input', name);
      await p.click('button:has-text("Enter Room Table")');
      await p.waitForSelector('.lobby-container');
    }

    await host4.waitForSelector('button:has-text("Start game")');
    await host4.click('button:has-text("Start game")');
    await host4.waitForSelector('#ludoBoard', { timeout: 10000 });
    await sleep(600);

    const cards4p = await host4.$$('.master-player-card');
    console.log(`  - Rendered player cards: ${cards4p.length} (expected 4)`);
    assert.equal(cards4p.length, 4);

    const shot4p = path.join(brainArtifactDir, 'match_4_players.png');
    await host4.screenshot({ path: shot4p });
    console.log(`  📸 Saved 4-Player Match screenshot: ${shot4p}`);

    // 5. Test Active Turn with Dice Rolled
    console.log('\n--- 5. Testing Active Turn with Dice Rolled ---');
    const rollBtn = await host4.$('.master-tap-roll-btn:not(:disabled)');
    if (rollBtn) {
      console.log('  - Host rolls the dice...');
      await rollBtn.click();
      await sleep(1000); // wait for roll animation and result
    }

    const shotDice = path.join(brainArtifactDir, 'match_active_turn_dice_rolled.png');
    await host4.screenshot({ path: shotDice });
    console.log(`  📸 Saved Active Turn with Dice Rolled screenshot: ${shotDice}`);

    // Assert board geometry checks on the 15x15 grid
    const boardBox = await host4.$eval('#ludoBoard', (el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    console.log(`  - Board dimensions: ${Math.round(boardBox.width)}x${Math.round(boardBox.height)} (aspect ratio: ${(boardBox.width / boardBox.height).toFixed(3)})`);
    assert.ok(Math.abs(boardBox.width - boardBox.height) <= 3, 'Board must be square!');

    // Check no horizontal overflow in match screen
    const matchOverflow = await host4.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`  - Match view horizontal scroll: ${matchOverflow} (expected false)`);
    assert.equal(matchOverflow, false, 'Match screen has horizontal scroll overflow!');

    // Check that .sr-only does not take up visible space or overflow
    const srElements = await host4.$$eval('.sr-only', (els) => {
      return els.map((el) => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height, top: rect.top, left: rect.left };
      });
    });
    console.log(`  - Found ${srElements.length} .sr-only elements, checking clip rects...`);
    for (const sr of srElements) {
      assert.ok(sr.width <= 1 && sr.height <= 1, 'sr-only element takes visual space!');
    }

    await hostCtx4.close();
    for (const g of guestContexts4) await g.close();

    console.log('\n================================================================');
    console.log('🎉 ALL UI ALIGNMENT & LAYOUT CORRECTION CHECKS PASSED!');
    console.log('================================================================\n');
  } finally {
    await browser.close();
    webServer.close();
    ludoServer.httpServer.close();
    ludoServer.io.close();
  }
}

runLayoutVerification().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
