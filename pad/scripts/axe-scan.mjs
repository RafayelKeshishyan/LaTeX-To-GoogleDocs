// WCAG scan of the Pad's main states with axe-core.
// This covers the mechanical layer only: contrast, ARIA validity, names, duplicate ids.
// Verbosity, announcement order, and math wording stay in sr-student-walkthrough.mjs
// and the manual checklist in docs/math-pad-a11y-test.md.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const BASE = process.env.PAD_URL || 'http://localhost:5173/';
const TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

const failures = [];
let scans = 0;

function report(state, results) {
  scans += 1;
  const violations = results.violations.filter((v) => v.nodes.length);
  if (!violations.length) {
    console.log(`OK: ${state} — no violations`);
    return;
  }
  for (const violation of violations) {
    failures.push(`${state}: ${violation.id}`);
    console.log(`ISSUE: ${state} — ${violation.id} (${violation.impact}) ${violation.help}`);
    for (const node of violation.nodes.slice(0, 3)) {
      console.log(`       ${node.target.join(' ')}`);
    }
  }
}

async function scan(page, state) {
  report(state, await new AxeBuilder({ page }).withTags(TAGS).analyze());
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
// axe-core requires an explicit context rather than browser.newPage().
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

if (await page.locator('#account-heading').isVisible().catch(() => false)) {
  await scan(page, 'Sign in screen');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForTimeout(150);
  await scan(page, 'Create account screen');
  await page.getByRole('button', { name: 'Continue with personal practice' }).click();
}

await page.locator('.linear-editor .linear-input').waitFor({ timeout: 10_000 });
await scan(page, 'Editor, equation selected');

const linear = page.locator('.linear-editor .linear-input');
await linear.fill('y=\\sqrt{x+3}');
await page.keyboard.press('Alt+Enter');
await page.waitForTimeout(150);
await scan(page, 'Hear math preview open');
await page.keyboard.press('Escape');

// Invalid input paints an error on the field and blocks the preview.
await linear.fill('\\sqrt{');
await page.keyboard.press('Alt+Enter');
await page.waitForTimeout(150);
await scan(page, 'Invalid equation error');
await linear.fill('y=\\sqrt{x+3}');

// Expand every disclosure and the examples list so their contents are scanned too.
const examples = page.getByRole('button', { name: 'Show practice examples' });
if (await examples.count()) await examples.click();
await page.locator('details:not([open]) > summary').evaluateAll((summaries) =>
  summaries.forEach((s) => s.parentElement?.setAttribute('open', '')),
);
await page.waitForTimeout(150);
await scan(page, 'Disclosures and examples expanded');

await page.keyboard.press('Alt+N');
await page.waitForTimeout(150);
await scan(page, 'Note selected');
await page.locator('#prose-focus-target').fill('Because the radius doubles.');

await page.keyboard.press('Alt+R');
await page.locator('#review-panel').waitFor({ timeout: 10_000 });
await scan(page, 'Review dialog open');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

await page.getByRole('button', { name: 'Quick help' }).click();
await page.waitForTimeout(150);
await scan(page, 'Quick help dialog open');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

const simpleUi =
  (await page.locator('.app').getAttribute('data-student-simple-ui')) === 'true';

// Confirmation that remains necessary when downloading with an empty answer.
await page.keyboard.press('Alt+=');
await page.waitForTimeout(100);
await page.getByRole('button', { name: 'Download Word', exact: true }).click();
const confirm = page.locator('.confirm-dialog');
if (await confirm.count()) {
  await scan(page, 'Empty-answer confirmation dialog');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

if (!simpleUi) {
  // Class dialog, then assignment mode where every label changes.
  await page.locator('details:not([open]) > summary').evaluateAll((summaries) =>
    summaries.forEach((s) => s.parentElement?.setAttribute('open', '')),
  );
  await page.getByRole('button', { name: 'New class' }).click();
  await page.waitForTimeout(200);
  await scan(page, 'New class dialog');
  await page.locator('.class-dialog input').fill('Algebra 1');
  await page.locator('.class-dialog').getByRole('button', { name: /Create|Save/ }).first().click();
  await page.waitForTimeout(250);
  await scan(page, 'Assignment mode');
} else {
  console.log('OK: Class dialog skipped — student simple UI');
}

// Saving blocked by the browser surfaces a persistent warning.
await page.evaluate(() => {
  Storage.prototype.setItem = () => {
    throw new Error('blocked');
  };
});
await page.locator('.title-field input').fill('Storage blocked');
await page.keyboard.press('Control+s');
await page.waitForTimeout(400);
await scan(page, 'Local save blocked warning');

await browser.close();

console.log('\n=== SUMMARY ===');
console.log(`States scanned: ${scans}`);
console.log(`Violations: ${failures.length}`);
if (failures.length) process.exit(1);
