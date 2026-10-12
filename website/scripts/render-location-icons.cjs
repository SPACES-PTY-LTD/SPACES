/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS Playwright utility. */
// Requires Playwright (local install or NODE_PATH) and a running website dev server.
// Run: node scripts/render-location-icons.cjs http://localhost:3000
const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => console.error('Render error:', error.message));
    await page.route('**/api/v1/location-types**', route => route.fulfill({ json: { success: true, data: [] } }));
    const base = process.argv[2] || 'http://localhost:3000';
    await page.route('**/api/auth/session', route => route.fulfill({ json: {} }));
    await page.goto(`${base}/dev-location-icons-preview`, { waitUntil: 'domcontentloaded' });
    // Render one scene per request to stay below browser WebGL context limits.
    await page.waitForSelector('[data-icon-catalogue]');
    const values = await page.locator('[data-icon-catalogue]').evaluate(node => JSON.parse(node.dataset.iconCatalogue));
    const destination = path.resolve(__dirname, '../public/images/location-types');
    await mkdir(destination, { recursive: true });
    for (const value of values) {
      if (!value || !/^[a-z0-9-]+$/.test(value)) throw new Error('Invalid catalogue icon key');
      await page.goto(`${base}/dev-location-icons-preview?render=1&icon=${value}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(`[data-icon="${value}"] canvas`);
      console.log('Capturing', value);
      await page.waitForFunction(() => document.querySelector('[data-icon] canvas')?.dataset.png);
      const data = await page.locator('[data-icon] canvas').evaluate(canvas => canvas.dataset.png.split(',')[1]);
      await writeFile(path.join(destination, `${value}.png`), Buffer.from(data, 'base64'));
      console.log(`Rendered ${value}`);
    }
    console.log(`Rendered ${values.length} transparent 512 × 512 PNGs.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
