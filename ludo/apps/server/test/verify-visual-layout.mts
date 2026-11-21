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
  await page.waitForSelector('.landing-stage', { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
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

async function checkHomepage(page: Page, vp: (typeof VIEWPORTS)[number], withScreenshot: boolean) {
  const viewportWidth = vp.width;
  await checkHeader(page, vp);

  const hero = await requireBox(page, '.hero-column');
  assertVisibleWithinViewport('hero column', hero, viewportWidth);

  const headline = await requireBox(page, '.hero-headline');
  const subtitle = await requireBox(page, '.hero-subtitle');
  const eyebrow = await requireBox(page, '.hero-badge-eyebrow');

  const headlineLines = await textLineBoxes(page, '.hero-headline');
  const subtitleLines = await textLineBoxes(page, '.hero-subtitle');
  const eyebrowLines = await textLineBoxes(page, '.hero-badge-eyebrow');

  check(headlineLines.length > 0, 'hero: headline renders text');
  check(
    headlineLines.every((line) => inside(line, hero) && line.x >= 0 && line.x + line.w <= viewportWidth),
    'hero: headline text stays inside the hero column'
  );
  check(
    subtitleLines.every((line) => inside(line, hero) && line.x >= 0 && line.x + line.w <= viewportWidth),
    'hero: description text stays inside the hero column'
  );
  check(subtitle.y - (headline.y + headline.h) >= 8, `hero: headline and description have clear vertical spacing (${(subtitle.y - headline.y - headline.h).toFixed(1)}px)`);
  check(subtitle.w <= 540, `hero: description has a readable maximum width (${subtitle.w.toFixed(1)}px)`);
  check(subtitleLines.length <= 4, `hero: description wraps cleanly (${subtitleLines.length} lines)`);

  const decorationBoxes = await boxesOf(page, '.bg-geom-shape, .bg-floating-dice');
  check(decorationBoxes.length >= 4, `background: decorations are still rendered (${decorationBoxes.length} shapes/dice)`);
  assertNoTextDecorationCollision('hero eyebrow', eyebrowLines, decorationBoxes);
  assertNoTextDecorationCollision('hero headline', headlineLines, decorationBoxes);
  assertNoTextDecorationCollision('hero description', subtitleLines, decorationBoxes);

  const decorationStyles = await page.evaluate(() => {
    const out: Array<{ pe: string; z: string }> = [];
    const nodes = document.querySelectorAll('.bg-geom-shape, .bg-floating-dice, .ambient-glow');
    for (let i = 0; i < nodes.length; i += 1) {
      const style = window.getComputedStyle(nodes[i]);
      out.push({ pe: style.pointerEvents, z: style.zIndex });
    }
    return out;
  });
  check(decorationStyles.every((s) => s.pe === 'none'), 'background: every decoration uses pointer-events: none');
  const contentZ = await page.evaluate(() => {
    const el = document.querySelector('.game-master-content');
    return el ? Number(window.getComputedStyle(el).zIndex) || 0 : 0;
  });
  check(decorationStyles.every((s) => (Number(s.z) || 0) < contentZ), 'background: decorations paint behind the content layer');

  // --- Room creation panel ---
  const card = await requireBox(page, '.table-entry-card');
  const panelBody = await requireBox(page, '.table-entry-body');
  const tabGroup = await requireBox(page, '.table-entry-tab-group');
  const tabs = await boxesOf(page, '.table-tab-pill');
  const cta = await requireBox(page, '.table-cta-btn');
  const inputRow = await requireBox(page, '.table-input-row-with-avatar');
  const input = await requireBox(page, '.table-name-input');
  const avatar = await requireBox(page, '.table-avatar-preview');
  const specs = await requireBox(page, '.table-specs-row');

  assertVisibleWithinViewport('room panel', card, viewportWidth);
  check(inside(tabGroup, card, 8), 'room panel: segmented control is inset from the panel border');
  check(inside(cta, card, 8), 'room panel: primary action stays inside the panel');
  check(inside(inputRow, card, 8), 'room panel: guest name row stays inside the panel');
  check(inside(specs, card, 8), 'room panel: feature labels stay inside the panel');
  check(Math.abs(cta.w - panelBody.w) <= EPS, `room panel: primary action is full width (${cta.w.toFixed(1)}px vs ${panelBody.w.toFixed(1)}px)`);
  check(cta.h >= 44, `room panel: primary action has a tactile height (${cta.h.toFixed(1)}px)`);
  check(Math.abs(cta.x - panelBody.x) <= EPS, 'room panel: primary action aligns with the panel content');
  check(tabs.length === 2, 'room panel: segmented control keeps both tabs');
  if (tabs.length === 2) {
    check(Math.abs(tabs[0].w - tabs[1].w) <= EPS, `room panel: segmented tabs are balanced (${tabs[0].w.toFixed(1)}px / ${tabs[1].w.toFixed(1)}px)`);
    check(tabs.every((t) => inside(t, tabGroup, 6)), 'room panel: segmented tabs stay inside their track');
    check(tabs[0].y + tabs[0].h <= tabs[1].y + 2 || Math.abs(tabs[0].y - tabs[1].y) <= EPS, 'room panel: segmented tabs share one row');
  }
  check(Math.abs(input.h - avatar.h) <= 2, `room panel: avatar and input share a height (${input.h.toFixed(1)} / ${avatar.h.toFixed(1)})`);
  check(Math.abs(avatar.y + avatar.h / 2 - (inputRow.y + inputRow.h / 2)) <= 2, 'room panel: guest avatar is vertically centred with the input');
  check(input.h >= 44, `room panel: guest name input has a consistent height (${input.h.toFixed(1)}px)`);
  check(specs.y - (cta.y + cta.h) >= 8, 'room panel: feature labels are separated from the primary action');

  // --- Board showcase ---
  const showcase = await requireBox(page, '.landing-board-showcase');
  const showcaseHeader = await requireBox(page, '.board-showcase-header');
  const showcaseMeta = await requireBox(page, '.board-showcase-meta');
  const showcaseTitle = await requireBox(page, '.board-showcase-title');
  const showcaseSubtitle = await requireBox(page, '.board-showcase-subtitle');
  const showcaseEyebrow = await requireBox(page, '.board-showcase-eyebrow');
  const badge = await requireBox(page, '.board-showcase-badge');
  const frame = await requireBox(page, '.board-showcase-frame .ludo-arena-frame');
  const showcaseEyebrowLines = await textLineBoxes(page, '.board-showcase-eyebrow');
  const showcaseSubtitleLines = await textLineBoxes(page, '.board-showcase-subtitle');

  assertVisibleWithinViewport('board showcase', showcase, viewportWidth);
  check(inside(showcaseHeader, showcase, 8), 'board showcase: header is inset from the panel border');
  check(inside(showcaseMeta, showcase, 8), 'board showcase: heading block is inset from the panel border');
  check(inside(showcaseTitle, showcaseMeta), 'board showcase: title stays inside its heading block');
  check(inside(showcaseEyebrow, showcaseMeta), 'board showcase: eyebrow stays inside its heading block');
  check(inside(showcaseSubtitle, showcaseMeta), 'board showcase: subtitle stays inside its heading block');
  check(inside(badge, showcase, 8), 'board showcase: live demo badge stays inside the panel');
  check(overlapArea(badge, showcaseMeta) === 0, 'board showcase: live demo badge does not overlap the heading text block');
  check(showcaseEyebrowLines.length <= 2, `board showcase: eyebrow wraps cleanly (${showcaseEyebrowLines.length} line(s))`);
  check(showcaseSubtitleLines.length <= 2, `board showcase: subtitle wraps cleanly (${showcaseSubtitleLines.length} line(s))`);
  check(inside(frame, showcase, 6), 'board showcase: board preview stays inside the panel padding');
  check(frame.w <= showcase.w - 16 && frame.w >= showcase.w - 80, `board showcase: board preview scales proportionally inside the panel (${frame.w.toFixed(1)}px of ${showcase.w.toFixed(1)}px)`);
  check(Math.abs(frame.w - frame.h) <= 2, `board showcase: board preview stays square (${frame.w.toFixed(1)}×${frame.h.toFixed(1)})`);
  check(frame.w >= 220, `board showcase: board preview keeps a usable size (${frame.w.toFixed(1)}px)`);
  if (viewportWidth <= 960) {
    check(showcase.y - (card.y + card.h) >= 16, `layout: clear gap between hero panel and board showcase (${(showcase.y - card.y - card.h).toFixed(1)}px)`);
    check(Math.abs(card.w - showcase.w) <= EPS, `layout: hero panel and board showcase share one content width (${card.w.toFixed(1)}px / ${showcase.w.toFixed(1)}px)`);
    check(showcase.x >= card.x - EPS, 'layout: board showcase aligns with the hero panel');
  } else {
    check(card.x + card.w <= showcase.x, `layout: hero and board columns do not overlap (${(showcase.x - card.x - card.w).toFixed(1)}px gap)`);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `layout: page has no horizontal overflow (${overflow}px)`);

  if (withScreenshot) {
    await page.screenshot({ path: path.join(outDir, `home-${vp.name}.png`), fullPage: true });
    ok(`screenshot home-${vp.name}.png`);
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
  check(inside(footer, container), 'lobby: footer bar stays inside the container');
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
  const infoBar = await requireBox(page, '.room-info-bar-container');
  const ribbon = await requireBox(page, '.mobile-player-ribbon');
  const playerCards = await boxesOf(page, '.master-player-card');
  const frame = await requireBox(page, '.ludo-arena-frame');
  const board = await requireBox(page, '#ludoBoard');
  const turnBar = await requireBox(page, '.turn-indicator-bar-container');
  const dock = await requireBox(page, '.master-bottom-dock');

  check(wrapper.x >= -EPS && wrapper.x + wrapper.w <= vp.width + EPS, 'match: wrapper respects the page gutter');
  check(inside(infoBar, wrapper), 'match: room info bar stays inside the wrapper');
  check(inside(ribbon, wrapper), 'match: player ribbon stays inside the wrapper');
  check(playerCards.length >= 2, `match: player cards render (${playerCards.length})`);
  for (const card of playerCards) {
    check(inside(card, ribbon), `match: player card stays inside the ribbon (${fmt(card)})`);
  }
  check(inside(frame, wrapper), 'match: board frame stays inside the wrapper');
  check(Math.abs(frame.w - frame.h) <= 2, `match: board frame stays square (${frame.w.toFixed(1)}×${frame.h.toFixed(1)})`);
  check(inside(board, frame), 'match: board grid stays inside its frame');
  check(inside(turnBar, wrapper), 'match: turn indicator stays inside the wrapper');
  check(inside(dock, wrapper), 'match: bottom dock stays inside the wrapper');
  check(turnBar.y >= frame.y + frame.h - 4, 'match: turn indicator does not overlap the board');
  check(dock.y >= turnBar.y + turnBar.h - 4, 'match: bottom dock does not overlap the turn indicator');
  const rollBtn = await boxOf(page, '.master-tap-roll-btn');
  if (rollBtn) check(inside(rollBtn, dock), 'match: roll button stays inside the dock');
  const dockChildren = await boxesOf(page, '.master-bottom-dock > .dock-flank, .master-bottom-dock > .dock-center-stage');
  check(dockChildren.length >= 3, 'match: dock renders both flanks and the centre stage');
  for (const child of dockChildren) {
    check(inside(child, dock, 1), `match: dock control stays inside the dock (${fmt(child)})`);
  }
  const activityBtn = await boxOf(page, '.dock-activity-pill-btn');
  if (activityBtn) check(activityBtn.x + activityBtn.w <= vp.width - EPS, `match: activity control stays on screen (${fmt(activityBtn)})`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `match: page has no horizontal overflow (${overflow}px)`);

  if (withScreenshot) {
    await page.screenshot({ path: path.join(outDir, `match-${vp.name}.png`), fullPage: true });
    ok(`screenshot match-${vp.name}.png`);
  }
}

async function checkVictory(page: Page, vp: (typeof VIEWPORTS)[number], withScreenshot: boolean) {
  await page.evaluate((snap) => (window as any).__SET_MOCK_SNAPSHOT__(snap), mockFinished);
  await page.waitForSelector('.victory-main-card', { timeout: 10000 });
  await page.waitForTimeout(250);

  await checkHeader(page, vp);

  const container = await requireBox(page, '.victory-overlay-container');
  const card = await requireBox(page, '.victory-main-card');
  const title = await requireBox(page, '.victory-title-headline');
  const switcher = await requireBox(page, '.victory-tab-switcher');
  const podium = await requireBox(page, '.victory-podium-stand');
  const actions = await requireBox(page, '.victory-actions-group');
  const buttons = await boxesOf(page, '.victory-actions-group > button');

  check(container.x >= -EPS && container.x + container.w <= vp.width + EPS, 'victory: container respects the page gutter');
  check(inside(card, container), 'victory: main card stays inside the container');
  check(inside(title, card, 8), 'victory: title stays inside the card');
  check(inside(switcher, card, 8), 'victory: tab switcher stays inside the card');
  check(inside(podium, card, 8), `victory: podium stays inside the card (${fmt(podium)})`);
  check(inside(actions, card, 8), 'victory: action group stays inside the card');
  check(buttons.length >= 2, 'victory: both actions render');
  for (const button of buttons) {
    check(inside(button, actions), `victory: action button stays inside its group (${fmt(button)})`);
  }

  const podiumTiers = await boxesOf(page, '.podium-tier');
  for (const tier of podiumTiers) {
    check(inside(tier, podium), `victory: podium tier stays inside the podium (${fmt(tier)})`);
  }
  const championName = await textBoxOf(page, '.tier-1 .podium-player-name');
  const championAvatar = await requireBox(page, '.tier-1 .player-avatar-wrapper');
  check(overlapArea(championName, championAvatar) === 0, 'victory: champion name is not covered by the avatar or crown');
  check(championName.y >= championAvatar.y + championAvatar.h - 2, 'victory: champion name sits below the avatar');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `victory: page has no horizontal overflow (${overflow}px)`);

  if (withScreenshot) {
    await page.screenshot({ path: path.join(outDir, `victory-${vp.name}.png`), fullPage: true });
    ok(`screenshot victory-${vp.name}.png`);
  }
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
}

run().catch((err) => {
  console.error('VISUAL LAYOUT AUDIT ERROR:', err);
  process.exit(1);
});
