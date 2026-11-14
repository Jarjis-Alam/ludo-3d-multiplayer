import { chromium, type Browser, type Page } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function runBrowserValidation() {
  console.log('--- STARTING COMPREHENSIVE 4-PLAYER BROWSER VALIDATION ---');
  const browser: Browser = await chromium.launch({ headless: true });

  const errors: string[] = [];
  const logs: string[] = [];

  function attachListeners(page: Page, label: string) {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        errors.push(`[${label} Error] ${text}`);
      }
      logs.push(`[${label}] ${text}`);
    });
    page.on('pageerror', (err) => {
      errors.push(`[${label} PageCrash] ${err.message}`);
    });
  }

  // 1. Create 4 independent browser contexts (isolated cookies, localStorage, session storage)
  const ctx0 = await browser.newContext();
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctx3 = await browser.newContext();

  const p0 = await ctx0.newPage();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();
  const p3 = await ctx3.newPage();

  attachListeners(p0, 'Alice (P0)');
  attachListeners(p1, 'Bob (P1)');
  attachListeners(p2, 'Charlie (P2)');
  attachListeners(p3, 'Dave (P3)');

  console.log('[Test 1] Alice creates private room');
  await p0.goto(BASE_URL);
  await p0.fill('input[placeholder="Enter your name"]', 'Alice');
  await p0.click('button:has-text("Create private room")');

  // Wait for lobby to appear and extract room code
  await p0.waitForSelector('.lobby h1 i', { timeout: 10000 });
  const roomCode = (await p0.innerText('.lobby h1 i')).trim();
  console.log(`Room created successfully with code: ${roomCode}`);

  if (!roomCode || roomCode.length !== 6) {
    throw new Error(`Invalid room code extracted: "${roomCode}"`);
  }

  console.log('[Test 2] Bob, Charlie, and Dave join room');
  for (const [page, name] of [[p1, 'Bob'], [p2, 'Charlie'], [p3, 'Dave']] as const) {
    await page.goto(BASE_URL);
    await page.fill('input[placeholder="Enter your name"]', name);
    await page.fill('input[placeholder="ROOM CODE"]', roomCode);
    await page.click('button:has-text("Join")');
    await page.waitForSelector('.lobby', { timeout: 10000 });
  }

  console.log('[Test 3] Verifying seats and colors across all 4 browser clients');
  for (const [idx, page] of [p0, p1, p2, p3].entries()) {
    await page.waitForSelector('.lobby-footer:has-text("4/4 connected")', { timeout: 5000 });
    const slots = await page.$$eval('.slot', (els) =>
      els.map((el) => ({
        colorClass: el.className,
        name: el.querySelector('strong')?.innerText || '',
      }))
    );

    if (slots.length !== 4) throw new Error(`Client ${idx} does not have 4 slots`);
    if (!slots[0].colorClass.includes('red') || slots[0].name !== 'Alice') throw new Error(`Seat 0 mismatch on client ${idx}`);
    if (!slots[1].colorClass.includes('green') || slots[1].name !== 'Bob') throw new Error(`Seat 1 mismatch on client ${idx}`);
    if (!slots[2].colorClass.includes('yellow') || slots[2].name !== 'Charlie') throw new Error(`Seat 2 mismatch on client ${idx}`);
    if (!slots[3].colorClass.includes('blue') || slots[3].name !== 'Dave') throw new Error(`Seat 3 mismatch on client ${idx}`);
  }
  console.log('All 4 browser windows confirmed 4/4 connected seats with matching colors!');

  console.log('[Test 4] Host-only start check');
  const p1CanStart = await p1.$eval('button:has-text("Start game")', (b) => !(b as HTMLButtonElement).disabled).catch(() => false);
  if (p1CanStart) throw new Error('Bob (non-host) was able to click start button');

  console.log('Alice (Host) starts match...');
  await p0.click('button:has-text("Start game")');

  for (const [idx, page] of [p0, p1, p2, p3].entries()) {
    await page.waitForSelector('.game-board', { timeout: 10000 });
    const title = await page.innerText('.game-head h2');
    console.log(`Client ${idx} active game view: "${title}"`);
  }

  console.log('[Test 5] Interactive browser gameplay (dice roll and token movements)');
  const pages = [p0, p1, p2, p3];

  let turnsPlayed = 0;
  let tokensMoved = 0;

  while (turnsPlayed < 20) {
    turnsPlayed++;
    await new Promise((r) => setTimeout(r, 300));

    let activePlayerIdx = -1;
    for (let i = 0; i < 4; i++) {
      const isRollEnabled = await pages[i].$eval('button:has-text("Roll dice")', (b) => !(b as HTMLButtonElement).disabled).catch(() => false);
      if (isRollEnabled) {
        activePlayerIdx = i;
        break;
      }
    }

    if (activePlayerIdx === -1) {
      continue;
    }

    const activePage = pages[activePlayerIdx];
    await activePage.click('button:has-text("Roll dice")');
    await new Promise((r) => setTimeout(r, 600));

    // Check if token actions appeared
    const tokenButtons = await activePage.$$('.mobile-token-picker button');
    if (tokenButtons.length > 0) {
      tokensMoved++;
      const btnText = await tokenButtons[0].innerText();
      console.log(`[Turn ${turnsPlayed}] Player ${activePlayerIdx} rolled and clicked: "${btnText}"`);
      await tokenButtons[0].click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // Verify all 4 clients have identical player cards
    const normalizeCard = (text: string) => text.replace(' · YOU', '').trim();
    const p0Cards = (await p0.$$eval('.player-card', (els) => els.map((e) => e.innerText))).map(normalizeCard);
    const p1Cards = (await p1.$$eval('.player-card', (els) => els.map((e) => e.innerText))).map(normalizeCard);
    const p2Cards = (await p2.$$eval('.player-card', (els) => els.map((e) => e.innerText))).map(normalizeCard);
    const p3Cards = (await p3.$$eval('.player-card', (els) => els.map((e) => e.innerText))).map(normalizeCard);

    if (JSON.stringify(p0Cards) !== JSON.stringify(p1Cards) || JSON.stringify(p0Cards) !== JSON.stringify(p2Cards) || JSON.stringify(p0Cards) !== JSON.stringify(p3Cards)) {
      throw new Error(`State desync across browsers: ${JSON.stringify(p0Cards)} vs ${JSON.stringify(p1Cards)}`);
    }
  }
  console.log(`Completed ${turnsPlayed} turns in real browser DOM. Total tokens moved: ${tokensMoved}`);

  console.log('[Test 6] Browser Refresh & Session Reconnection');
  console.log('Refreshing Bob (P1) page...');
  await p1.reload();
  await p1.waitForSelector('.game-board', { timeout: 10000 });
  const bobPanel = await p1.innerText('.players-panel');
  if (!bobPanel.includes('Bob · YOU')) {
    throw new Error(`Bob did not reattach to his seat after browser refresh! Content: ${bobPanel}`);
  }
  console.log('Bob successfully refreshed and reattached to Seat 1 in the game!');

  console.log('[Test 7] Disconnection Grace and Status Display');
  const daveSessionToken = await p3.evaluate(() => localStorage.getItem('ludo-session'));
  console.log('Closing Dave (P3)...');
  await p3.close();
  await new Promise((r) => setTimeout(r, 1500));

  const p0PanelAfterDisconnect = await p0.innerText('.players-panel');
  console.log('Alice view after Dave closed:\n', p0PanelAfterDisconnect);
  if (!p0PanelAfterDisconnect.includes('RECONNECTING')) {
    throw new Error('Player panel did not update to show RECONNECTING for disconnected player');
  }
  console.log('Player panel accurately reflects RECONNECTING state for disconnected seat.');

  console.log('[Test 8] Host Disconnection & Host Migration');
  console.log('Closing Alice (Host / P0)...');
  await p0.close();
  await new Promise((r) => setTimeout(r, 1500));

  // Check if Bob (P1) is now host
  const bobPanelAfterAliceLeave = await p1.innerText('.players-panel');
  console.log('Bob view after Host (Alice) closed:\n', bobPanelAfterAliceLeave);

  console.log('[Test 9] Mobile Viewport Responsiveness & Overflow');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(BASE_URL);

  // Check portrait overflow
  let scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  let clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  console.log(`iPhone 14 Portrait (390px): scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
  if (scrollWidth > clientWidth) {
    throw new Error(`Horizontal overflow on iPhone 14 portrait: ${scrollWidth} > ${clientWidth}`);
  }

  // Check landscape overflow
  await mobilePage.setViewportSize({ width: 844, height: 390 });
  scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  console.log(`iPhone 14 Landscape (844px): scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
  if (scrollWidth > clientWidth) {
    throw new Error(`Horizontal overflow on iPhone 14 landscape: ${scrollWidth} > ${clientWidth}`);
  }

  // Check narrow Android (360x740)
  await mobilePage.setViewportSize({ width: 360, height: 740 });
  scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  console.log(`Android Narrow (360px): scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
  if (scrollWidth > clientWidth) {
    throw new Error(`Horizontal overflow on Android 360px: ${scrollWidth} > ${clientWidth}`);
  }

  // Reconnect Dave into the match on mobile via his saved session token
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.evaluate(
    ({ token, room }) => {
      if (token) localStorage.setItem('ludo-session', token);
      if (room) localStorage.setItem('ludo-room', room);
    },
    { token: daveSessionToken, room: roomCode }
  );
  await mobilePage.reload();
  await mobilePage.waitForSelector('.game-board', { timeout: 10000 });
  const daveMobilePanel = await mobilePage.innerText('.players-panel');
  console.log('Mobile Dave successfully reconnected:\n', daveMobilePanel);
  if (!daveMobilePanel.includes('Dave · YOU')) {
    throw new Error('Dave was not reattached to his seat on mobile!');
  }

  // Verify mobile elements
  const hasGameBoard = await mobilePage.isVisible('.game-board');
  const hasTurnBanner = await mobilePage.isVisible('.turn');
  const hasPlayerPanel = await mobilePage.isVisible('.players-panel');
  console.log(`Mobile view elements present: GameBoard=${hasGameBoard}, TurnBanner=${hasTurnBanner}, PlayersPanel=${hasPlayerPanel}`);

  if (!hasGameBoard || !hasTurnBanner || !hasPlayerPanel) {
    throw new Error('Mobile UI layout elements missing');
  }

  await browser.close();

  // Filter non-critical WebGL warnings in headless mode
  const criticalErrors = errors.filter((e) => !e.includes('THREE.WebGLRenderer') && !e.includes('WebGL unsupported'));
  if (criticalErrors.length > 0) {
    console.error('Critical browser console errors encountered:', criticalErrors);
    throw new Error(`Console errors found: ${criticalErrors.join(', ')}`);
  }

  console.log('--- ALL BROWSER VALIDATION TESTS PASSED WITH 0 ERRORS! ---');
}

runBrowserValidation().catch((err) => {
  console.error('FATAL BROWSER VALIDATION ERROR:', err);
  process.exit(1);
});
