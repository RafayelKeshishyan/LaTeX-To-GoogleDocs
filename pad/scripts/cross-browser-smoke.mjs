/**
 * Production-build smoke test for the browser engines used by Chrome/Edge,
 * Firefox, and Safari. WebKit on Windows is an approximation of Safari; final
 * VoiceOver behavior still needs a short run in Safari on macOS.
 *
 * Run: npm.cmd run build && npm.cmd run test:browsers
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, firefox, webkit } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE = `http://${HOST}:${PORT}/`;
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const padRoot = fileURLToPath(new URL('..', import.meta.url));

const targets = [
  { name: 'Google Chrome', browserType: chromium, launch: { channel: 'chrome' } },
  { name: 'Microsoft Edge', browserType: chromium, launch: { channel: 'msedge' }, optional: true },
  { name: 'Firefox', browserType: firefox, launch: {} },
  { name: 'WebKit (Safari engine)', browserType: webkit, launch: {} },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited with code ${child.exitCode}`);
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for the production preview server.');
}

async function focusDescription(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return 'none';
    return active.getAttribute('aria-label') || active.textContent?.trim() || active.tagName;
  });
}

async function assertFocused(page, locator, message) {
  await locator.waitFor({ state: 'visible' });
  const element = await locator.elementHandle();
  try {
    await page.waitForFunction((candidate) => document.activeElement === candidate, element, {
      timeout: 2_000,
    });
  } catch {
    throw new Error(`${message}; focused ${await focusDescription(page)}`);
  }
}

async function runTarget(target) {
  console.log(`RUN: ${target.name}`);
  let browser;
  try {
    browser = await target.browserType.launch({ headless: true, ...target.launch });
  } catch (error) {
    if (target.optional && /executable|not found|install/i.test(String(error))) {
      console.log(`SKIP: ${target.name} is not installed`);
      return { skipped: true };
    }
    throw error;
  }

  const consoleErrors = [];
  const pageErrors = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('browser-smoke-ready')) return;
      sessionStorage.setItem('browser-smoke-ready', '1');
      localStorage.removeItem('digimath-pad-document-v2');
      localStorage.removeItem('digimath-pad-library-v3');
      localStorage.removeItem('digimath-pad-library-v4');
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.locator('#account-heading, .title-field input').first().waitFor({ state: 'visible' });

    const accountHeading = page.locator('#account-heading');
    if (await accountHeading.isVisible().catch(() => false)) {
      await assertFocused(page, accountHeading, 'Sign-in heading did not receive initial focus');
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await assertFocused(page, page.locator('#account-name'), 'Create-account switch did not focus Name');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await assertFocused(page, page.locator('#account-email'), 'Sign-in switch did not focus Email');
      await page.getByRole('button', { name: 'Continue with personal practice' }).click();
    }

    const title = page.locator('.title-field input');
    await title.waitFor({ state: 'visible' });
    await assertFocused(page, title, 'Practice title was not focused');

    await title.press('Enter');
    let linear = page.locator('.linear-editor .linear-input');
    await assertFocused(page, linear, 'Enter did not focus Linear');
    await linear.fill('x^2+1');

    await linear.press('Alt+Enter');
    const math = page.locator('.accessible-math math');
    await math.waitFor({ state: 'visible' });
    assert(
      (await math.locator('semantics').count()) === 1,
      'Math preview did not contain semantic MathML',
    );
    await assertFocused(page, math, 'Hear math did not focus MathML');
    await page.keyboard.press('Escape');
    await assertFocused(page, linear, 'Escape did not return to Linear');

    await page.getByRole('button', { name: /^New note/ }).click();
    const note = page.locator('#prose-focus-target');
    await assertFocused(page, note, 'New note did not focus note text');
    await note.fill('Include units');

    await page.getByRole('button', { name: /^New equation/ }).click();
    linear = page.locator('.linear-editor .linear-input');
    await assertFocused(page, linear, 'New equation did not focus Linear');
    await linear.fill('y=2');

    await linear.press('ArrowUp');
    await assertFocused(page, note, 'Up from Linear did not move to the note');
    await note.press('Alt+ArrowDown');
    linear = page.locator('.linear-editor .linear-input');
    await assertFocused(page, linear, 'Alt+Down from note did not move to the equation');

    const selectedWork = page.locator('#work-list [data-selected="true"]');
    await selectedWork.focus();
    await page.keyboard.press('Tab');
    const newEquation = page.getByRole('button', { name: /^New equation/ });
    await assertFocused(page, newEquation, 'Tab from Your work did not focus New equation');

    const reviewButton = page.getByRole('button', { name: /^Review answers/ });
    await reviewButton.click();
    const review = page.locator('#review-panel');
    const reviewElement = await review.elementHandle();
    await page.waitForFunction((element) => element.open, reviewElement);
    assert(
      (await page.locator('#review-panel .review-list button').count()) > 0,
      'Review list was unavailable',
    );
    await page.keyboard.press('ArrowUp');
    assert(
      await page.locator('#review-panel .review-list').evaluate((list) => list.contains(document.activeElement)),
      'Review arrows did not keep focus in the answer list',
    );
    await page.keyboard.press('Escape');
    assert(!(await review.evaluate((element) => element.open)), 'Escape did not close Review');
    await assertFocused(page, reviewButton, 'Closing Review did not focus Review answers');

    const helpButton = page.getByRole('button', { name: 'Quick help' });
    await helpButton.click();
    const helpDialog = page.locator('.help-dialog');
    const helpElement = await helpDialog.elementHandle();
    await page.waitForFunction((element) => element.open, helpElement);
    await page.keyboard.press('Escape');
    await assertFocused(page, helpButton, 'Closing Quick help did not return focus to its button');

    const remove = page.getByRole('button', { name: 'Remove current item' });
    await remove.focus();
    await remove.press('Enter');
    await assertFocused(page, remove, 'Remove did not keep toolbar focus');
    await page.waitForFunction(
      () => /^Removed (Equation|Note)/.test(document.querySelector('.status-live')?.textContent || ''),
    );
    assert(
      /^Removed (Equation|Note)/.test((await page.locator('.status-live').textContent()) || ''),
      'Remove did not announce the removed item first',
    );
    assert(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), 'Undo was unavailable after remove');

    await page.waitForTimeout(400);
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (await page.locator('#account-heading').isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Continue with personal practice' }).click();
    }
    const restoredEditor = page.locator('.linear-editor .linear-input');
    await restoredEditor.waitFor();
    assert(
      (await restoredEditor.inputValue()) === 'y=2',
      'Personal-practice work did not persist after reload',
    );

    assert(!pageErrors.length, `Page errors: ${pageErrors.join(' | ')}`);
    const relevantConsoleErrors = consoleErrors.filter(
      (message) => !/favicon|Failed to load resource.*404/i.test(message),
    );
    assert(!relevantConsoleErrors.length, `Console errors: ${relevantConsoleErrors.join(' | ')}`);

    await context.close();
    console.log(`OK: ${target.name}`);
    return { skipped: false };
  } finally {
    await browser.close();
  }
}

const preview = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'],
  { cwd: padRoot, stdio: ['ignore', 'pipe', 'pipe'] },
);
let previewOutput = '';
preview.stdout.on('data', (chunk) => { previewOutput += chunk; });
preview.stderr.on('data', (chunk) => { previewOutput += chunk; });

let failed = false;
try {
  await waitForServer(preview);
  for (const target of targets) {
    try {
      await runTarget(target);
    } catch (error) {
      failed = true;
      console.error(`FAIL: ${target.name}: ${error instanceof Error ? error.message : error}`);
    }
  }
} finally {
  preview.kill();
}

if (failed) {
  if (previewOutput.trim()) console.error(previewOutput.trim());
  process.exitCode = 1;
} else {
  console.log('Cross-browser production smoke test passed.');
}
