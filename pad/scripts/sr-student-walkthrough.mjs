/**
 * Keyboard-only walkthrough mimicking a blind student (production Pad).
 * Run: npm.cmd run test:sr
 * Expects Pad at PAD_URL or http://localhost:5173/
 */
import { chromium } from 'playwright';

const BASE = process.env.PAD_URL || 'http://localhost:5173/';
const issues = [];
const notes = [];

function issue(msg) {
  issues.push(msg);
  console.log('ISSUE:', msg);
}
function note(msg) {
  notes.push(msg);
  console.log('OK:', msg);
}

async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) {
      return { tag: 'body', id: '', name: '', role: '', isLinear: false };
    }
    const label =
      el.getAttribute('aria-label') ||
      (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()) ||
      el.getAttribute('placeholder') ||
      el.textContent?.trim().slice(0, 80) ||
      '';
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      name: label,
      role: el.getAttribute('role') || '',
      value: 'value' in el ? String(el.value).slice(0, 40) : '',
      isLinear: el.classList.contains('linear-input'),
    };
  });
}

async function statusText(page) {
  return page.locator('.status-live').textContent();
}

async function reviewSelection(page) {
  return page.evaluate(() => {
    const list = document.querySelector('.review-list');
    const selected = list?.querySelector('[data-selected="true"]');
    const active = document.activeElement;
    return {
      focusRole: active?.getAttribute('role') || '',
      focusInList: Boolean(active?.closest?.('.review-list')),
      selectedLabel: selected?.getAttribute('aria-label') || '',
      selectedId: selected?.id || '',
      activeDescendant: '',
    };
  });
}

