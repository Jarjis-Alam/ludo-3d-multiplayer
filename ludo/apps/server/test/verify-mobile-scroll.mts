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
const WEB_PORT = 5175;
const SERVER_PORT = 3001;

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

const MOBILE_AND_TABLET_VIEWPORTS = [
  { name: '320x568', width: 320, height: 568, isMobile: true },
  { name: '360x800', width: 360, height: 800, isMobile: true },
  { name: '375x667', width: 375, height: 667, isMobile: true },
  { name: '390x844', width: 390, height: 844, isMobile: true },
  { name: '430x932', width: 430, height: 932, isMobile: true },
  { name: '667x375_landscape', width: 667, height: 375, isMobile: true },
  { name: '768x1024_tablet', width: 768, height: 1024, isMobile: true },
  { name: '1280x720_desktop', width: 1280, height: 720, isMobile: false },
];

async function runScrollVerification() {
  console.log('================================================================');
  console.log('--- STARTING GLOBAL MOBILE SCROLLING ARCHITECTURE AUDIT ---');
  console.log('================================================================\n');

  const ludoServer = await createLudoServer();
  await new Promise<void>((r) => ludoServer.httpServer.listen(SERVER_PORT, r));
  await new Promise<void>((r) => webServer.listen(WEB_PORT, r));

  const browser = await chromium.launch({ headless: true });

  try {
    for (const vp of MOBILE_AND_TABLET_VIEWPORTS) {
      console.log(`\n--- Auditing viewport ${vp.name} (${vp.width}x${vp.height}) ---`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
      });
      const page = await context.newPage();

      // Capture helper: verifies zero unexpected nested scroll containers and zero horizontal overflow
      const assertCleanScrollArchitecture = async (screenName: string) => {
        const res = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const accidentalContainers: string[] = [];

          // Neither html, body, nor GameBackground wrappers may become scroll containers
          const checkEls = [doc, body, document.querySelector('#root'), document.querySelector('.game-master-backdrop'), document.querySelector('.game-master-content')];
          for (const el of checkEls) {
            if (!el) continue;
            const cs = getComputedStyle(el);
            if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'hidden') {
              // Note: only while no modal is open!
              accidentalContainers.push(`${el.tagName}.${(el as HTMLElement).className}(ovY=${cs.overflowY})`);
            }
          }

          const horizOverflow = doc.scrollWidth - doc.clientWidth;
          return {
            accidentalContainers,
            horizOverflow,
            docScrollH: doc.scrollHeight,
            docClientH: doc.clientHeight,
            backdropScrollH: (document.querySelector('.game-master-backdrop') as HTMLElement | null)?.scrollHeight ?? 0,
            backdropClientH: (document.querySelector('.game-master-backdrop') as HTMLElement | null)?.clientHeight ?? 0,
          };
        });

        assert.equal(
          res.accidentalContainers.length,
          0,
          `[${vp.name} ${screenName}] Found accidental scroll containers: ${res.accidentalContainers.join(', ')}`
        );
        assert.ok(
          res.horizOverflow <= 0,
          `[${vp.name} ${screenName}] Horizontal overflow detected: ${res.horizOverflow}px`
        );
        if (res.backdropClientH > 0) {
          assert.ok(
            res.backdropScrollH <= res.backdropClientH + 1,
            `[${vp.name} ${screenName}] .game-master-backdrop has phantom vertical overflow: ${res.backdropScrollH} > ${res.backdropClientH}`
          );
        }
        return res;
      };

      // Helper: verifies wheel scrolling over center moves window.scrollY and restores cleanly
      const verifyRealScrollReach = async (screenName: string, bottomSelector: string, clearAboveSelector?: string) => {
        const metrics = await page.evaluate(() => ({
          scrollH: document.documentElement.scrollHeight,
          clientH: document.documentElement.clientHeight,
        }));

        if (metrics.scrollH > metrics.clientH + 4) {
          // Scroll using real mouse wheel from center of screen (testing real hit-testing!)
          await page.mouse.move(vp.width / 2, Math.min(vp.height / 2, 240));
          for (let i = 0; i < 6; i += 1) {
            await page.mouse.wheel(0, 300);
            await page.waitForTimeout(30);
          }
          const afterWheelDown = await page.evaluate(() => window.scrollY);
          assert.ok(
            afterWheelDown > 0,
            `[${vp.name} ${screenName}] Real wheel scroll did not advance window.scrollY (stuck at 0)`
          );

          // Verify we can scroll to the very bottom and reach the bottom-most target
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(50);

          const bottomState = await page.evaluate(
            ({ bottomSel, clearSel }) => {
              const target = document.querySelector(bottomSel)?.getBoundingClientRect();
              const footer = clearSel ? document.querySelector(clearSel)?.getBoundingClientRect() : null;
              const footerPos = clearSel && footer ? getComputedStyle(document.querySelector(clearSel)!).position : null;
              return {
                scrollY: window.scrollY,
                maxExpected: document.documentElement.scrollHeight - document.documentElement.clientHeight,
                targetTop: target ? target.top : null,
                targetBottom: target ? target.bottom : null,
                footerTop: footer ? footer.top : null,
                footerPos,
                winH: window.innerHeight,
              };
            },
            { bottomSel: bottomSelector, clearSel: clearAboveSelector }
          );

          assert.ok(
            bottomState.targetBottom !== null && bottomState.targetBottom <= bottomState.winH + 2,
            `[${vp.name} ${screenName}] Bottom target ${bottomSelector} unreachable (bottom=${bottomState.targetBottom}, winH=${bottomState.winH})`
          );

          if (bottomState.footerPos === 'fixed' && bottomState.footerTop !== null && bottomState.targetBottom !== null) {
            assert.ok(
              bottomState.targetBottom <= bottomState.footerTop + 2,
              `[${vp.name} ${screenName}] Bottom target ${bottomSelector} obscured by fixed footer (${bottomState.targetBottom} > ${bottomState.footerTop})`
            );
          }

          // Scroll back up smoothly
          await page.mouse.wheel(0, -1500);
          await page.waitForTimeout(50);
          const afterWheelUp = await page.evaluate(() => window.scrollY);
          assert.ok(
            afterWheelUp < bottomState.scrollY,
            `[${vp.name} ${screenName}] Could not scroll back up cleanly`
          );
          await page.evaluate(() => window.scrollTo(0, 0));
        }
      };

      // 1. HOME SCREEN
      await page.goto(`http://localhost:${WEB_PORT}`);
      await page.waitForSelector('.rv-home');
      await assertCleanScrollArchitecture('HOME');
      await verifyRealScrollReach('HOME', '.rv-stats');
      console.log('  ✓ Homepage scroll & bottom reach verified');

      // 2. REAL ROOM CREATION -> LOBBY SCREEN
      await page.click('.rv-btn-primary');
      await page.waitForSelector('.rv-entry .royal-input');
      // Modal must lock scroll while open
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await page.fill('.rv-entry .royal-input', 'Jarvis');
      await page.click('.rv-entry-submit');
      await page.waitForSelector('.lobby-container');
      await page.waitForTimeout(200);

      // Verify scroll lock was cleanly restored after transitioning from Entry modal into Lobby!
      assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '', 'html scroll lock must be cleared after room join');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'body scroll lock must be cleared after room join');

      await assertCleanScrollArchitecture('LOBBY');
      await verifyRealScrollReach('LOBBY', '.lobby-turn-clock', '.lobby-footer-bar');
      console.log('  ✓ Lobby scroll & reach verified');

      // 3. MODALS INSIDE LOBBY: Settings, Share/QR, Activity Feed & Scroll Restoration
      for (const modalTest of [
        { trigger: '.btn-settings', card: '.settings-modal-card', body: '.modal-body', close: '.settings-modal-card .modal-close-btn', name: 'Settings' },
        { trigger: '.btn-share', card: '.share-modal-card', body: '.modal-body', close: '.share-modal-card .modal-close-btn', name: 'Share' },
        { trigger: '.btn-feed', card: '.activity-feed-drawer', body: '.feed-list-scroll', close: '.activity-feed-drawer .feed-close-btn', name: 'ActivityFeed' },
      ]) {
        await page.click(modalTest.trigger);
        await page.waitForSelector(modalTest.card, { state: 'visible' });
        await page.waitForTimeout(100);

        const openState = await page.evaluate(({ cardSel, bodySel }) => {
          const card = document.querySelector(cardSel) as HTMLElement;
          const body = document.querySelector(bodySel) as HTMLElement;
          return {
            docOv: document.documentElement.style.overflow,
            bodyOv: document.body.style.overflow,
            cardH: card.getBoundingClientRect().height,
            winH: window.innerHeight,
            bodyScrollH: body.scrollHeight,
            bodyClientH: body.clientHeight,
            bodyMinH: getComputedStyle(body).minHeight,
          };
        }, { cardSel: modalTest.card, bodySel: modalTest.body });

        assert.equal(openState.docOv, 'hidden', `${modalTest.name}: html overflow locked`);
        assert.equal(openState.bodyOv, 'hidden', `${modalTest.name}: body overflow locked`);
        assert.ok(openState.cardH <= openState.winH, `${modalTest.name}: modal height exceeds viewport`);
        assert.equal(openState.bodyMinH, '0px', `${modalTest.name}: scrollable modal body has min-height: 0`);

        // If modal body overflows on compact height, confirm it actually scrolls internally
        if (openState.bodyScrollH > openState.bodyClientH + 2) {
          const innerScrolled = await page.evaluate((sel) => {
            const b = document.querySelector(sel) as HTMLElement;
            b.scrollTop = b.scrollHeight;
            return b.scrollTop;
          }, modalTest.body);
          assert.ok(innerScrolled > 0, `${modalTest.name}: internal modal body failed to scroll on ${vp.name}`);
        }

        await page.click(modalTest.close);
        await page.waitForSelector(modalTest.card, { state: 'detached' });
        await page.waitForTimeout(50);

        // Verify full restoration of both html & body overflow AND that real page scrolling works again!
        assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '', `${modalTest.name}: html overflow must restore`);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '', `${modalTest.name}: body overflow must restore`);
      }

      await verifyRealScrollReach('LOBBY_POST_MODAL', '.lobby-turn-clock', '.lobby-footer-bar');
      console.log('  ✓ Modal scroll lock/unlock & internal scroll verified');

      // 4. LEAVE LOBBY -> VERIFY NAVIGATION BACK TO HOME DOES NOT AUTO-OPEN ENTRY SHEET OR LOCK SCROLL
      await page.click('.lobby-footer-actions button:has-text("Leave Lobby")');
      await page.waitForSelector('.rv-home');
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.modal-card').count(), 0, 'Entry modal must not stay open after leaving lobby');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Scroll must remain unlocked after returning home');
      await verifyRealScrollReach('HOME_AFTER_LEAVE', '.rv-stats');
      console.log('  ✓ Screen transition (Lobby -> Home) scroll verified');

      // 5. MATCH & VICTORY SCREENS
      await page.evaluate(() => {
        (window as any).__SET_MOCK_SNAPSHOT__({
          roomCode: 'SCRL01',
          status: 'playing',
          host: 'p1',
          currentPlayer: 0,
          dice: 6,
          winner: null,
          rankings: [],
          turnDurationMs: 30000,
          turnExpiresAt: Date.now() + 25000,
          serverNow: Date.now(),
          version: 3,
          players: [
            { id: 'p1', name: 'Jarvis', color: 'red', seat: 0, connected: true },
            { id: 'p2', name: 'Odonil', color: 'green', seat: 1, connected: true },
            { id: 'p3', name: 'Jaggu', color: 'yellow', seat: 2, connected: true },
            { id: 'p4', name: 'Tinni', color: 'blue', seat: 3, connected: true },
          ],
          tokens: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ kind: 'base', progress: 0 }))),
        });
      });
      await page.waitForSelector('#ludoBoard');
      await page.waitForTimeout(150);
      await assertCleanScrollArchitecture('MATCH');
      if (vp.width < 1024 && vp.height >= 520 && vp.height > vp.width) {
        // Portrait phones keep board & dock completely inside viewport
        const rollRect = await page.locator('.master-tap-roll-btn').boundingBox();
        assert.ok(
          rollRect && rollRect.y + rollRect.height <= vp.height + 1,
          `[${vp.name} MATCH] Roll button clipped below viewport (${rollRect ? Math.round(rollRect.y + rollRect.height) : 'missing'} > ${vp.height})`
        );
      } else {
        const lastMatchSelector = vp.width >= 1024 ? '.telemetry-section' : '.master-tap-roll-btn';
        await verifyRealScrollReach('MATCH', lastMatchSelector);
      }
      console.log('  ✓ Match screen layout & scroll verified');

      await page.evaluate(() => {
        (window as any).__SET_MOCK_SNAPSHOT__({
          roomCode: 'SCRL01',
          status: 'finished',
          host: 'p1',
          currentPlayer: 0,
          dice: null,
          winner: 0,
          rankings: [0, 1, 2, 3],
          turnDurationMs: 30000,
          version: 10,
          matchStats: { turns: 32, captures: 3, safeMoves: 6, startedAt: Date.now() - 120000, finishedAt: Date.now() },
          players: [
            { id: 'p1', name: 'Jarvis', color: 'red', seat: 0, connected: true },
            { id: 'p2', name: 'Odonil', color: 'green', seat: 1, connected: true },
            { id: 'p3', name: 'Jaggu', color: 'yellow', seat: 2, connected: true },
            { id: 'p4', name: 'Tinni', color: 'blue', seat: 3, connected: true },
          ],
          tokens: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ kind: 'home', progress: 6 }))),
        });
      });
      await page.waitForSelector('.victory-screen');
      await page.waitForTimeout(150);
      await assertCleanScrollArchitecture('VICTORY');
      await verifyRealScrollReach('VICTORY', '.victory-actions');
      console.log('  ✓ Victory screen scroll & bottom button reach verified');

      await context.close();
    }

    console.log('\n================================================================');
    console.log('🎉 GLOBAL MOBILE SCROLLING AUDIT PASSED ACROSS ALL VIEWPORTS!');
    console.log('================================================================\n');
  } finally {
    await browser.close();
    webServer.close();
    ludoServer.httpServer.close();
    ludoServer.io.close();
  }
}

runScrollVerification().catch((err) => {
  console.error('SCROLL VERIFICATION FAILED:', err);
  process.exit(1);
});
