import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.PAD_URL || 'http://localhost:5173/';
const PERSONAL_KEY = 'digimath-pad-library-v4';

function parseEnv(raw) {
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim().replace(/^(["'])(.*)\1$/, '$2')]),
  );
}

function tokenPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const env = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
const projectUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
if (!projectUrl) throw new Error('VITE_SUPABASE_URL is required for the cloud browser test.');

const projectRef = new URL(projectUrl).hostname.split('.')[0];
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function accountKey(userId) {
  return `${PERSONAL_KEY}:account:${userId}`;
}

function buildSession(userId, email) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `${tokenPart({ alg: 'none', typ: 'JWT' })}.${tokenPart({
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated',
    exp: expiresAt,
  })}.test`;
  return {
    accessToken,
    session: {
      access_token: accessToken,
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      expires_at: expiresAt,
      token_type: 'bearer',
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    },
  };
}

function library(title, latex) {
  const now = new Date().toISOString();
  const id = `sheet-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return {
    version: 4,
    activeSheetId: id,
    activeClassId: 'class-practice',
    classes: [{ id: 'class-practice', name: 'Practice', createdAt: now }],
    sheets: [
      {
        id,
        title,
        blocks: [{ id: `${id}-equation`, type: 'equation', latex }],
        createdAt: now,
        updatedAt: now,
        classId: 'class-practice',
        kind: 'practice',
      },
    ],
  };
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const failures = [];
let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK: ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`ISSUE: ${message}`);
}

/**
 * Opens the Pad with a faked signed-in session and a scripted Supabase backend.
 * `cloud` decides what GET /personal_workspaces returns and can change mid-test.
 */
async function openPad({ userId, email = 'student@example.test', storage = {}, cloud }) {
  const { session, accessToken } = buildSession(userId, email);
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = { saves: [], authenticatedWrite: false };

  await page.addInitScript(
    ({ authKey, authValue, seed }) => {
      localStorage.clear();
      localStorage.setItem(authKey, JSON.stringify(authValue));
      for (const [key, value] of Object.entries(seed)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { authKey: `sb-${projectRef}-auth-token`, authValue: session, seed: storage },
  );

  await page.route(`${projectUrl}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/rest/v1/profiles') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ display_name: 'Test Student' }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/personal_workspaces' && request.method() === 'GET') {
      const result = cloud();
      if (result === 'error') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'cloud unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(result ? { content: result } : []),
      });
      return;
    }

    if (url.pathname === '/rest/v1/personal_workspaces' && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.saves.push(body.content);
      state.authenticatedWrite = request.headers().authorization === `Bearer ${accessToken}`;
      await route.fulfill({ status: 201, contentType: 'application/json', body: '' });
      return;
    }

    if (url.pathname === '/auth/v1/user') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  return { page, context, state };
}

function title(page) {
  return page.locator('.title-field input').inputValue();
}

// 1. An existing account workspace loads and autosaves.
{
  const remote = library('Cloud restored practice', 'x^2');
  const { page, context, state } = await openPad({ userId: USER_A, cloud: () => remote });
  await page.waitForSelector('.title-field input', { timeout: 10_000 });

  if ((await title(page)) === remote.sheets[0].title) ok('a signed-in session loads its private cloud workspace');
  else fail(`cloud workspace was not restored (saw "${await title(page)}")`);

  await page.locator('.title-field input').fill('Cloud autosave verified');
  await page.waitForFunction(
    () => document.querySelector('.save-state')?.textContent?.includes('Saved to your account.'),
    null,
    { timeout: 10_000 },
  );

  if (state.saves.at(-1)?.sheets?.[0]?.title === 'Cloud autosave verified') {
    ok('edits autosave to the account');
  } else fail('the edited cloud workspace was not sent to Supabase');

  if (state.authenticatedWrite) ok('the cloud save carries the signed-in session');
  else fail('the cloud save did not include the signed-in session');

  await context.close();
}

