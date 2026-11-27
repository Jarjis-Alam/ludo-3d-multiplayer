/**
 * Visual layout audit (real rendered geometry, not just scrollWidth).
 *
 * For every required viewport this test:
 *  - captures a screenshot of the rendered screen,
 *  - verifies text line boxes never intersect floating decorations,
 *  - verifies buttons/inputs/board remain inside their parent panels,
 *  - verifies hero, form, board showcase and header proportions,
 *  - repeats the structural checks for the lobby, match and victory screens.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.CLIENT_ORIGIN = '*';

import { chromium, type Page } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'node:assert/strict';
import { createLudoServer } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, '../../web/dist');
const outDir = path.resolve(__dirname, '../../../../docs/layout-qa/after');
fs.mkdirSync(outDir, { recursive: true });

const WEB_PORT = 5173;
const SERVER_PORT = 3001;
const EPS = 1;

type Box = { x: number; y: number; w: number; h: number };

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '800x1332', width: 800, height: 1332 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
];

const failures: string[] = [];
let checksRun = 0;

const ok = (message: string) => {
  checksRun += 1;
  console.log(`    ✓ ${message}`);
};

const fail = (message: string) => {
  checksRun += 1;
  failures.push(message);
  console.log(`    ✗ ${message}`);
};

const check = (condition: boolean, message: string) => {
  if (condition) ok(message);
  else fail(message);
};

const inside = (inner: Box, outer: Box, pad = 0) =>
  inner.x >= outer.x + pad - EPS &&
  inner.y >= outer.y + pad - EPS &&
  inner.x + inner.w <= outer.x + outer.w - pad + EPS &&
  inner.y + inner.h <= outer.y + outer.h - pad + EPS;

/** Horizontal containment only: text line boxes can rise above their element box (tight leading). */
const fitsHorizontally = (inner: Box, outer: Box, slack = 1) =>
  inner.x >= outer.x - slack && inner.x + inner.w <= outer.x + outer.w + slack;

const overlapArea = (a: Box, b: Box) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const fmt = (b: Box | null) =>
  b ? `x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} w=${b.w.toFixed(1)} h=${b.h.toFixed(1)}` : 'missing';

const boxOf = async (page: Page, selector: string): Promise<Box | null> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, selector);

const boxesOf = async (page: Page, selector: string): Promise<Box[]> =>
  page.evaluate((sel) => {
    const out: Array<{ x: number; y: number; w: number; h: number }> = [];
    const nodes = document.querySelectorAll(sel);
    for (let i = 0; i < nodes.length; i += 1) {
      const r = nodes[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    }
    return out;
  }, selector);

/** Real painted line boxes of a text element (not its full-width block box). */
const textLineBoxes = async (page: Page, selector: string): Promise<Box[]> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const out: Array<{ x: number; y: number; w: number; h: number }> = [];
    if (!el) return out;
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      if (r.width > 1 && r.height > 1) out.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    }
    return out;
  }, selector);

const requireBox = async (page: Page, selector: string): Promise<Box> => {
  const box = await boxOf(page, selector);
  assert.ok(box, `Expected selector to exist: ${selector}`);
  return box as Box;
};

const assertNoTextDecorationCollision = (label: string, lines: Box[], decorations: Box[]) => {
  const collisions: string[] = [];
  for (const line of lines) {
    for (const deco of decorations) {
      if (overlapArea(line, deco) > 4) {
        collisions.push(`text ${fmt(line)} × decoration ${fmt(deco)}`);
      }
    }
  }
  check(collisions.length === 0, `${label}: text never intersects a floating decoration${collisions.length ? ` (${collisions[0]})` : ''}`);
};

const assertVisibleWithinViewport = (label: string, box: Box, viewport: number) => {
  check(box.x >= -EPS && box.x + box.w <= viewport + EPS, `${label} stays inside the viewport (${fmt(box)})`);
};

