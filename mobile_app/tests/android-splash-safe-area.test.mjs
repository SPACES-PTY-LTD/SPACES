import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const splashRoot = path.dirname(require.resolve('expo-splash-screen/app.plugin.js'));
const { getAndroidSplashConfig } = require(path.join(splashRoot, 'plugin/build/getAndroidSplashConfig.js'));
const { setSplashImageDrawablesForThemeAsync } = require(path.join(splashRoot, 'plugin/build/withAndroidSplashImages.js'));
const projectRoot = path.resolve(import.meta.dirname, '..');
const app = JSON.parse(await readFile(path.join(projectRoot, 'app.json'), 'utf8')).expo;
const options = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];

// Android's 288dp splash canvas masks everything outside the central 192dp circle.
function artworkOutsideMask(png, scale) {
  let outside = 0;
  const center = png.width / 2;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] && Math.hypot(x + .5 - center, y + .5 - center) > 96 * scale) outside++;
  }
  return outside;
}

test('Android splash artwork fits the system mask at every density in light and dark mode', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'spaces-splash-'));
  try {
    const config = getAndroidSplashConfig(options);
    const src = path.resolve(projectRoot, config.image);
    const assets = Object.fromEntries(['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].map(key => [key, src]));
    for (const theme of ['light', 'dark']) {
      await setSplashImageDrawablesForThemeAsync(assets, theme, root, config.imageWidth);
      for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
        const folder = `drawable-${theme === 'dark' ? 'night-' : ''}${density}`;
        const png = PNG.sync.read(await readFile(path.join(root, 'android/app/src/main/res', folder, 'splashscreen_logo.png')));
        assert.equal(png.width, 288 * scale);
        assert.ok(png.data.some((value, i) => i % 4 === 3 && value > 0), 'logo must not be empty');
        assert.equal(artworkOutsideMask(png, scale), 0, `${theme}/${density} logo clips`);
      }
    }
    // Demonstrate that this check detects the previous oversized configuration.
    await setSplashImageDrawablesForThemeAsync({ mdpi: src }, 'light', root, options.imageWidth);
    const old = PNG.sync.read(await readFile(path.join(root, 'android/app/src/main/res/drawable-mdpi/splashscreen_logo.png')));
    assert.ok(artworkOutsideMask(old, 1) > 0, 'previous sizing reproduces clipping');
    assert.equal(options.imageWidth, 200, 'preserve iOS sizing');
    assert.equal(config.backgroundColor, '#ffffff');
    assert.equal(config.dark.backgroundColor, '#ffffff');
  } finally { await rm(root, { recursive: true, force: true }); }
});