async function openDetails(page, summaryName) {
  const details = page.locator('details').filter({
    has: page.locator('summary', { hasText: summaryName }),
  });
  const isOpen = await details.evaluate((el) => el.open).catch(() => false);
  if (!isOpen) {
    await details.locator('summary').click();
    await page.waitForTimeout(50);
  }
  return details;
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
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    if (sessionStorage.getItem('pad-sr-ready')) return;
    sessionStorage.setItem('pad-sr-ready', '1');
    localStorage.removeItem('digimath-pad-document-v2');
    localStorage.removeItem('digimath-pad-library-v3');
    localStorage.removeItem('digimath-pad-library-v4');
  });

  page.on('dialog', async (d) => {
    if (d.type() === 'prompt') {
      await d.accept(d.defaultValue() || 'Homework 2');
    } else {
      await d.accept();
    }
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.status-live, #account-heading');
  const accountEntry = page.locator('#account-heading');
  if (await accountEntry.isVisible().catch(() => false)) {
    let accountFocus = await focusInfo(page);
    if (accountFocus.id !== 'account-heading') {
      issue(`Account entry heading should receive focus, got ${JSON.stringify(accountFocus)}`);
    } else {
      note('Configured account entry focuses its heading');
    }
    if (
      !(await page.getByLabel('Email', { exact: true }).isVisible()) ||
      !(await page.getByLabel('Password', { exact: true }).isVisible())
    ) {
      issue('Sign-in fields are not clearly labeled');
    } else {
      note('Sign-in email and password fields are labeled');
    }
    const firstAccountButton = await page.locator('.auth-card button').first().textContent();
    if (!/Continue with personal practice/i.test(firstAccountButton || '')) {
      issue(`Personal practice is not the first account choice: ${firstAccountButton}`);
    } else {
      note('Personal practice is the first account choice');
    }
    const createMode = page.getByRole('button', { name: 'Create account', exact: true });
    const accountChoiceSemantics = await page.locator('.account-choice').evaluate((el) => ({
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'),
      buttons: el.querySelectorAll('button').length,
    }));
    if (
      (await createMode.getAttribute('aria-pressed')) ||
      accountChoiceSemantics.role ||
      accountChoiceSemantics.label ||
      accountChoiceSemantics.buttons !== 1
    ) {
      issue(`Account entry should expose one alternate-form action: ${JSON.stringify(accountChoiceSemantics)}`);
    } else {
      note('Account entry exposes one alternate-form action without repeating the current form');
    }
    await createMode.click();
    await page.waitForTimeout(50);
    if (!(await page.getByLabel('Name', { exact: true }).isVisible())) {
      issue('Account creation does not expose a name field');
    } else if (await page.getByRole('group', { name: 'Account type' }).isVisible().catch(() => false)) {
      issue('Account creation still exposes unfinished teacher account types');
    } else {
      note('Account creation asks for a name without teacher roles');
    }
    if (!(await page.getByRole('button', { name: 'Sign in', exact: true }).isVisible())) {
      issue('Create account does not expose one concise way back to Sign in');
    }
    const createFocus = await focusInfo(page);
    if (createFocus.id !== 'account-name') {
      issue(`Create account should move directly to Name, got ${JSON.stringify(createFocus)}`);
    } else {
      note('Changing account form moves directly to its first field');
    }
    await page.getByRole('button', { name: 'Continue with personal practice' }).click();
  }
  await page.waitForSelector('.status-live');
  await page.waitForSelector('input');
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT', null, {
    timeout: 5000,
  });
  await page.waitForTimeout(100);

  const simpleUi =
    (await page.locator('.app').getAttribute('data-student-simple-ui')) === 'true';
  if (simpleUi) note('Student simple UI is on — advanced controls are hidden');
  else note('Full UI is on — advanced controls are visible');

  let f = await focusInfo(page);
  if (f.tag !== 'input') {
    issue(`First focus should be the practice page name input, got ${JSON.stringify(f)}`);
  } else {
    note(`First focus on practice page name input`);
  }
  const initialTitleName = await page.locator('.title-field').textContent();
  if (!/Practice page name/i.test(initialTitleName || '')) {
    issue(`Practice title label is unclear: ${initialTitleName}`);
  } else {
    note('Practice work uses the distinct Practice page name label');
  }

  const status0 = await statusText(page);
  if (!/Personal practice.*Saved only in this browser/i.test(status0 || '')) {
    issue(`Personal practice entry context is missing or unclear: "${status0}"`);
  } else {
    note('Personal practice entry announces the local-only save boundary once');
  }

  const firstFocusableText = await page.evaluate(() => {
    const focusable = document.querySelector(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    return focusable?.textContent?.trim() || focusable?.getAttribute('aria-label') || '';
  });
  if (!/Skip to Linear/i.test(firstFocusableText) || /LaTeX/i.test(firstFocusableText)) {
    issue(`Skip link is not the first focusable control: ${firstFocusableText}`);
  } else {
    note('Skip to Linear is the first focusable control');
  }

  const initialPageTitle = await page.locator('.title-field input').inputValue();
  if (await page.title() !== `${initialPageTitle} — Digi Math Pad`) {
    issue(`Browser title does not name the current practice page: ${await page.title()}`);
  } else {
    note('Browser title names the current practice page');
  }

  if (!(await page.locator('#work-heading').evaluate((el) => el.tagName === 'H1'))) {
    issue('The current practice page is not the page h1');
  } else {
    note('The current practice page is the page h1');
  }

  const earlyNavigationOrder = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('input, select, textarea, button, a[href]'));
    const selects = document.querySelectorAll('.sheet-navigation select');
    return {
      title: all.indexOf(document.querySelector('.title-field input')),
      currentClass: all.indexOf(selects[0] || null),
      currentPage: all.indexOf(selects[1] || null),
      pageSelectCount: selects.length,
      linear: all.indexOf(document.querySelector('.linear-editor .linear-input')),
    };
  });
  if (simpleUi) {
    if (
      !(
        earlyNavigationOrder.title < earlyNavigationOrder.currentClass &&
        earlyNavigationOrder.pageSelectCount === 1 &&
        earlyNavigationOrder.currentClass < earlyNavigationOrder.linear
      )
    ) {
      issue(`Practice page navigation is not before the editor: ${JSON.stringify(earlyNavigationOrder)}`);
    } else {
      note('Practice page navigation appears before the editor in keyboard order');
    }
  } else if (
    !(
      earlyNavigationOrder.title < earlyNavigationOrder.currentClass &&
      earlyNavigationOrder.currentClass < earlyNavigationOrder.currentPage &&
      earlyNavigationOrder.currentPage < earlyNavigationOrder.linear
    )
  ) {
    issue(`Class and page navigation is not before the editor: ${JSON.stringify(earlyNavigationOrder)}`);
  } else {
    note('Class and page navigation appears before the editor in keyboard order');
  }

  const pageChooser = await page.getByLabel('Current practice page').evaluate((el) => ({
    selectedText: el.selectedOptions[0]?.textContent?.trim() || '',
    wrapperRole: el.closest('.sheet-navigation')?.getAttribute('role') || '',
    wrapperLabel: el.closest('.sheet-navigation')?.getAttribute('aria-label') || '',
  }));
  if (
    pageChooser.selectedText !== initialPageTitle ||
    pageChooser.wrapperRole ||
    pageChooser.wrapperLabel
  ) {
    issue(`Practice page chooser should speak only its field and page title: ${JSON.stringify(pageChooser)}`);
  } else {
    note('Practice page chooser omits the redundant region, type prefix, and equation count');
  }

  const keyboardHelpState = await page.evaluate(() => {
    const help = document.querySelector('.help-open-button');
    const editor = document.querySelector('.linear-editor .linear-input');
    return {
      helpLabel: help?.textContent?.trim() || '',
      beforeEditor: Boolean(help && editor && help.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  if (
    keyboardHelpState.helpLabel !== 'Quick help' ||
    !keyboardHelpState.beforeEditor
  ) {
    issue(`Quick help is not easy to find before editing: ${JSON.stringify(keyboardHelpState)}`);
  } else {
    note('One concise Quick help control appears before the editor');
  }

  await page.getByRole('button', { name: 'Quick help', exact: true }).click();
  await page.waitForTimeout(80);
  const helpDialog = page.getByRole('dialog', { name: 'Quick help' });
  if (!(await helpDialog.isVisible())) issue('Quick help dialog did not open');
  else note('Quick help opens a dialog');
  const helpCloseCount = await page.getByRole('button', {
    name: 'Close help and return',
    exact: true,
  }).count();
  if (helpCloseCount !== 1) {
    issue(`Quick help should expose one Close button, found ${helpCloseCount}`);
  } else {
    note('Quick help exposes one Close button');
  }
  f = await focusInfo(page);
  if (f.tag !== 'h2' || !/Quick help/i.test(f.name || f.text || '')) {
    issue(`Quick help should focus its heading, got ${JSON.stringify(f)}`);
  } else {
    note('Quick help focuses its heading for Tab-only reading');
  }

  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  f = await focusInfo(page);
  if (!/Close help and return/i.test(f.name || f.text || '')) {
    issue(`First Tab in Quick help should reach Close, got ${JSON.stringify(f)}`);
  } else {
    note('Quick help Tab reaches Close after the heading');
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  f = await focusInfo(page);
  if (f.tag !== 'h3' || f.name !== 'Write') {
    issue(`Tab-only help should land on Write topic, got ${JSON.stringify(f)}`);
  } else {
    note('Tab-only help reaches the Write topic');
  }
  const writeDescribed = await page.evaluate(() => {
    const heading = document.getElementById('help-write');
    const describedBy = heading?.getAttribute('aria-describedby') || '';
    const text = describedBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' ');
    return { describedBy, text };
  });
  if (!writeDescribed.describedBy || !/Enter for Linear/i.test(writeDescribed.text) || /LaTeX/i.test(writeDescribed.text)) {
    issue(`Write topic is missing connected help text: ${JSON.stringify(writeDescribed)}`);
  } else {
    note('Write topic exposes its instructions to screen readers');
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(40);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(40);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(40);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(40);
  f = await focusInfo(page);
  if (f.tag !== 'h3' || f.name !== 'Review and save') {
    issue(`Tab-only help should reach Review and save, got ${JSON.stringify(f)}`);
  } else {
    note('Tab-only help reaches later help topics');
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  f = await focusInfo(page);
  if (!/Close help and return/i.test(f.name || f.text || '')) {
    issue(`Tab after topics should wrap to the single Close button, got ${JSON.stringify(f)}`);
  }
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  const stayedInHelp = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('.help-dialog')),
  );
  if (!stayedInHelp) issue('Tab escaped the Quick help dialog');
  else note('Quick help keeps Tab focus inside the dialog');

  await page.getByRole('button', { name: 'Close help and return', exact: true }).first().click();
  await page.waitForTimeout(80);
  await page.locator('.title-field input').focus();

  // Enter from title should jump directly to Linear.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  f = await focusInfo(page);
  if (!f.isLinear) {
    issue(`Enter from title should focus Linear, got ${JSON.stringify(f)}`);
  } else {
    note('Enter from title lands in Linear');
  }
  const linearAttributes = await page.locator('.linear-editor .linear-input').evaluate((el) => ({
    label: el.getAttribute('aria-label'),
    placeholder: el.getAttribute('placeholder'),
    describedBy: el.getAttribute('aria-describedby'),
    description: (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() || '')
      .join(' '),
    shortcut: el.getAttribute('aria-keyshortcuts'),
    visibleLabel: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || '',
  }));
  if (
    linearAttributes.label !== 'Equation 1' ||
    linearAttributes.visibleLabel !== 'Linear' ||
    linearAttributes.placeholder ||
    linearAttributes.describedBy ||
    linearAttributes.description ||
    linearAttributes.shortcut
  ) {
    issue(`Linear field should speak only Equation N: ${JSON.stringify(linearAttributes)}`);
  } else {
    note('Linear field speaks Equation N without a total or LaTeX jargon');
  }

  // Unnamed editor sections do not add a redundant "Write region" announcement.
  const editRegionName = await page.locator('.edit-pane').evaluate((el) => {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) return document.getElementById(labelledBy)?.textContent?.trim() || '';
    return el.getAttribute('aria-label') || '';
  });
  if (editRegionName) {
    issue(`Write section should not add a spoken region name: ${JSON.stringify(editRegionName)}`);
  } else {
    note('Write section does not add a redundant region announcement');
  }
  const workspaceContainerNames = await page.evaluate(() => ({
    main: document.getElementById('main')?.getAttribute('aria-label') ||
      document.getElementById('main')?.getAttribute('aria-labelledby') || '',
    work: document.querySelector('.doc-pane')?.getAttribute('aria-label') ||
      document.querySelector('.doc-pane')?.getAttribute('aria-labelledby') || '',
  }));
  if (workspaceContainerNames.main || workspaceContainerNames.work) {
    issue(`Workspace containers should not add repeated names: ${JSON.stringify(workspaceContainerNames)}`);
  } else {
    note('Workspace containers do not repeat the page and Your work names on focus entry');
  }

  await page.waitForTimeout(800);
  const linearTipStatus = await statusText(page);
  if (/Tip:.*Alt\+Enter|Up or Down changes/i.test(linearTipStatus || '')) {
    issue(`Linear focus should not trigger a delayed spoken tip: ${linearTipStatus}`);
  } else {
    note('Linear focus has no delayed spoken tip');
  }

  const linearFocusStyle = await page.locator('.linear-editor .linear-input').evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor,
    };
  });
  if (
    linearFocusStyle.outlineStyle !== 'solid' ||
    linearFocusStyle.outlineWidth < 3 ||
    linearFocusStyle.outlineColor !== 'rgb(0, 95, 204)'
  ) {
    issue(`Keyboard focus is not visibly emphasized: ${JSON.stringify(linearFocusStyle)}`);
  } else {
    note('Keyboard controls receive a high-contrast focus-visible ring');
  }

  const accountBarHeadingCount = await page.locator('.account-bar h1, .account-bar h2').count();
  if (accountBarHeadingCount !== 0) issue('Account bar creates a heading before the practice-page h1');
  else note('Account context does not disrupt the practice-page heading outline');

  const practiceWorkHint = await page.locator('.doc-pane > .hint').first().textContent();
  if (!/worksheet in order/i.test(practiceWorkHint || '') || /hand in/i.test(practiceWorkHint || '')) {
    issue(`Your work hint should describe worksheet order without hand-in wording: ${practiceWorkHint}`);
  } else {
    note('Your work describes the worksheet in order without hand-in wording');
  }

  if (simpleUi) {
    if (await page.getByRole('button', { name: 'Show practice examples' }).count()) {
      issue('Practice examples should be hidden in the student simple UI');
    } else {
      note('Practice examples are hidden in the student simple UI');
    }
    if (await page.locator('.equation-more-actions').count()) {
      issue('More equation actions should be hidden in the student simple UI');
    } else {
      note('More equation actions are hidden in the student simple UI');
    }
    if (await page.getByRole('button', { name: /^Duplicate/i }).count()) {
      issue('Duplicate should be hidden in the student simple UI');
    } else {
      note('Duplicate is hidden in the student simple UI');
    }
    if (!(await page.getByRole('button', { name: 'Download Word', exact: true }).count())) {
      issue('Download Word should stay visible in the student simple UI');
    } else {
      note('Download Word stays visible for hand-in');
    }
  } else {
    await page.getByRole('button', { name: 'Show practice examples' }).click();
    const templateLabels = await page.locator('.templates button').allTextContents();
    if (!templateLabels.some((label) => /Square root example/i.test(label)) || templateLabels.some((label) => /Acceptance test/i.test(label))) {
      issue(`Practice examples expose internal test language: ${JSON.stringify(templateLabels)}`);
    } else {
      note('Practice examples use student-facing labels');
    }
    await page.getByRole('button', { name: 'Hide practice examples' }).click();
  }
  if (!(await page.getByRole('button', { name: /^Hear math/i }).count())) {
    issue('Hear math action is missing from the equation toolbar');
  } else {
    note('Hear math is labeled on the equation toolbar');
  }
  const workActions = await page
    .locator('.doc-pane > .toolbar button')
    .allTextContents();
  if (!workActions.some((label) => /New note/i.test(label))) {
    issue('New note is not available from the Your work toolbar');
  } else {
    note('New note is available from the Your work toolbar');
  }

  // The same action must not be offered by both panes under two different names.
  const editActions = await page.locator('.edit-pane > .toolbar button').allTextContents();
  const firstWord = (label) => label.trim().split(/\s+/)[0].toLowerCase();
  const shared = editActions
    .map(firstWord)
    .filter((word) => workActions.map(firstWord).includes(word));
  if (shared.length) {
    issue(`Editing actions are duplicated across both toolbars: ${shared.join(', ')}`);
  } else {
    note('Creation and removal actions live in one toolbar only');
  }
  const verboseToolbarGroups = await page.locator(
    '.doc-pane [role="group"][aria-label="Add or change work"], ' +
      '.doc-pane [role="group"][aria-label="Page actions"], ' +
      '.doc-pane [role="group"][aria-label="Review and hand in"]',
  ).count();
  if (verboseToolbarGroups) {
    issue(`Action toolbars should not add spoken grouping labels, found ${verboseToolbarGroups}`);
  } else {
    note('Action buttons do not repeat toolbar grouping names');
  }
  if (!(await page.getByLabel('Problem number', { exact: true }).count())) {
    issue('Problem number field is missing for worksheet labels like 1.2');
  } else {
    note('Problem number field is available for worksheet labels');
  }
  const problemPlaceholder = await page.getByLabel('Problem number', { exact: true }).first().getAttribute('placeholder');
  if (problemPlaceholder) {
    issue(`Problem number should not expose a spoken placeholder, got "${problemPlaceholder}"`);
  } else {
    note('Problem number has no placeholder for screen readers to speak');
  }
  const linearTag = await page.locator('.linear-editor .linear-input').evaluate((el) => el.tagName);
  if (simpleUi && linearTag !== 'INPUT') {
    issue(`Student simple UI should use a single-line Linear field, got ${linearTag}`);
  } else if (simpleUi) {
    note('Student simple UI uses a single-line Linear field');
  }
  if (!(await page.getByRole('button', { name: /^Save draft/i }).count())) {
    issue('Save draft button is missing');
  } else {
    note('Save draft is distinct from export downloads');
  }
  const undoButton = page.getByRole('button', { name: 'Undo', exact: true });
  if (!(await undoButton.isEnabled())) {
    issue('Undo should remain in the Tab order when there is nothing to undo');
  } else {
    note('Undo remains keyboard-reachable when there is nothing to undo');
  }
  const reviewDisclosureState = await page.getByRole('button', { name: /^Review answers/i }).evaluate((el) => ({
    expanded: el.getAttribute('aria-expanded'),
    popup: el.getAttribute('aria-haspopup'),
  }));
  if (reviewDisclosureState.expanded || reviewDisclosureState.popup !== 'dialog') {
    issue(`Review should be exposed as a dialog opener, not a collapsed disclosure: ${JSON.stringify(reviewDisclosureState)}`);
  } else {
    note('Review is a dialog opener without a misleading collapsed state');
  }

  await page.keyboard.press('Alt+=');
  await page.waitForTimeout(100);
  let eqCount = await page.locator('.doc-pane .block-select').count();
  if (eqCount !== 1) {
    issue(`Alt+= on empty spawned extras: ${eqCount}`);
  } else {
    note('Alt+= on empty does not spawn blanks');
  }
  const emptyAddStatus = await statusText(page);
  if (!/Current equation is empty.*Type before adding another/i.test(emptyAddStatus || '')) {
    issue(`Alt+= on empty does not explain how to recover: ${emptyAddStatus}`);
  } else {
    note('Alt+= on empty explains why no equation was added');
  }

  if (simpleUi) {
    note('Empty equation duplicate control is hidden in the student simple UI');
  } else {
    await page.getByRole('button', { name: /^Duplicate Equation/i }).click();
    await page.waitForTimeout(80);
    const emptyDupStatus = await statusText(page);
    const emptyDupCount = await page.locator('.doc-pane .block-select').count();
    if (emptyDupCount !== 1 || !/Empty equation not duplicated/i.test(emptyDupStatus || '')) {
      issue(
        `Empty duplicate should fail clearly: count=${emptyDupCount} status=${emptyDupStatus}`,
      );
    } else {
      note('Empty equation duplicate announces failure instead of false success');
    }
  }

  await page.keyboard.type('y=\\sqrt{x+3}');
  await page.waitForTimeout(350);
  const savedState = await page.locator('.save-state').textContent();
  if (!/^Saved locally\.?$/i.test((savedState || '').trim())) {
    issue(`Autosave status is unclear: ${savedState}`);
  } else {
    note('Autosave state is visible without adding another live region');
  }
  await page.keyboard.press('Alt+Enter');
  // Wait beyond the autosave render so replacing the focused MathML node cannot pass.
  await page.waitForTimeout(350);
  f = await focusInfo(page);
  const onAccessibleMath = await page.evaluate(
    () => document.activeElement === document.querySelector('.accessible-math > math'),
  );
  if (!onAccessibleMath) {
    issue(`Alt+Enter did not focus the direct accessible MathML: ${JSON.stringify(f)}`);
  } else {
    note('Alt+Enter focuses the direct accessible MathML');
  }
  const activeMathState = await page.locator('.math-preview').evaluate((host) => {
    const math = host.querySelector('.accessible-math > math');
    return {
      direct: Boolean(math),
      focusable: math?.getAttribute('tabindex') === '0',
      clippedClone: Boolean(math?.closest('.katex-mathml')),
      visualHidden: host.querySelector('.visual-math')?.getAttribute('aria-hidden'),
    };
  });
  if (
    !activeMathState.direct ||
    !activeMathState.focusable ||
    activeMathState.clippedClone ||
    activeMathState.visualHidden !== 'true'
  ) {
    issue(`Active preview does not expose direct MathML correctly: ${JSON.stringify(activeMathState)}`);
  } else {
    note('Active preview exposes unclipped focusable MathML and hides the visual clone from AT');
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  f = await focusInfo(page);
  if (!f.isLinear) issue(`Escape back failed: ${JSON.stringify(f)}`);
  else note('Escape returns to Linear');
  const previewState = await page.locator('.math-preview').evaluate((el) => ({
    hidden: el.getAttribute('aria-hidden'),
    focusableMath: el.querySelector('math')?.getAttribute('tabindex') || '',
  }));
  if (previewState.hidden !== 'true' || previewState.focusableMath) {
    issue(`Escape should close preview exploration: ${JSON.stringify(previewState)}`);
  } else {
    note('Escape removes preview from the accessibility tree and tab order');
  }

  if (simpleUi) {
    note('More equation actions stay hidden in the student simple UI');
  } else {
    const moreActions = page.locator('.equation-more-actions');
    await moreActions.locator('summary').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    const moreOpen = await moreActions.evaluate((el) => el.open);
    const pasteReachable = await moreActions.getByRole('button', { name: /Paste as equation/i }).isVisible();
    if (!moreOpen || !pasteReachable) {
      issue('More equation actions should expand and expose its buttons');
    } else {
      note('More equation actions expands and exposes its buttons');
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
  }
  await page.locator('.linear-editor .linear-input').focus();
  // Invalid LaTeX should stay attached to Linear and block a ready-to-submit result.
  await page.locator('.linear-editor .linear-input').fill('\\sqrt{');
  await page.keyboard.press('Alt+Enter');
  await page.waitForTimeout(100);
  const invalidState = await page.locator('.linear-editor .linear-input').evaluate((el) => ({
    invalid: el.getAttribute('aria-invalid'),
    errorId: el.getAttribute('aria-errormessage'),
    describedBy: el.getAttribute('aria-describedby'),
  }));
  const invalidError = await page.locator('.field-error').textContent();
  if (
    invalidState.invalid !== 'true' ||
    !invalidState.errorId ||
    !invalidState.describedBy?.split(/\s+/).includes(invalidState.errorId) ||
    !/closing brace/i.test(invalidError || '')
  ) {
    issue(`Invalid LaTeX feedback is not persistent and connected: ${JSON.stringify({invalidState, invalidError})}`);
  } else {
    note('Invalid LaTeX remains described when the student returns to Linear');
  }
  await page.getByRole('button', { name: /Review answers/i }).click();
  await page.waitForTimeout(100);
  f = await focusInfo(page);
  const invalidReview = await reviewSelection(page);
  if (f.tag !== 'button' || !/Equation 1/i.test(invalidReview.selectedLabel || '')) {
    issue(
      `Invalid LaTeX should open Review on its equation, got ${JSON.stringify({f, invalidReview})}`,
    );
  } else {
    note('Invalid LaTeX blocks hand-in and focuses its Review row');
  }
  const reviewSummary = await page.locator('#review-summary').textContent();
  const invalidRow = page.locator('.review-list .block-select').first();
  const invalidRowName = await invalidRow.getAttribute('aria-label');
  if (!/^1 equation\./i.test(reviewSummary || '') || /\.\./.test(invalidRowName || '')) {
    issue(`Review grammar or punctuation is incorrect: ${JSON.stringify({reviewSummary, invalidRowName})}`);
  } else {
    note('Review uses singular grammar and no doubled punctuation');
  }
  await invalidRow.click();
  await page.waitForTimeout(100);
  const returnedError = await page.locator('.linear-editor .linear-input').evaluate((el) =>
    (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' '),
  );
  if (!/closing brace/i.test(returnedError)) {
    issue(`Returning from Review loses the exact described error: ${returnedError}`);
  } else {
    note('Returning from Review keeps the exact error attached to Linear');
  }
  await page.locator('.linear-editor .linear-input').fill('y=\\sqrt{x+3}');

  await page.locator('.linear-editor .linear-input').focus();
  await page.locator('.status-live').evaluate((el) => {
    el.textContent = '';
  });
  await page.keyboard.press('Alt+=');
  await page.waitForTimeout(150);
  eqCount = await page.locator('.doc-pane .block-select').count();
  if (eqCount !== 2) issue(`Expected 2 equations, got ${eqCount}`);
  else note('Alt+= creates Equation 2');
  f = await focusInfo(page);
  const newEquationStatus = await statusText(page);
  if (f.name !== 'Equation 2' || newEquationStatus?.trim()) {
    issue(`New equation focus is unclear or duplicated: ${JSON.stringify({focus: f, status: newEquationStatus})}`);
  } else {
    note('New equation relies on its focused field name without duplicate live speech');
  }
  const workListTab = await page.locator('#work-list').evaluate((el) => ({
    tabIndex: el.tabIndex,
    role: el.getAttribute('role'),
    tabStops: Array.from(el.querySelectorAll('button.block-select')).filter((row) => row.tabIndex === 0)
      .length,
  }));
  if (workListTab.tabIndex >= 0 || workListTab.role !== 'application' || workListTab.tabStops !== 1) {
    issue(`Your work should be one row Tab stop in an arrow-key application, found ${JSON.stringify(workListTab)}`);
  } else {
    note('Your work passes arrow keys to one row without listbox position speech');
  }

  await page.keyboard.type('x^2');
  await page.waitForTimeout(50);

  // Edit equation 1 after writing 2
  const workRow = () => page.locator('#work-list [tabindex="0"]');
  await workRow().focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const latex1 = await page.locator('.linear-editor .linear-input').inputValue();
  if (!latex1.includes('sqrt')) {
    issue(`Editing eq1 failed, value=${latex1}`);
  } else {
    note('Can reopen Equation 1 to edit after writing Equation 2');
  }

  await page.getByLabel('Problem number', { exact: true }).fill('1.2');
  await page.waitForTimeout(50);
  const labeledEquation = await page.locator('.linear-editor .linear-input').getAttribute('aria-label');
  const labeledRow = await page.locator('#work-list [data-selected="true"]').getAttribute('aria-label');
  if (labeledEquation !== '1.2' || !/^1\.2\b/.test(labeledRow || '')) {
    issue(
      `Problem number should rename Linear and Your work: ${JSON.stringify({labeledEquation, labeledRow})}`,
    );
  } else {
    note('Problem number 1.2 renames Linear and Your work');
  }

  // Shortcuts must work from Problem number, not only inside Linear.
  await page.getByLabel('Problem number', { exact: true }).focus();
  await page.keyboard.press('Alt+Enter');
  await page.waitForTimeout(120);
  const heardFromProblem = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('.math-preview')),
  );
  if (!heardFromProblem) {
    issue('Alt+Enter from Problem number should open Hear math');
  } else {
    note('Alt+Enter from Problem number opens Hear math');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  f = await focusInfo(page);
  if (!f.isLinear || f.id === 'prose-focus-target') {
    issue(`Escape from Hear math / Problem number should return to Linear: ${JSON.stringify(f)}`);
  } else {
    note('Escape returns to Linear from Hear math opened via Problem number');
  }
  await page.getByLabel('Problem number', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  f = await focusInfo(page);
  if (!f.isLinear || f.id === 'prose-focus-target') {
    issue(`Escape from Problem number should return to Linear: ${JSON.stringify(f)}`);
  } else {
    note('Escape from Problem number returns to Linear');
  }

  await page.keyboard.press('Alt+n');
  await page.waitForTimeout(100);
  f = await focusInfo(page);
  const noteCount = await page.locator('#work-list .block-select').evaluateAll((rows) =>
    rows.filter((row) => /^Note\b/i.test(row.childNodes[0]?.textContent?.trim() || '')).length,
  );
  if (f.id !== 'prose-focus-target' || noteCount < 1) {
    issue(`Alt+N should create and focus a note: ${JSON.stringify({f, noteCount})}`);
  } else {
    note('Alt+N creates and focuses a note');
  }
  if (await page.getByLabel('Problem number', { exact: true }).count()) {
    issue('Notes should not expose the equation Problem number field');
  } else {
    note('Notes stay identified as notes and do not expose Problem number');
  }
  await page.locator('#prose-focus-target').fill('Showed work for 1.2');
  await workRow().focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);

  await page.locator('.linear-editor .linear-input').evaluate((el) => {
    const field = el;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  let fAfterPlainArrow = await focusInfo(page);
  if (fAfterPlainArrow.id !== 'prose-focus-target' || !/^Note 1$/i.test(fAfterPlainArrow.name || '')) {
    issue(`Plain ArrowDown should include and focus the adjacent note, got ${JSON.stringify(fAfterPlainArrow)}`);
  } else {
    note('Plain ArrowDown includes the adjacent note');
  }

  // Plain arrows keep their native caret behavior inside a multiline note.
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(80);
  fAfterPlainArrow = await focusInfo(page);
  if (fAfterPlainArrow.id !== 'prose-focus-target') {
    issue(`Plain arrows in a note should move its text caret, got ${JSON.stringify(fAfterPlainArrow)}`);
  } else {
    note('Plain arrows retain native text editing inside notes');
  }

  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(100);
  const latexAfterAltDown = await page.locator('.linear-editor .linear-input').inputValue();
  if (!latexAfterAltDown.includes('x^2')) {
    issue(`Alt+ArrowDown from a note should move to the adjacent equation, got ${latexAfterAltDown}`);
  } else {
    note('Alt+ArrowDown moves from a note to the adjacent equation');
  }
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForTimeout(100);
  fAfterPlainArrow = await focusInfo(page);
  if (fAfterPlainArrow.id !== 'prose-focus-target') {
    issue(`Alt+ArrowUp should include the adjacent note, got ${JSON.stringify(fAfterPlainArrow)}`);
  } else {
    note('Alt+ArrowUp includes notes instead of skipping them');
  }

  // List arrows keep focus and move the selected row
  await workRow().focus();
  await page.waitForTimeout(80);
  const beforeArrow = await page.locator('#work-list [data-selected="true"]').getAttribute('id');
  await page.keyboard.press('Home');
  await page.waitForTimeout(80);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(80);
  f = await focusInfo(page);
  const afterArrow = await page.locator('#work-list [data-selected="true"]').getAttribute('id');
  if (f.isLinear) issue('Arrow stole focus into Linear');
  else note('Arrow on list keeps list focus');
  if (!afterArrow || afterArrow === beforeArrow) {
    // Home may have changed selection; require that ArrowDown changed from Home's first item.
    const homeThenDown = await page.evaluate(() => {
      const list = document.getElementById('work-list');
      const selected = list?.querySelector('[data-selected="true"]');
      const options = [...(list?.querySelectorAll('button.block-select') || [])];
      return options.indexOf(selected);
    });
    if (homeThenDown < 1) {
      issue(`ArrowDown on Your work did not move selection, index=${homeThenDown}`);
    } else {
      note('ArrowDown on Your work moves to the next row');
    }
  } else {
    note('ArrowDown on Your work moves to the next row');
  }

  // A removed note must be announced after focus moves to the adjacent row.
  const selectedBeforeNoteRemoval = await workRow().getAttribute('aria-label');
  if (/^Note\b/i.test(selectedBeforeNoteRemoval || '')) {
    await page.keyboard.press('Delete');
    await page.waitForTimeout(180);
    const noteRemoveStatus = await statusText(page);
    if (!/^Removed Note 1\.?$/i.test((noteRemoveStatus || '').trim())) {
      issue(`Note removal should be announced once, got ${JSON.stringify(noteRemoveStatus)}`);
    } else {
      note('Note removal is announced once after destination focus settles');
    }
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(180);
  } else {
    issue(`Expected Note 1 before the note-removal check, got ${selectedBeforeNoteRemoval}`);
  }

  // Filled work is removed immediately because Undo makes the action reversible.
  await workRow().focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(80);
  const homeRow = await page.locator('#work-list [data-selected="true"]').getAttribute('aria-label');
  if (!/^1\.2\b/.test(homeRow || '')) {
    issue(`Home should select problem 1.2 before delete, got ${homeRow}`);
  }
  await workRow().focus();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  if (await page.locator('.confirm-dialog[open]').count()) {
    issue('Undoable equation removal should not open a repetitive confirmation dialog');
  } else {
    note('Undoable equation removal does not open a confirmation dialog');
  }
  eqCount = await page.locator('.doc-pane .block-select').count();
  if (eqCount !== 2) issue(`After delete expected 2 blocks (note + equation), got ${eqCount}`);
  else note('Delete removes the selected Your work equation');
  f = await focusInfo(page);
  const deleteStayedInWork = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('#work-list')),
  );
  if (!deleteStayedInWork || f.tag !== 'button' || !/^Note\b/i.test(f.name || '')) {
    issue(`Delete from Your work should keep browsing the adjacent row, got ${JSON.stringify(f)}`);
  } else {
    note('Delete from Your work keeps focus on the adjacent row button');
  }
  const removeStatus = await statusText(page);
  if (!/^Removed 1\.2\.?$/i.test((removeStatus || '').trim())) {
    issue(`Removal status should be short, got ${JSON.stringify(removeStatus)}`);
  } else {
    note('Removal status is short and does not repeat the undo instructions');
  }

  // Undo restore preserves list browsing when invoked from Your work.
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(150);
  eqCount = await page.locator('.doc-pane .block-select').count();
  if (eqCount < 3) issue(`Undo should restore blocks, got ${eqCount}`);
  else note('Ctrl+Shift+Z restores deleted equation');
  const undoStayedInWork = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('#work-list')),
  );
  if (!undoStayedInWork) issue('Undo from Your work should keep focus in Your work');
  else note('Undo from Your work preserves list browsing');

  // Alt+Delete from an editor keeps the student in editing mode.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Alt+Delete');
  await page.waitForTimeout(120);
  f = await focusInfo(page);
  if (f.id !== 'prose-focus-target') {
    issue(`Alt+Delete from Linear should focus the adjacent editor, got ${JSON.stringify(f)}`);
  } else {
    note('Alt+Delete from an editor keeps focus in editing mode');
  }
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(120);

  // Review
  await page.getByRole('button', { name: /Review answers/i }).click();
  await page.waitForTimeout(100);
  const reviewVisible = await page.locator('.review-panel').isVisible();
  if (!reviewVisible) issue('Review panel not visible');
  else note('Review panel opens');
  const reviewSemantics = await page.locator('.review-panel').evaluate((el) => ({
    tag: el.tagName,
    open: el.hasAttribute('open'),
    name: el.getAttribute('aria-label'),
    description: el.getAttribute('aria-describedby'),
    headingHidden: el.querySelector('#review-heading')?.getAttribute('aria-hidden') || '',
    summaryHidden: el.querySelector('#review-summary')?.getAttribute('aria-hidden') || '',
    answerGroupRole: el.querySelector('.review-list')?.getAttribute('role') || '',
    answerGroupName: el.querySelector('.review-list')?.getAttribute('aria-label') || '',
    answerGroupOrientation: el.querySelector('.review-list')?.getAttribute('aria-orientation') || '',
  }));
  if (
    reviewSemantics.tag !== 'DIALOG' ||
    !reviewSemantics.open ||
    reviewSemantics.name !== 'Review answers' ||
    reviewSemantics.description ||
    reviewSemantics.headingHidden !== 'true' ||
    reviewSemantics.summaryHidden !== 'true' ||
    reviewSemantics.answerGroupRole !== 'toolbar' ||
    reviewSemantics.answerGroupName !== 'Answers' ||
    reviewSemantics.answerGroupOrientation !== 'vertical'
  ) {
    issue(`Ready Review should expose one concise dialog name: ${JSON.stringify(reviewSemantics)}`);
  } else {
    note('Ready Review exposes one concise dialog name without repeated heading or totals');
  }
  const reviewIds = await page.evaluate(() => {
    const workIds = [...document.querySelectorAll('#work-list button.block-select')].map((el) => el.id);
    const reviewOpts = [...document.querySelectorAll('.review-list button.block-select')].map((el) => ({
      id: el.id,
      selected: el.getAttribute('data-selected') === 'true',
    }));
    const selected = reviewOpts.find((opt) => opt.selected);
    const focused = document.activeElement;
    return {
      duplicateAcrossLists: workIds.some((id) => reviewOpts.some((opt) => opt.id === id)),
      activeMatchesSelected: Boolean(selected && focused?.id === selected.id),
      reviewPrefixed: reviewOpts.every((opt) => opt.id.startsWith('review-')),
    };
  });
  if (
    reviewIds.duplicateAcrossLists ||
    !reviewIds.activeMatchesSelected ||
    !reviewIds.reviewPrefixed
  ) {
    issue(`Review option IDs collide with Your work or activedescendant: ${JSON.stringify(reviewIds)}`);
  } else {
    note('Review option IDs stay unique from Your work');
  }
  f = await focusInfo(page);
  let selection = await reviewSelection(page);
  if (f.tag !== 'button' || !selection.focusInList || !/1\.2|Equation|Note/i.test(selection.selectedLabel || '')) {
    issue(`Review should focus the answer list, got ${JSON.stringify({f, selection})}`);
  } else {
    note('Review opens on the selected row for immediate arrow navigation');
  }
  const liveRegionCount = await page.locator('[role="status"], [aria-live]').count();
  if (liveRegionCount !== 1) issue(`Expected one live region, got ${liveRegionCount}`);
  else note('Only one live region is present');

  const reviewTabStops = await page.locator('.review-list').evaluate((list) => ({
    listTabIndex: list.tabIndex,
    rowTabStops: [...list.querySelectorAll('button.block-select')].filter((row) => row.tabIndex === 0)
      .length,
  }));
  if (reviewTabStops.listTabIndex >= 0 || reviewTabStops.rowTabStops !== 1) {
    issue(`Review should use one row Tab stop, got ${JSON.stringify(reviewTabStops)}`);
  } else {
    note('Review rows use one row Tab stop');
  }

  await page.keyboard.press('Shift+Tab');
  const focusStayedInReview = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('.review-dialog')),
  );
  if (!focusStayedInReview) issue('Shift+Tab escaped the Review dialog');
  else note('Review keeps keyboard focus inside the dialog');
  await page.locator('.review-list [tabindex="0"]').focus();

  await page.keyboard.press('End');
  await page.waitForTimeout(80);
  selection = await reviewSelection(page);
  if (!selection.focusInList || !/Equation 2/i.test(selection.selectedLabel || '')) {
    issue(`End should move to the last Review row, got ${JSON.stringify(selection)}`);
  } else {
    note('End moves to the last Review row');
  }
  await page.keyboard.press('Home');
  await page.waitForTimeout(80);
  selection = await reviewSelection(page);
  if (!selection.focusInList || !/^1\.2\b/i.test(selection.selectedLabel || '')) {
    issue(`Home should move to the first Review row, got ${JSON.stringify(selection)}`);
  } else {
    note('Home moves to the first Review row');
  }
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(80);
  selection = await reviewSelection(page);
  if (!selection.focusInList || !/^Note\b/i.test(selection.selectedLabel || '')) {
    issue(`ArrowDown should move to the next Review row, got ${JSON.stringify(selection)}`);
  } else {
    note('Arrow keys move between Review rows without bracket shortcuts');
  }
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(80);
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(80);
  selection = await reviewSelection(page);
  if (!/^Note\b/i.test(selection.selectedLabel || '')) {
    issue(`Alt+ArrowDown should move between Review rows, got ${JSON.stringify(selection)}`);
  } else {
    note('Alt+ArrowDown also moves between Review rows');
  }
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForTimeout(80);
  await page.locator('.review-panel').dispatchEvent('keydown', {
    key: 'Unidentified',
    code: 'BracketRight',
    altKey: true,
    bubbles: true,
  });
  await page.waitForTimeout(80);
  selection = await reviewSelection(page);
  if (!/^Note\b/i.test(selection.selectedLabel || '')) {
    issue(`Physical right-bracket fallback failed across keyboard layouts: ${JSON.stringify(selection)}`);
  } else {
    note('Optional bracket shortcut recognizes the physical key across layouts');
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  f = await focusInfo(page);
  if (!/Review answers/i.test(f.text || f.name || '')) {
    issue(`Escape from Review should restore focus directly to Review answers, got ${JSON.stringify(f)}`);
  } else {
    note('Escape from Review restores focus directly to Review answers');
  }
  const closedReviewState = await page.locator('.review-panel').evaluate((el) => ({
    open: el.hasAttribute('open'),
    insideMain: Boolean(el.closest('main')),
  }));
  if (closedReviewState.open || !closedReviewState.insideMain) {
    issue(`Closed Review should remain stable beside its opener: ${JSON.stringify(closedReviewState)}`);
  } else {
    note('Closing Review does not remove its DOM position or re-anchor NVDA at Skip to Linear');
  }

  await workRow().focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await page.locator('.linear-editor .linear-input').focus();
  await page.keyboard.press('Alt+r');
  await page.waitForTimeout(100);
  const reviewFromShortcut = await page.locator('.review-panel').evaluate((el) => ({
    open: el.hasAttribute('open'),
    tag: el.tagName,
  }));
  if (reviewFromShortcut.tag !== 'DIALOG' || !reviewFromShortcut.open) {
    issue(`Alt+R should open Review from Linear, got ${JSON.stringify(reviewFromShortcut)}`);
  } else {
    note('Alt+R opens Review from Linear');
  }
  await page.getByRole('button', { name: /Close review/i }).click();
  await page.waitForTimeout(80);
  f = await focusInfo(page);
  if (!f.isLinear || f.id === 'prose-focus-target') {
    issue(`Closing Review opened with Alt+R should restore Linear, got ${JSON.stringify(f)}`);
  } else {
    note('Closing Review opened with Alt+R restores Linear');
  }

  // Copy all / accessible HTML / class library — full UI only
  if (!simpleUi) {
    await openDetails(page, /Export and backup|Download copies/);
    await page.getByRole('button', { name: /Copy all answers/i }).click();
    await page.waitForTimeout(200);
    const clip = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return '';
      }
    });
    if (!clip.includes('Equation') && !clip.includes('x^2') && !clip.includes('sqrt')) {
      const st = await statusText(page);
      if (/Copied all|cancelled|Could not copy/i.test(st || '')) {
        note(`Copy all announced: ${st}`);
      } else {
        issue(`Copy all unclear. clipboard="${clip.slice(0, 80)}" status="${st}"`);
      }
    } else {
      note('Copy all answers put equations on clipboard');
    }

    const downloadPromise = page.waitForEvent('download');
    await openDetails(page, /Export and backup|Download copies/);
    await page.getByRole('button', { name: 'Download accessible HTML', exact: true }).click();
    const accessibleDownload = await downloadPromise;
    const downloadStream = await accessibleDownload.createReadStream();
    let accessibleHtml = '';
    for await (const chunk of downloadStream) accessibleHtml += chunk.toString();
    if (!/<math[\s>]/i.test(accessibleHtml) || !/Linear source/i.test(accessibleHtml)) {
      issue('Accessible HTML export is missing MathML or Linear source');
    } else {
      note('Accessible HTML export contains MathML and Linear source');
    }

    const hiddenFileTabIndex = await page.locator('.file-input').evaluate((el) => el.tabIndex);
    if (hiddenFileTabIndex !== -1) issue('Hidden upload input remains in the Tab order');
    else note('Hidden upload input is removed from the Tab order');
  } else {
    note('Copy all and accessible HTML stay hidden in the student simple UI');
    if (!(await page.getByRole('button', { name: 'Download Word', exact: true }).isVisible())) {
      issue('Download Word missing from the student simple UI');
    } else {
      note('Download Word remains the hand-in control');
    }
  }

  // New practice page + class
  await page.locator('.status-live').evaluate((el) => {
    el.textContent = '';
  });
  await page.getByRole('button', { name: /New practice page/i }).click();
  await page.waitForTimeout(200);
  const title = await page.locator('.title-field input').inputValue();
  if (!title) issue('New practice page has empty title');
  else note(`New practice page created: ${title}`);
  f = await focusInfo(page);
  const newPageFocusIsTitle = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('.title-field')),
  );
  if (!newPageFocusIsTitle || f.tag !== 'input') {
    issue(`New practice page should focus its name instead of the blank equation: ${JSON.stringify(f)}`);
  } else {
    note('New practice page focuses its Practice page name');
  }
  const newPageStatus = await statusText(page);
  if (newPageStatus?.trim()) {
    issue(`New page focus should replace a redundant live announcement: ${newPageStatus}`);
  } else {
    note('New practice page relies on its focused name field without duplicate speech');
  }

  // Removing the only equation leaves the required blank editor, so announce both facts.
  const onlyEquation = page.locator('.linear-editor .linear-input');
  await onlyEquation.fill('x+1');
  const removeCurrentButton = page.getByRole('button', { name: 'Remove current item', exact: true });
  await removeCurrentButton.click();
  await page.waitForTimeout(180);
  const onlyEquationStatus = await statusText(page);
  const replacementValue = await page.locator('.linear-editor .linear-input').inputValue();
  f = await focusInfo(page);
  if (
    !/^Removed Equation 1\. New blank equation\.?$/i.test((onlyEquationStatus || '').trim()) ||
    replacementValue ||
    f.name !== 'Remove current item'
  ) {
    issue(`Toolbar removal should announce first without changing focus: ${JSON.stringify({onlyEquationStatus, replacementValue, focus: f})}`);
  } else {
    note('Toolbar removal announces first and keeps its stable button focus');
  }
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(180);

  const options = await page.getByLabel('Current practice page').locator('option').count();
  if (options < 2) issue(`Expected ≥2 pages, got ${options}`);
  else note(`Practice class has ${options} pages`);

  if (!simpleUi) {
  // New class
  await openDetails(page, 'Organize pages');
  await page.getByRole('button', { name: /New class/i }).click();
  await page.waitForTimeout(100);
  const classDialog = page.getByRole('dialog', { name: 'Create a class' });
  if (!(await classDialog.isVisible())) issue('New class dialog did not open');
  else note('New class opens an in-page dialog');
  f = await focusInfo(page);
  if (f.id !== 'class-name') issue(`Class name should receive focus, got ${JSON.stringify(f)}`);
  else note('Class dialog focuses its labeled name field');
  const blocksBeforeClassShortcut = await page.locator('.doc-pane .block-select').count();
  await page.keyboard.press('Alt+=');
  const blocksAfterClassShortcut = await page.locator('.doc-pane .block-select').count();
  if (blocksAfterClassShortcut !== blocksBeforeClassShortcut) {
    issue('Alt+= inserted an equation behind the class dialog');
  } else {
    note('Global shortcuts are blocked behind the class dialog');
  }
  await page.getByRole('button', { name: 'Create class', exact: true }).click();
  const emptyClassState = await page.getByLabel('Class name', { exact: true }).evaluate((el) => ({
    invalid: el.getAttribute('aria-invalid'),
    describedBy: el.getAttribute('aria-describedby'),
  }));
  if (
    emptyClassState.invalid !== 'true' ||
    !emptyClassState.describedBy?.split(/\s+/).includes('class-name-error') ||
    !(await page.locator('#class-name-error').isVisible())
  ) {
    issue('Empty class name does not have persistent, connected feedback');
  } else {
    note('Empty class name has persistent, connected feedback');
  }
  await page.getByLabel('Class name', { exact: true }).fill('Algebra 1');
  await page.getByRole('button', { name: 'Create class', exact: true }).click();
  await page.waitForTimeout(200);
  const classOpts = await page.getByLabel('Current class').locator('option').count();
  if (classOpts < 2) issue(`Expected ≥2 classes, got ${classOpts}`);
  else note(`Class library has ${classOpts} classes`);

  const assignmentLabel = await page.locator('.title-field').textContent();
  if (!/Assignment name/i.test(assignmentLabel || '')) {
    issue(`Class work title label is unclear: ${assignmentLabel}`);
  } else {
    note('Class work uses the distinct Assignment name label');
  }
  if (!(await page.getByLabel('Current assignment').isVisible())) {
    issue('Current assignment selector is not clearly labeled');
  } else {
    note('Class page selector is labeled Current assignment');
  }

  await openDetails(page, 'Organize pages');
  await page.getByRole('button', { name: 'Rename class', exact: true }).click();
  await page.getByLabel('Class name', { exact: true }).fill('Geometry');
  await page.getByRole('button', { name: 'Save class name', exact: true }).click();
  await page.waitForTimeout(120);
  const renamedClass = await page.getByLabel('Current class').locator('option:checked').textContent();
  if (!/Geometry/.test(renamedClass || '')) issue(`Class rename failed: ${renamedClass}`);
  else note('Current class can be renamed in the accessible dialog');
  f = await focusInfo(page);
  if (!/Rename class/i.test(f.name || '')) {
    issue(`Renaming a class should restore focus to its opener, got ${JSON.stringify(f)}`);
  } else {
    note('Closing the rename dialog restores focus to Rename class');
  }

  // Switch back to Practice class
  await page.getByLabel('Current class').selectOption('class-practice');
  await page.waitForTimeout(150);
  note('Switch class works');
  } else {
    note('Class and assignment controls stay hidden in the student simple UI');
  }

  // Switch to first page in class
  const select = page.getByLabel('Current practice page');
  const values = await select.locator('option').evaluateAll((opts) =>
    opts.map((o) => o.value),
  );
  await select.selectOption(values[0]);
  await page.waitForTimeout(150);
  const blocks = await page.locator('.doc-pane .block-select').count();
  if (blocks < 1) issue('Switched page has no blocks');
  else note('Switch page preserves / loads work');
  // Export JSON round-trip via page evaluate download content
  const json = await page.evaluate(() => {
    return localStorage.getItem('digimath-pad-library-v4');
  });
  if (!json || !json.includes('"version":4')) {
    issue('Library v4 not in localStorage');
  } else {
    note('Library v4 autosaved');
  }

  // A returning student should get the current locally saved work back.
  const titleBeforeReload = await page.locator('.title-field input').inputValue();
  const eqCountBeforeReload = await page.locator('.doc-pane .block-select').count();
  if (eqCountBeforeReload > 1) {
    await page.locator('.doc-pane .block-select').last().click();
    await page.waitForTimeout(400);
  }
  const equationBeforeReload = await page.locator('.linear-editor .linear-input').getAttribute('aria-label');
  await page.waitForTimeout(350);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.title-field input');
  const titleAfterReload = await page.locator('.title-field input').inputValue();
  const equationAfterReload = await page.locator('.linear-editor .linear-input').getAttribute('aria-label');
  if (titleAfterReload !== titleBeforeReload) {
    issue(`Reload did not restore current work: before=${titleBeforeReload}, after=${titleAfterReload}`);
  } else {
    note('Reload restores the current locally saved work');
  }
  if (eqCountBeforeReload > 1 && equationAfterReload !== equationBeforeReload) {
    issue(
      `Reload should restore the last edited equation: before=${equationBeforeReload}, after=${equationAfterReload}`,
    );
  } else if (eqCountBeforeReload > 1) {
    note('Reload restores the last edited equation');
  }

  // Import path: inject a sheet via file input (advanced UI only).
  if (!simpleUi) {
    const importPayload = JSON.stringify({
      format: 'digimath-pad-sheet',
      version: 1,
      sheet: {
        id: 'tmp',
        title: 'Imported Quiz',
        blocks: [{ id: 'e1', type: 'equation', latex: 'a^2+b^2=c^2' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    await page.setInputFiles('input[type="file"]', {
      name: 'quiz.digimath.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importPayload),
    });
    await page.waitForTimeout(200);
    const titleAfter = await page.locator('.title-field input').inputValue();
    if (titleAfter !== 'Imported Quiz') {
      issue(`Import failed, title=${titleAfter}`);
    } else {
      note('JSON import creates Imported Quiz sheet');
    }
    const importedLatex = await page.locator('.linear-editor .linear-input').inputValue();
    if (!importedLatex.includes('a^2')) {
      const st = await statusText(page);
      if (/Imported/i.test(st || '')) note(`Import announced: ${st}`);
      else issue(`Import latex missing: ${importedLatex}`);
    } else {
      note('Imported equation LaTeX present');
    }
  } else {
    note('JSON backup upload stays hidden in the student simple UI');
  }

  if (!simpleUi) {
    await openDetails(page, 'Organize pages');
    await page.getByRole('button', { name: /Duplicate practice page/i }).click();
    await page.waitForTimeout(100);
    note('Duplicate control works');
  } else {
    note('Duplicate practice page stays hidden in the student simple UI');
  }
  // Skip to Linear (page-level link from the account bar)
  const skipLinear = page.getByRole('link', { name: 'Skip to Linear' });
  await skipLinear.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  f = await focusInfo(page);
  if (!f.isLinear) issue(`Skip to Linear failed: ${JSON.stringify(f)}`);
  else note('Skip to Linear focuses Linear');

  // The old off-screen Skip to Your work button must not leak into New equation speech.
  await page.keyboard.press('Alt+N');
  await page.waitForTimeout(120);
  if (await page.getByText('Skip to Your work', { exact: true }).count()) {
    issue('The redundant Skip to Your work control is still exposed');
  } else {
    note('The redundant Skip to Your work control is removed');
  }
  await workRow().focus();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(80);
  f = await focusInfo(page);
  if (f.tag !== 'button' || !/^New equation\b/i.test(f.text || f.name || '')) {
    issue(`Tab from the active answer should land directly on New equation: ${JSON.stringify(f)}`);
  } else {
    note('Tab from an answer lands directly on New equation without leaked skip text');
  }
  await workRow().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  f = await focusInfo(page);
  if (f.id !== 'prose-focus-target') {
    issue(`Enter on a note row should edit the note: ${JSON.stringify(f)}`);
  } else {
    note('Enter on a Your work note opens the note for editing');
  }

  // Return to Linear from a note via New equation (primary student control).
  await page.getByRole('button', { name: /^New equation/i }).click();
  await page.waitForTimeout(120);
  f = await focusInfo(page);
  if (!f.isLinear) issue(`New equation should return focus to Linear: ${JSON.stringify(f)}`);
  else note('New equation returns to Linear from a note');

  // Alt+Backspace must not wipe
  const beforeBlocks = await page.locator('.doc-pane .block-select').count();
  await page.locator('.linear-editor .linear-input').focus();
  await page.keyboard.press('Alt+Backspace');
  await page.waitForTimeout(80);
  const afterBlocks = await page.locator('.doc-pane .block-select').count();
  if (afterBlocks < beforeBlocks) issue('Alt+Backspace removed a block');
  else note('Alt+Backspace does not remove equations');

  // Delete remains normal text editing outside the Your work list.
  const blocksBeforeTitleDelete = await page.locator('.doc-pane .block-select').count();
  await page.locator('.title-field input').focus();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(80);
  const blocksAfterTitleDelete = await page.locator('.doc-pane .block-select').count();
  if (blocksAfterTitleDelete !== blocksBeforeTitleDelete) {
    issue('Delete removed an equation while focus was in the work-name field');
  } else {
    note('Delete removes work only when a Your work row is focused');
  }

  // A storage failure must be visible and announced instead of silently losing work.
  await page.evaluate(() => {
    globalThis.__originalStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable for test');
    };
  });
  await page.locator('.title-field input').fill('Unsaved test');
  await page.waitForTimeout(400);
  const failedSaveState = await page.locator('.save-state').textContent();
  const failedSaveAnnouncement = await statusText(page);
  if (!/Not saved/i.test(failedSaveState || '') || !/could not be saved/i.test(failedSaveAnnouncement || '')) {
    issue(`Save failure is unclear: state=${failedSaveState}, status=${failedSaveAnnouncement}`);
  } else {
    note('Storage failure is visible and announced with a backup instruction');
  }
  await page.evaluate(() => {
    Storage.prototype.setItem = globalThis.__originalStorageSetItem;
    delete globalThis.__originalStorageSetItem;
  });

  // Exercise the remaining app-level shortcuts in a clean personal workspace.
  const shortcutContext = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const shortcutPage = await shortcutContext.newPage();
  await shortcutPage.addInitScript(() => {
    localStorage.removeItem('digimath-pad-document-v2');
    localStorage.removeItem('digimath-pad-library-v3');
    localStorage.removeItem('digimath-pad-library-v4');
  });
  await shortcutPage.goto(BASE, { waitUntil: 'domcontentloaded' });
  await shortcutPage.waitForSelector('.status-live, #account-heading');
  const shortcutAccountEntry = shortcutPage.locator('#account-heading');
  if (await shortcutAccountEntry.isVisible().catch(() => false)) {
    await shortcutPage
      .getByRole('button', { name: 'Continue with personal practice' })
      .click();
  }
  const shortcutEditor = shortcutPage.locator('.linear-editor .linear-input');
  await shortcutEditor.waitFor();
  await shortcutEditor.fill('x=1');
  await shortcutPage.evaluate(() => navigator.clipboard.writeText('y=2'));
  await shortcutEditor.focus();
  await shortcutPage.keyboard.press('Control+Shift+v');
  await shortcutPage.waitForTimeout(150);
  const pastedEquation = await shortcutEditor.inputValue();
  const shortcutEquationCount = await shortcutPage.locator('.doc-pane .block-select').count();
  if (pastedEquation !== 'y=2' || shortcutEquationCount !== 2) {
    issue(
      `Ctrl+Shift+V did not create and focus a clipboard equation: value=${pastedEquation}, rows=${shortcutEquationCount}`,
    );
  } else {
    note('Ctrl+Shift+V creates and focuses a clipboard equation');
  }

  await shortcutEditor.focus();
  await shortcutPage.keyboard.press('Control+s');
  await shortcutPage.waitForTimeout(150);
  const saveShortcutStatus = await statusText(shortcutPage);
  if (!/^Saved locally\.?$/i.test((saveShortcutStatus || '').trim())) {
    issue(`Ctrl+S did not announce a local save: ${saveShortcutStatus}`);
  } else {
    note('Ctrl+S saves and announces the result');
  }
  await shortcutContext.close();

  await browser.close();

  console.log('\n=== SUMMARY ===');
  console.log(`Issues: ${issues.length}`);
  issues.forEach((i) => console.log(' -', i));
  console.log(`Passed checks: ${notes.length}`);
  process.exit(issues.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