// 2. Personal browser work is never adopted silently by a new account.
{
  const personal = library('Personal only practice', 'a+b');
  const { page, context } = await openPad({
    userId: USER_A,
    storage: { [PERSONAL_KEY]: personal },
    cloud: () => null,
  });

  const heading = page.getByRole('heading', { name: 'Start your account workspace' });
  await heading.waitFor({ timeout: 10_000 });
  ok('a first sign-in asks before copying personal practice work');

  if (!(await page.locator('.title-field input').isVisible().catch(() => false))) {
    ok('personal work is not opened in the account until the student chooses');
  } else fail('the editor opened on personal work before the student chose');

  await page.getByRole('button', { name: 'Start with an empty workspace' }).click();
  await page.waitForSelector('.title-field input', { timeout: 10_000 });

  if ((await title(page)) !== personal.sheets[0].title) ok('an empty account workspace stays empty');
  else fail('personal work leaked into the account workspace');

  const personalKept = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || 'null')?.sheets?.[0]?.title,
    PERSONAL_KEY,
  );
  if (personalKept === personal.sheets[0].title) ok('personal practice work is left untouched');
  else fail('personal practice work was modified by signing in');

  await context.close();
}

// 3. One browser, two accounts: neither can see the other's saved work.
{
  const otherStudent = library('Student A homework', 'x^3');
  const { page, context } = await openPad({
    userId: USER_B,
    email: 'second@example.test',
    storage: { [accountKey(USER_A)]: otherStudent },
    cloud: () => null,
  });
  await page.waitForSelector('.title-field input', { timeout: 10_000 });

  if ((await title(page)) !== otherStudent.sheets[0].title) {
    ok('a second account on the same browser cannot see the first account\u2019s work');
  } else fail('another account\u2019s work appeared in this account');

  const stillThere = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || 'null')?.sheets?.[0]?.title,
    accountKey(USER_A),
  );
  if (stillThere === otherStudent.sheets[0].title) ok('the first account\u2019s work is preserved');
  else fail('the first account\u2019s work was overwritten');

  await context.close();
}

// 4. A failed load keeps working locally, and retry never discards on-screen work.
{
  const remote = library('Older account copy', 'x^2');
  let mode = 'error';
  const { page, context, state } = await openPad({
    userId: USER_A,
    cloud: () => (mode === 'error' ? 'error' : remote),
  });

  await page.waitForSelector('.title-field input', { timeout: 10_000 });
  ok('an unreachable account still opens the editor');

  const retry = page.getByRole('button', { name: 'Try my account again' });
  if (await retry.isVisible()) ok('the account failure offers a retry');
  else fail('no retry control was offered after a failed load');

  await page.locator('.linear-editor .linear-input').fill('c=\\sqrt{a^2+b^2}');
  await page.locator('.title-field input').fill('Work typed while offline');
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key) || 'null')?.sheets?.some(
        (s) => s.title === 'Work typed while offline',
      ),
    accountKey(USER_A),
    { timeout: 10_000 },
  );
  ok('offline work is saved under this account in the browser');

  mode = 'ready';
  await retry.click();

  await page.getByRole('heading', { name: 'Two versions of your work' }).waitFor({ timeout: 10_000 });
  ok('a differing account copy becomes an explicit choice instead of an overwrite');

  await page.getByRole('button', { name: /^Keep this browser/ }).click();
  await page.waitForSelector('.title-field input', { timeout: 10_000 });

  if ((await title(page)) === 'Work typed while offline') ok('retry keeps the work that was on screen');
  else fail(`retry replaced the student\u2019s work (saw "${await title(page)}")`);

  if (state.saves.some((saved) => saved?.sheets?.some((s) => s.title === 'Work typed while offline'))) {
    ok('the kept work is uploaded to the account');
  } else fail('the kept work was never uploaded');

  await context.close();
}

// 5. An untouched offline session must never wipe the account copy on retry.
{
  const remote = library('Account copy with real work', 'x^2+1');
  let mode = 'error';
  const { page, context, state } = await openPad({
    userId: USER_A,
    cloud: () => (mode === 'error' ? 'error' : remote),
  });
  await page.waitForSelector('.title-field input', { timeout: 10_000 });

  mode = 'ready';
  await page.getByRole('button', { name: 'Try my account again' }).click();
  await page.waitForFunction(
    (expected) => document.querySelector('.title-field input')?.value === expected,
    remote.sheets[0].title,
    { timeout: 10_000 },
  );
  ok('retry restores the account copy when nothing was typed offline');

  if (!state.saves.some((saved) => !saved?.sheets?.some((s) => s.blocks?.some((b) => b.latex)))) {
    ok('an empty offline session never overwrites the account copy');
  } else fail('an empty offline session overwrote the account copy');

  await context.close();
}

await browser.close();

console.log('\n=== SUMMARY ===');
console.log(`Issues: ${failures.length}`);
console.log(`Passed checks: ${passed}`);
if (failures.length) process.exit(1);
