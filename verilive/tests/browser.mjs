// Optional development-only smoke test: npm install --no-save playwright
// then npx playwright install chromium; node verilive/tests/browser.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
let launchOptions = { headless: true };
if (process.env.CHROMIUM_MODULE) {
  const { default: binary } = await import(process.env.CHROMIUM_MODULE);
  launchOptions = { ...launchOptions, executablePath: await binary.executablePath(), args: binary.args };
}
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = process.env.TEST_URL || 'http://127.0.0.1:8080';
try {
  // No external requests are allowed; a local static server is all the demo needs.
  const external = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== new URL(url).origin) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.goto(url);
  assert.equal(await page.locator('#status').innerText(), 'Ready when you are');
  await page.locator('#submit').click();
  assert.equal(await page.locator('#submit').isDisabled(), true);
  assert.equal(await page.locator('#working').isVisible(), true);
  await page.waitForFunction(() => document.querySelectorAll('.sentence-row').length === 1);
  assert.equal(await page.locator('.badge.pending').count(), 1);
  await page.locator('.sentence-button').first().click();
  assert.match(await page.locator('#detail-evidence').innerText(), /in progress/);
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Verification complete');
  assert.equal(await page.locator('.sentence-row').count(), 5);
  for (const [key, expected] of Object.entries({ SUPPORTED: 2, PARTIAL: 1, INSUFFICIENT: 1, CONTRADICTED: 1 })) {
    assert.equal(await page.locator(`#count-${key}`).innerText(), String(expected));
  }
  assert.match(await page.locator('#detail-evidence').innerText(), /Photovoltaic cells/);
  await page.locator('.sentence-button').last().click();
  assert.match(await page.locator('#detail-verdict').innerText(), /Contradicted/);
  assert.match(await page.locator('#detail-source').innerText(), /Solar energy primer/);
  await page.screenshot({ path: '/home/user/.cache/verilive-desktop.png', fullPage: true });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#evidence-detail').isVisible(), false);
  assert.equal(await page.locator('.sentence-button').last().evaluate(el => el === document.activeElement), true);
  await page.locator('#question').fill('/error');
  await page.locator('#submit').click();
  await page.locator('#error').waitFor({ state: 'visible' });
  assert.match(await page.locator('#error').innerText(), /Simulated request failure/);
  assert.equal(await page.locator('#submit').isEnabled(), true);
  assert.equal(await page.locator('#working').isVisible(), false);
  assert.equal(await page.locator('#count-SUPPORTED').innerText(), '0');
  await page.locator('#question').fill('How reliable are AI language models?');
  await page.locator('#question').press('Control+Enter');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Verification complete');
  assert.match(await page.locator('.sentence-text').first().innerText(), /tokens/);
  assert.equal(await page.locator('#error').isVisible(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.sentence-button').nth(2).click();
  assert.match(await page.locator('#detail-verdict').innerText(), /Partial/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: '/home/user/.cache/verilive-mobile.png', fullPage: true });
  // With all assets loaded, full offline mode still permits another verification.
  await page.context().setOffline(true);
  await page.locator('#question').fill('Explain solar energy');
  await page.locator('#submit').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Verification complete');
  assert.equal(await page.locator('.sentence-row').count(), 5);
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  console.log('PASS: mock streaming, delayed badges, all counts, evidence auto-update, keyboard focus, error/retry, fresh sessions, mobile layout, fully offline verification; no external requests or browser errors.');
} finally { await browser.close(); }