const staticServer = http.createServer((req, res) => {
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

const mockBase = {
  roomCode: '9C687B',
  host: 'p1',
  invitationPath: '/?room=9C687B',
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

const mockPlaying = { ...mockBase, status: 'playing' };
const mockLobby = { ...mockBase, status: 'lobby', version: 4, dice: null, tokens: [[], [], [], []] };
const mockFinished = { ...mockBase, status: 'finished', winner: 0 };

const screenshotAll = new Set(VIEWPORTS.map((vp) => vp.name));

async function openApp(page: Page) {
  await page.goto(`http://localhost:${WEB_PORT}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main.rv-home', { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function checkHomepage(page: Page, vp: (typeof VIEWPORTS)[number], withScreenshot: boolean) {
  const viewportWidth = vp.width;

  // Header: brand left, actions right, navigation between them when it fits.
  const header = await requireBox(page, '.rv-header');
  const brand = await requireBox(page, '.rv-brand');
  const actions = await requireBox(page, '.rv-header-actions');
  check(header.x >= -EPS && header.x + header.w <= viewportWidth + EPS, `header: bar respects the page gutter (${fmt(header)})`);
  check(inside(brand, header, 1), `header: brand sits inside the bar (${fmt(brand)})`);
  check(inside(actions, header, 1), `header: actions sit inside the bar (${fmt(actions)})`);
  check(brand.x + brand.w <= actions.x + EPS, 'header: brand and actions do not overlap');
  const navItems = await boxesOf(page, '.rv-nav-item');
  for (const item of navItems) {
    check(inside(item, header, 1), `header: navigation item stays inside the bar (${fmt(item)})`);
  }

  // Hero copy
  const hero = await requireBox(page, '.rv-hero');
  const copy = await requireBox(page, '.rv-hero-copy');
  const title = await requireBox(page, '.rv-title');
  const lede = await requireBox(page, '.rv-lede');
  const cta = await requireBox(page, '.rv-cta-row');
  const art = await requireBox(page, '.rv-hero-art');
  const board = await requireBox(page, '.rv-board');

  const titleLines = await textLineBoxes(page, '.rv-title');
  const ledeLines = await textLineBoxes(page, '.rv-lede');
  check(titleLines.length >= 2, `hero: headline renders both clauses (${titleLines.length} lines)`);
  // Line boxes rise above the element box because of the tight headline leading, so only the
  // horizontal containment is meaningful (plus a small allowance for italic ink overhang).
  const copyWithInk = { x: copy.x - 20, y: copy.y, w: copy.w + 40, h: copy.h };
  check(
    titleLines.every((line) => fitsHorizontally(line, copyWithInk) && line.x >= -EPS && line.x + line.w <= viewportWidth + EPS),
    'hero: headline stays inside the copy column'
  );
  check(ledeLines.length > 0 && ledeLines.length <= 4, `hero: description wraps cleanly (${ledeLines.length} lines)`);
  check(ledeLines.every((line) => inside(line, copy)), 'hero: description stays inside the copy column');
  check(lede.w <= 640, `hero: description keeps a readable measure (${lede.w.toFixed(1)}px)`);
  check(title.y + title.h <= lede.y + EPS, 'hero: description sits below the headline');

  check(inside(cta, copy), 'hero: calls to action stay inside the copy column');
  const ctaButtons = await boxesOf(page, '.rv-cta-row > button');
  check(ctaButtons.length === 2, `hero: both calls to action render (${ctaButtons.length})`);
  for (const button of ctaButtons) {
    check(inside(button, cta, 1), `hero: call to action stays inside its row (${fmt(button)})`);
    check(button.h >= 44, `hero: call to action keeps a tactile height (${button.h.toFixed(1)}px)`);
    check(button.x + button.w <= viewportWidth + EPS, 'hero: call to action stays on screen');
  }

  // Artwork: the board is rotated in 3D, so only its painted size and presence are asserted.
  check(board.w >= 180 && board.h >= 140, `hero: board artwork keeps a usable size (${board.w.toFixed(0)}×${board.h.toFixed(0)})`);
  const gridCount = await page.locator('.rv-board .ludo-grid').count();
  check(gridCount === 1, `hero: the real board renders once (${gridCount})`);
  const columns = await page.evaluate(() => {
    const el = document.querySelector('.rv-hero');
    return el ? window.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length : 0;
  });
  if (viewportWidth <= 1080) {
    check(columns === 1, `hero: narrow screens use one column (${columns})`);
    check(art.y >= copy.y + copy.h - 8, `hero: artwork stacks below the copy (${(art.y - copy.y - copy.h).toFixed(1)}px)`);
  } else {
    check(columns === 2, `hero: wide screens use two columns (${columns})`);
    check(art.x >= copy.x + copy.w - 8, `hero: artwork sits beside the copy (${(art.x - copy.x - copy.w).toFixed(1)}px gap)`);
  }
  check(art.x >= -EPS && art.x + art.w <= viewportWidth + EPS, `hero: artwork stays inside the viewport (${fmt(art)})`);

  // Stats strip
  const stats = await requireBox(page, '.rv-stats');
  const statItems = await boxesOf(page, '.rv-stat');
  check(statItems.length === 3, `stats: three facts render (${statItems.length})`);
  check(stats.x >= -EPS && stats.x + stats.w <= viewportWidth + EPS, `stats: strip respects the page gutter (${fmt(stats)})`);
  for (const item of statItems) {
    check(inside(item, stats, 1), `stats: fact stays inside the strip (${fmt(item)})`);
  }

  // The entry sheet is the only way in, so it must stay usable at every width.
  await page.locator('.rv-cta-row > button').first().click();
  await page.locator('.rv-entry').waitFor({ state: 'visible', timeout: 10000 });
  const entryField = await requireBox(page, '.rv-entry .royal-input');
  const entrySubmit = await requireBox(page, '.rv-entry-submit');
  check(entryField.h >= 44, `entry: name field keeps a tactile height (${entryField.h.toFixed(1)}px)`);
  check(entrySubmit.h >= 44, `entry: submit keeps a tactile height (${entrySubmit.h.toFixed(1)}px)`);
  check(entryField.x >= -EPS && entryField.x + entryField.w <= viewportWidth + EPS, 'entry: name field stays inside the viewport');
  check(entrySubmit.x >= -EPS && entrySubmit.x + entrySubmit.w <= viewportWidth + EPS, 'entry: submit stays inside the viewport');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  if (await page.locator('.rv-entry').isVisible().catch(() => false)) {
    await page.locator('.modal-close-btn').first().click();
    await page.waitForTimeout(200);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `home: page has no horizontal overflow (${overflow}px)`);

  if (withScreenshot) {
    await page.screenshot({ path: path.join(outDir, `home-${vp.name}.png`), fullPage: true });
    ok(`screenshot home-${vp.name}.png`);
  }
}

async function checkHeader(page: Page, vp: (typeof VIEWPORTS)[number]) {
  const header = await requireBox(page, '.app-header');
  const brand = await requireBox(page, '.master-brand-area');
  const controls = await requireBox(page, '.header-controls');
  check(inside(brand, header, 2) && brand.x + brand.w <= vp.width + EPS, `header: brand sits inside the bar (${fmt(brand)})`);
  check(inside(controls, header, 2) && controls.x + controls.w <= vp.width - EPS, `header: controls stay inside the bar and viewport (${fmt(controls)})`);
  check(brand.x + brand.w <= controls.x + EPS, 'header: brand and controls do not overlap');
  const headerButtons = await boxesOf(page, '.header-controls > button');
  for (const button of headerButtons) {
    check(inside(button, header, 1) && button.x + button.w <= vp.width - EPS, `header: action button stays fully visible (${fmt(button)})`);
  }
}

async function checkLobby(page: Page, vp: (typeof VIEWPORTS)[number], withScreenshot: boolean) {
  await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mockLobby);
  await page.waitForSelector('.lobby-container', { timeout: 10000 });
  await page.waitForTimeout(200);

  await checkHeader(page, vp);
  const container = await requireBox(page, '.lobby-container');
  const headCard = await requireBox(page, '.lobby-head-card');
  const headInfo = await requireBox(page, '.lobby-head-info');
  const roomActions = await requireBox(page, '.room-actions');
  const roomCode = await requireBox(page, '.room-code-tag');
  const slots = await boxesOf(page, '.master-slot-card');
  const footer = await requireBox(page, '.lobby-footer-bar');
  const startBtn = await requireBox(page, '.lobby-start-btn');

  check(container.x >= -EPS && container.x + container.w <= vp.width + EPS, 'lobby: container respects the page gutter');
  check(inside(headCard, container), 'lobby: header card stays inside the container');
  check(inside(headInfo, headCard, 8), 'lobby: room info is inset from the card border');
  check(inside(roomActions, headCard, 8), 'lobby: room action buttons stay inside the card');
  check(inside(roomCode, headCard, 8), 'lobby: room code does not touch the card border');
  check(slots.length === 4, 'lobby: all four seats render');
  for (const slot of slots) {
    check(inside(slot, container), `lobby: seat card stays inside the container (${fmt(slot)})`);
  }
  check(footer.x >= -EPS && footer.x + footer.w <= vp.width + EPS, `lobby: footer bar stays inside the viewport (${fmt(footer)})`);
  check(inside(startBtn, footer, 4), 'lobby: start button stays inside the footer');
  check(inside(await textBoxOf(page, '.slot-name'), await requireBox(page, '.slots-grid')), 'lobby: seat names stay inside the seat grid');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `lobby: page has no horizontal overflow (${overflow}px)`);

  if (withScreenshot) {
    await page.screenshot({ path: path.join(outDir, `lobby-${vp.name}.png`), fullPage: true });
    ok(`screenshot lobby-${vp.name}.png`);
  }
}

async function textBoxOf(page: Page, selector: string): Promise<Box> {
  const lines = await textLineBoxes(page, selector);
  assert.ok(lines.length > 0, `Expected text in ${selector}`);
  const minX = Math.min(...lines.map((l) => l.x));
  const minY = Math.min(...lines.map((l) => l.y));
  const maxX = Math.max(...lines.map((l) => l.x + l.w));
  const maxY = Math.max(...lines.map((l) => l.y + l.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

async function checkMatch(page: Page, vp: (typeof VIEWPORTS)[number], withScreenshot: boolean) {
  await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mockPlaying);
  await page.waitForSelector('#ludoBoard', { timeout: 10000 });
  await page.waitForTimeout(300);

  await checkHeader(page, vp);

  if (vp.width >= 1024) {
    const telemetryHead = await requireBox(page, '.telemetry-section-head');
    const telemetryItems = await boxesOf(page, '.telemetry-section-head > *');
    check(telemetryItems.length >= 2, 'match: seat telemetry header renders its label and count');
    for (const item of telemetryItems) {
      check(inside(item, telemetryHead), `match: telemetry header item stays inside its row (${fmt(item)})`);
    }
    if (telemetryItems.length >= 2) {
      check(telemetryItems[0].x + telemetryItems[0].w + 4 <= telemetryItems[1].x, 'match: telemetry label and count do not collide');
    }
  }

  const feedToggle = await page.evaluate(() => {
    const el = document.querySelector('.activity-feed-toggle-btn');
    return el ? window.getComputedStyle(el).display : 'none';
  });
  check(feedToggle === 'none', 'match: no stray standalone feed control at the page edge');

  const wrapper = await requireBox(page, '.game-screen-wrapper');
  const infoBarHidden = await page.evaluate(() => {
    const el = document.querySelector('.room-info-bar-container');
    return !el || window.getComputedStyle(el).display === 'none';
  });
  const infoBar = infoBarHidden ? null : await requireBox(page, '.room-info-bar-container');
  const ribbon = await requireBox(page, '.mobile-player-ribbon');
  const playerCards = await boxesOf(page, '.master-player-card');
  const frame = await requireBox(page, '.ludo-arena-frame');
  const board = await requireBox(page, '#ludoBoard');
  const turnBar = await requireBox(page, '.turn-indicator-bar-container');
  const dock = await requireBox(page, '.master-bottom-dock');
  const dockVisible = await page.evaluate(() => {
    const el = document.querySelector('.master-bottom-dock');
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
  });

  // A single dice control must be visible: dock on phones/tablets, tray on desktop
  const visibleDice = await page.evaluate(() => {
    let count = 0;
    const selectors = ['.master-tactile-dice-btn', '.dice-cube-btn'];
    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (let i = 0; i < nodes.length; i += 1) {
        const rect = nodes[i].getBoundingClientRect();
        const style = window.getComputedStyle(nodes[i]);
        if (rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden') {
          count += 1;
        }
      }
    }
    return count;
  });
  check(visibleDice === 1, `match: exactly one dice control is rendered (${visibleDice})`);
  if (dockVisible) {
    check(vp.width < 1024, 'match: mobile dock only renders below the desktop breakpoint');
  } else {
    check(vp.width >= 1024, 'match: desktop uses the side-panel dice tray only');
    const trayDice = await boxOf(page, '.dice-cube-btn');
    check(!!trayDice, 'match: desktop dice tray is visible');
  }

  check(wrapper.x >= -EPS && wrapper.x + wrapper.w <= vp.width + EPS, 'match: wrapper respects the page gutter');
  const shortPortrait = vp.width < 1024 && vp.height > vp.width && vp.height <= 740;
  if (shortPortrait) {
    check(infoBarHidden, 'match: short portrait reclaims the room strip for the board');
  } else if (infoBar) {
    check(inside(infoBar, wrapper), 'match: room info bar stays inside the wrapper');
  }
  if (vp.width < 1024 && vp.height > vp.width) {
    const viewport = await page.evaluate(() => ({
      inner: window.innerHeight,
      scroll: document.documentElement.scrollHeight,
    }));
    check(viewport.scroll <= viewport.inner + 1, `match: portrait page fits the viewport (${viewport.scroll} <= ${viewport.inner})`);
  }
  check(inside(ribbon, wrapper), 'match: player ribbon stays inside the wrapper');
  check(playerCards.length >= 2, `match: player cards render (${playerCards.length})`);
  for (const card of playerCards) {
    check(inside(card, ribbon), `match: player card stays inside the ribbon (${fmt(card)})`);
  }
  check(inside(frame, wrapper), 'match: board frame stays inside the wrapper');
  check(Math.abs(frame.w - frame.h) <= 2, `match: board frame stays square (${frame.w.toFixed(1)}×${frame.h.toFixed(1)})`);
  check(inside(board, frame), 'match: board grid stays inside its frame');
  check(inside(turnBar, wrapper), 'match: turn indicator stays inside the wrapper');
  check(turnBar.y >= frame.y + frame.h - 4, 'match: turn indicator does not overlap the board');

  if (dockVisible) {
    check(inside(dock, wrapper), 'match: bottom dock stays inside the wrapper');
    check(dock.y >= turnBar.y + turnBar.h - 4, 'match: bottom dock does not overlap the turn indicator');
    const rollBtn = await boxOf(page, '.master-tap-roll-btn');
    if (rollBtn) check(inside(rollBtn, dock), 'match: roll button stays inside the dock');
    const diceWell = await boxOf(page, '.master-dice-elevated-mound');
    if (diceWell) check(inside(diceWell, dock), 'match: dice tray stays inside the dock');
    const dockCenter = await requireBox(page, '.master-bottom-dock > .dock-center-stage');
    check(inside(dockCenter, dock, 1), `match: dice stage stays inside the dock (${fmt(dockCenter)})`);
    const prominentRoll = await requireBox(page, '.mobile-prominent-roll-btn');
    check(inside(prominentRoll, dockCenter, 1), `match: roll button stays inside the dice stage (${fmt(prominentRoll)})`);
    check(prominentRoll.h >= 44, `match: roll button keeps a 44px touch target (${prominentRoll.h.toFixed(0)}px)`);
    if (rollBtn && diceWell) {
      check(rollBtn.y >= diceWell.y + diceWell.h, `match: dice tray and roll button do not overlap (${(rollBtn.y - diceWell.y - diceWell.h).toFixed(1)}px gap)`);
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `match: page has no horizontal overflow (${overflow}px)`);

  if (withScreenshot) {
    await page.screenshot({ path: path.join(outDir, `match-${vp.name}.png`), fullPage: true });
    ok(`screenshot match-${vp.name}.png`);
  }
}

async function checkVictory(page: Page, vp: (typeof VIEWPORTS)[number], withScreenshot: boolean) {
  await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mockFinished);
  await page.waitForSelector('.victory-screen', { timeout: 10000 });
  await page.waitForTimeout(250);

  await checkHeader(page, vp);

  const container = await requireBox(page, '.victory-screen');
  const card = await requireBox(page, '.victory-content');
  const title = await requireBox(page, '.victory-title');
  const stage = await requireBox(page, '.victory-stage');
  const actions = await requireBox(page, '.victory-actions');
  const buttons = await boxesOf(page, '.victory-actions > button');

  check(container.x >= -EPS && container.x + container.w <= vp.width + EPS, 'victory: container respects the page gutter');
  check(card.x >= -EPS && card.x + card.w <= vp.width + EPS, 'victory: content stays inside the viewport');
  check(fitsHorizontally(title, card, 4), 'victory: title stays inside the content');
  check(fitsHorizontally(stage, card, 4), `victory: podium stage stays inside the content (${fmt(stage)})`);
  check(stage.y >= title.y + title.h - 4, 'victory: stage sits below the title');
  check(fitsHorizontally(actions, card, 4), 'victory: action group stays inside the content');
  check(actions.y >= stage.y + stage.h - 8, 'victory: actions sit below the podium');
  check(buttons.length >= 2, `victory: both actions render (${buttons.length})`);
  for (const button of buttons) {
    check(inside(button, actions), `victory: action button stays inside its group (${fmt(button)})`);
    check(button.h >= 40, `victory: action keeps a comfortable target (${button.h.toFixed(0)}px)`);
  }

  const discs = await boxesOf(page, '.victory-disc');
  check(discs.length >= 2, `victory: podium discs render for the rankings (${discs.length})`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `victory: page has no horizontal overflow (${overflow}px)`);

  if (withScreenshot) {
    await page.screenshot({ path: path.join(outDir, `victory-${vp.name}.png`), fullPage: true });
    ok(`screenshot victory-${vp.name}.png`);
  }
}

async function checkPawnMotion(page: Page) {
  const before = { ...mockPlaying, tokens: mockPlaying.tokens.map((seatTokens) => seatTokens.map((t) => ({ ...t }))) };
  const after = { ...mockPlaying, tokens: mockPlaying.tokens.map((seatTokens) => seatTokens.map((t) => ({ ...t }))) };
  // Red pawn on the track at progress 8 moves to progress 14 (six cells)
  before.tokens[0][2] = { kind: 'path', progress: 8 };
  after.tokens[0][2] = { kind: 'path', progress: 14 };

  await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), before);
  await page.waitForTimeout(150);
  await page
    .waitForFunction(() => !document.querySelector('.animating-pawn-wrapper'), null, { timeout: 4000 })
    .catch(() => undefined);

  await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), after);

  const samples = await page.evaluate(
    () =>
      new Promise<Array<{ left: string; top: string } | null>>((resolve) => {
        const frames: Array<{ left: string; top: string; transform: string } | null> = [];
        let ticks = 0;
        const id = setInterval(() => {
          const el = document.querySelector('.animating-pawn-wrapper');
          if (!el) {
            frames.push(null);
          } else {
            const style = window.getComputedStyle(el);
            frames.push({ left: style.left, top: style.top, transform: style.transform });
          }
          ticks += 1;
          if (ticks >= 38) {
            clearInterval(id);
            resolve(frames);
          }
        }, 35);
      })
  );

  const movingFrames = samples.filter((s): s is { left: string; top: string; transform: string } => Boolean(s));
  // The hop animation drives the pawn with transforms, so the transform matrix is part of the sample.
  const uniqueFrames = new Set(movingFrames.map((s) => `${s.left}|${s.top}|${s.transform}`)).size;
  check(movingFrames.length >= 8, `motion: moving pawn stays visible through the move (${movingFrames.length} frames)`);
  check(uniqueFrames >= 6, `motion: pawn is interpolated between cells instead of snapping (${uniqueFrames} distinct frames)`);

  const points = movingFrames
    .map((s) => ({ left: parseFloat(s.left), top: parseFloat(s.top) }))
    .filter((p) => !Number.isNaN(p.left) && !Number.isNaN(p.top));
  let maxJump = 0;
  for (let i = 1; i < points.length; i += 1) {
    maxJump = Math.max(maxJump, Math.hypot(points[i].left - points[i - 1].left, points[i].top - points[i - 1].top));
  }
  check(maxJump < 60, `motion: no teleport frames during movement (largest step ${maxJump.toFixed(1)}px)`);

  await page.waitForTimeout(500);
  const overlayGone = await page.evaluate(() => !document.querySelector('.animating-pawn-wrapper'));
  check(overlayGone, 'motion: animation overlay is cleared once the move settles');
  const landed = await page.locator('#ludoBoard .traditional-pawn-wrapper').count();
  check(landed > 0, 'motion: landed pawn is restored to the board');
}

async function run() {
  console.log('================================================================');
  console.log('--- VISUAL LAYOUT AUDIT (rendered geometry) ---');
  console.log('================================================================');

  const ludoServer = await createLudoServer();
  await new Promise((resolve) => ludoServer.httpServer.listen(SERVER_PORT, resolve as () => void));
  await new Promise<void>((resolve) => staticServer.listen(WEB_PORT, resolve));
  console.log(`[servers] backend :${SERVER_PORT} · static web :${WEB_PORT}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n=== ${vp.name} ===`);
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.width <= 430,
        hasTouch: vp.width <= 430,
      });
      const withScreenshot = screenshotAll.has(vp.name);

      await openApp(page);
      console.log('  homepage');
      await checkHomepage(page, vp, withScreenshot);

      console.log('  lobby');
      await checkLobby(page, vp, withScreenshot);

      console.log('  match');
      await checkMatch(page, vp, withScreenshot);

      if (vp.name === '390x844') {
        console.log('  pawn motion');
        await checkPawnMotion(page);
      }

      console.log('  victory');
      await checkVictory(page, vp, withScreenshot);

      await page.close();
    }
  } finally {
    await browser.close();
    staticServer.close();
    ludoServer.httpServer.close();
    ludoServer.io.close();
  }

  console.log('\n================================================================');
  if (failures.length > 0) {
    console.error(`VISUAL LAYOUT AUDIT FAILED — ${failures.length} of ${checksRun} checks failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`VISUAL LAYOUT AUDIT PASSED — ${checksRun} rendered-geometry checks across ${VIEWPORTS.length} viewports.`);
  console.log('================================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('VISUAL LAYOUT AUDIT ERROR:', err);
  process.exit(1);
});
