// Structural audit for the problems axe does not report.
// These are the "it passes WCAG but sounds wrong" defects: a landmark sharing its
// name with the field inside it, unlabeled Tab stops, two controls with one name,
// and more than one live region competing to speak.
import { chromium } from 'playwright';

const BASE = process.env.PAD_URL || 'http://localhost:5173/';

const failures = [];
let passed = 0;

function ok(message) {
  passed += 1;
  console.log(`OK: ${message}`);
}

function issue(message) {
  failures.push(message);
  console.log(`ISSUE: ${message}`);
}

/** Runs in the browser: approximate accessible names and collect the Tab order. */
function auditPage() {
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function name(el) {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      return labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '')
        .join(' ')
        .trim();
    }
    const label = el.getAttribute('aria-label');
    if (label) return label.trim();
    if (el.id) {
      const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (forLabel) return forLabel.textContent?.trim() || '';
    }
    const wrapping = el.closest('label');
    if (wrapping) {
      // Exclude the control's own text (a select would otherwise contribute every option).
      const copy = wrapping.cloneNode(true);
      copy.querySelectorAll('input,select,textarea').forEach((c) => c.remove());
      return (copy.textContent || '').replace(/\s+/g, ' ').trim();
    }
    const title = el.getAttribute('title');
    if (title) return title.trim();
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function visible(el) {
    if (!el.getClientRects().length) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog && !el.closest('dialog[open]')) return false;
    const details = el.closest('details');
    if (details && !details.open && !el.matches('summary')) return false;
    return true;
  }

  const describe = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
      el.className && typeof el.className === 'string'
        ? `.${el.className.split(/\s+/).filter(Boolean).join('.')}`
        : ''
    }`;

  const tabStops = [...document.querySelectorAll(FOCUSABLE)]
    .filter(visible)
    .map((el) => ({ name: name(el), selector: describe(el) }));

  // A landmark whose name repeats on a control inside it makes screen readers say
  // the same words twice on entry.
  const landmarks = [
    ...document.querySelectorAll(
      'main,nav,aside,form[aria-label],form[aria-labelledby],section[aria-label],section[aria-labelledby],[role="region"],[role="main"],[role="navigation"]',
    ),
  ].filter(visible);

  const nameCollisions = [];
  for (const landmark of landmarks) {
    const landmarkName = name(landmark);
    if (!landmarkName) continue;
    for (const el of landmark.querySelectorAll(FOCUSABLE)) {
      if (!visible(el)) continue;
      if (name(el) === landmarkName) {
        nameCollisions.push({ landmark: describe(landmark), name: landmarkName });
        break;
      }
    }
  }

  const liveRegions = [
    ...document.querySelectorAll('[role="status"],[role="alert"],[aria-live]'),
  ]
    .filter((el) => !el.closest('[aria-hidden="true"]'))
    .map(describe);

  // Two different Tab stops with the same name make JAWS/NVDA hard to tell apart.
  // Identical Close buttons that do the same thing are allowed.
  const nameCounts = new Map();
  for (const stop of tabStops) {
    if (!stop.name) continue;
    const list = nameCounts.get(stop.name) || [];
    list.push(stop.selector);
    nameCounts.set(stop.name, list);
  }
  const duplicateNames = [...nameCounts.entries()]
    .filter(([, selectors]) => selectors.length > 1)
    .map(([name, selectors]) => ({ name, selectors }));

  return { tabStops, nameCollisions, liveRegions, duplicateNames };
}

async function audit(page, state, { maxTabStops }) {
  const { tabStops, nameCollisions, liveRegions, duplicateNames } = await page.evaluate(auditPage);

  const unnamed = tabStops.filter((stop) => !stop.name);
  if (unnamed.length) {
    issue(`${state}: ${unnamed.length} Tab stop(s) with no accessible name — ${unnamed
      .map((s) => s.selector)
      .join(', ')}`);
  } else {
    ok(`${state}: all ${tabStops.length} Tab stops are named`);
  }

  for (const collision of nameCollisions) {
    issue(`${state}: landmark ${collision.landmark} shares the name "${collision.name}" with a control inside it`);
  }
  if (!nameCollisions.length) ok(`${state}: no landmark repeats a control's name`);

  const confusingDuplicates = duplicateNames.filter(
    ({ name }) => !/^Close /i.test(name),
  );
  for (const dup of confusingDuplicates) {
    issue(
      `${state}: ${dup.selectors.length} Tab stops share the name "${dup.name}" — ${dup.selectors.join(', ')}`,
    );
  }
  if (!confusingDuplicates.length) ok(`${state}: no confusing duplicate control names`);

  if (liveRegions.length > 1) {
    issue(`${state}: ${liveRegions.length} live regions can speak at once — ${liveRegions.join(', ')}`);
  } else {
    ok(`${state}: at most one live region`);
  }

  if (maxTabStops && tabStops.length > maxTabStops) {
    issue(`${state}: ${tabStops.length} default Tab stops exceeds the ${maxTabStops} budget`);
  } else if (maxTabStops) {
    ok(`${state}: ${tabStops.length} default Tab stops (budget ${maxTabStops})`);
  }

  return tabStops;
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

if (await page.locator('#account-heading').isVisible().catch(() => false)) {
  await audit(page, 'Sign in screen', {});
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForTimeout(100);
  await audit(page, 'Create account screen', {});
  await page.getByRole('button', { name: 'Continue with personal practice' }).click();
}

await page.locator('.linear-editor .linear-input').waitFor({ timeout: 10_000 });
const editorStops = await audit(page, 'Editor, equation selected', { maxTabStops: 20 });
console.log('\nDefault Tab order while editing an equation:');
editorStops.forEach((stop, i) => console.log(`  ${i + 1}. ${stop.name}`));

await page.keyboard.press('Alt+N');
await page.waitForTimeout(150);
await audit(page, 'Note selected', { maxTabStops: 20 });

await page.keyboard.press('Alt+R');
await page.locator('#review-panel').waitFor({ timeout: 10_000 });
await audit(page, 'Review dialog open', {});
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

await page.getByRole('button', { name: 'Quick help' }).click();
await page.waitForTimeout(150);
await audit(page, 'Quick help dialog open', {});

await browser.close();

console.log('\n=== SUMMARY ===');
console.log(`Issues: ${failures.length}`);
console.log(`Passed checks: ${passed}`);
if (failures.length) process.exit(1);
