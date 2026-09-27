// Verifies the real-backend swap: patches config.js to mode 'live', drives the
// UI against tests/live-stub.mjs (cross-origin, contract-conformant, PARAPHRASED
// claim text → exercises the positional fallback), then restores config.js.
// Requires Playwright + Chromium (npx playwright install chromium) and a static
// server on :8080 (python -m http.server 8080 --directory verilive).
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { startStub, STUB_PORT } from './live-stub.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const configUrl = new URL('../config.js', import.meta.url);
const originalConfig = await readFile(configUrl, 'utf8');
const pageUrl = process.env.TEST_URL || 'http://127.0.0.1:8080';
let browser, stub;
try {
  stub = await startStub();
  const patched = originalConfig
    .replace("mode: 'mock'", "mode: 'live'")
    .replace("baseUrl: ''", `baseUrl: 'http://127.0.0.1:${STUB_PORT}'`);
  assert.notEqual(patched, originalConfig, 'config patch did not apply');
  await writeFile(configUrl, patched);

  let launchOptions = { headless: true };
  if (process.env.CHROMIUM_MODULE) {
    const { default: binary } = await import(process.env.CHROMIUM_MODULE);
    launchOptions = { ...launchOptions, executablePath: await binary.executablePath(), args: binary.args };
  }
  browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const allowed = new Set([pageUrl, `http://127.0.0.1:${STUB_PORT}`]);
  await page.route('**/*', route => allowed.has(new URL(route.request().url()).origin)
    ? route.continue() : route.abort());

  await page.goto(pageUrl);
  // Config-driven chrome switched to live mode.
  assert.equal(await page.locator('#mode-label').innerText(), 'LIVE API');
  assert.match(await page.locator('#demo-note').innerText(), /verification backend/);
  assert.match(await page.locator('#footer-mode').innerText(), /Connected to your verification API/);

  await page.locator('#submit').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Verification complete');
  assert.equal(await page.locator('.sentence-row').count(), 5);
  assert.equal(await page.locator('#count-SUPPORTED').innerText(), '2');
  assert.equal(await page.locator('#count-PARTIAL').innerText(), '1');
  assert.equal(await page.locator('#count-INSUFFICIENT').innerText(), '1');
  assert.equal(await page.locator('#count-CONTRADICTED').innerText(), '1');
  // Paraphrased claims were paired positionally: evidence/source come from stub.
  await page.locator('.sentence-button').first().click();
  assert.match(await page.locator('#detail-evidence').innerText(), /photovoltaic array/i);
  assert.match(await page.locator('#detail-source').innerText(), /stub-corpus\.md/);
  await page.locator('.sentence-button').last().click();
  assert.match(await page.locator('#detail-verdict').innerText(), /Contradicted/);
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: config.mode="live" switched the whole UI to fetch-based live-api.js; POST /verify, streaming, polling of GET /claims, paraphrased-claim fallback, counts, evidence panel, and GET /dashboard all verified against the contract stub.');
} finally {
  await browser?.close();
  await stub?.close();
  await writeFile(configUrl, originalConfig);
}
