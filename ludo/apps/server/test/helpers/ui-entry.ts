/**
 * Shared browser choreography for the Rollverse landing page.
 *
 * The landing screen no longer renders a name field inline: "Play Now" opens the
 * create sheet, while "Play with Friends" (or any `/?room=CODE` invite link) opens
 * the join sheet. Both sheets live in `.rv-entry` and submit through
 * `.rv-entry-submit`, so every audit goes through these helpers instead of
 * re-encoding the flow.
 */
import type { Page } from 'playwright';

export async function openEntrySheet(page: Page, mode: 'create' | 'join'): Promise<void> {
  if (await page.locator('.rv-entry').isVisible().catch(() => false)) return;
  const label = mode === 'join' ? 'Play with Friends' : 'Play Now';
  await page.getByRole('button', { name: label }).first().click();
  await page.locator('.rv-entry').waitFor({ state: 'visible', timeout: 15000 });
}

export async function fillEntryName(page: Page, name: string): Promise<void> {
  await page.locator('.rv-entry .royal-input').first().fill(name);
}

/** The submit button is disabled until the socket is ready and the fields are valid. */
export async function submitEntry(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const socket = (window as any).__SOCKET__;
        const button = document.querySelector<HTMLButtonElement>('.rv-entry-submit');
        return !!button && !button.disabled && (!socket || socket.connected);
      },
      null,
      { timeout: 15000 }
    )
    .catch(() => undefined);
  await page.locator('.rv-entry-submit').click();
}

/** Creates a private table from the homepage and returns its six-character room code. */
export async function createTable(page: Page, name: string): Promise<string> {
  await openEntrySheet(page, 'create');
  await fillEntryName(page, name);
  await submitEntry(page);
  const tag = page.locator('.room-code-tag');
  await tag.waitFor({ state: 'visible', timeout: 20000 });
  const text = (await tag.textContent()) ?? '';
  return text.replace('ROOM #', '').trim();
}

/** Opens the invite link, fills the join sheet and waits for the lobby. */
export async function joinTable(page: Page, name: string, roomCode: string): Promise<void> {
  const url = new URL(page.url());
  if (url.searchParams.get('room') !== roomCode) {
    await page.goto(`${url.origin}/?room=${roomCode}`, { waitUntil: 'domcontentloaded' });
  }
  await page.locator('.rv-entry').waitFor({ state: 'visible', timeout: 15000 });
  const inputs = page.locator('.rv-entry .royal-input');
  await inputs.nth(0).fill(name);
  if ((await inputs.count()) > 1) await inputs.nth(1).fill(roomCode);
  await submitEntry(page);
  await page.waitForSelector('.lobby-container', { timeout: 20000 });
}
