import { chromium } from 'playwright';
import JSZip from 'jszip';

const BASE = process.env.PAD_URL || 'http://localhost:5173/';
const failures = [];

function ok(message) {
  console.log(`OK: ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!/Executable doesn't exist|playwright install/i.test(String(error))) throw error;
    return chromium.launch({ headless: true, channel: 'chrome' });
  }
}

async function main() {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.removeItem('digimath-pad-library-v4');
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    if (await page.locator('#account-heading').isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Continue with personal practice' }).click();
    }

    const editor = page.locator('.linear-editor textarea');
    await editor.waitFor();
    await editor.fill('y=\\sqrt{x+3}');
    await editor.focus();
    await page.keyboard.press('Alt+=');
    await page.waitForFunction(() => document.querySelectorAll('.doc-pane .block-select').length === 2);
    await editor.fill('\\frac{1}{x^2}');

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Download Word' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const archive = await JSZip.loadAsync(Buffer.concat(chunks));
    const documentXml = await archive.file('word/document.xml')?.async('string');
    const contentTypes = await archive.file('[Content_Types].xml')?.async('string');

    if (!download.suggestedFilename().endsWith('.docx')) fail('download does not use the .docx extension');
    else ok('download uses the .docx extension');

    if (!contentTypes?.includes('wordprocessingml.document.main+xml')) {
      fail('download is not a valid WordprocessingML package');
    } else {
      ok('download is a valid WordprocessingML package');
    }

    const requiredOmml = ['<m:oMath', '<m:rad', '<m:f', '<m:sSup'];
    const missing = requiredOmml.filter((token) => !documentXml?.includes(token));
    if (missing.length) fail(`Word document is missing native OMML structures: ${missing.join(', ')}`);
    else ok('Word document contains native radical, fraction, and superscript OMML');

    if (documentXml?.includes('<w:drawing')) fail('Word equations were exported as drawings');
    else ok('Word equations are not images or drawings');

    if (!documentXml?.includes('Equation 1') || !documentXml.includes('Equation 2')) {
      fail('Word document does not preserve equation order and labels');
    } else {
      ok('Word document preserves equation order and labels');
    }

    if (!documentXml?.includes('w:val="Heading1"') || !documentXml.includes('w:val="Heading2"')) {
      fail('Word document does not use navigable heading styles');
    } else {
      ok('Word document uses navigable heading styles');
    }
  } finally {
    await browser.close();
  }
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
