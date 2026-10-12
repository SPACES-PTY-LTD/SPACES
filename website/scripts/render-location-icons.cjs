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
    await page.route('**/api/v1/location-types**', route => route.fulfill({ json: { success: true, data: [] } }));
    await page.goto(`${process.argv[2] || 'http://localhost:3000'}/dev-location-icons-preview?render=1`);
    await page.waitForSelector('[data-icon="fuel"] canvas');
    // Wait for every WebGL scene to draw real pixels rather than exporting an empty canvas.
    await page.waitForFunction(() => [...document.querySelectorAll('[data-icon] canvas')].length === 5 && [...document.querySelectorAll('[data-icon] canvas')].every(canvas => {
      const gl = canvas.getContext('webgl2');
      const pixels = new Uint8Array(512 * 512 * 4);
      gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    }));
    const assets = await page.locator('[data-icon]').evaluateAll(nodes => nodes.map(node => ({ value: node.dataset.icon, data: node.querySelector('canvas').toDataURL('image/png').split(',')[1] })));
    const destination = path.resolve(__dirname, '../public/images/location-types');
    await mkdir(destination, { recursive: true });
    for (const asset of assets) await writeFile(path.join(destination, `${asset.value}.png`), Buffer.from(asset.data, 'base64'));
    console.log(`Rendered ${assets.length} transparent 512 × 512 PNGs.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
