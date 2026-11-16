// Renders each store/ HTML mockup at 3x, then downscales to its exact target size.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const assets = [
  ['screenshot.html', 'screenshot-1280x800.png', 1280, 800],
  ['screenshot-per-site-1280x800.html', 'screenshot-per-site-1280x800.png', 1280, 800],
  ['screenshot-popup-1280x800.html', 'screenshot-popup-1280x800.png', 1280, 800],
  ['promo-tile-440x280.html', 'promo-tile-440x280.png', 440, 280],
  ['marquee-1400x560.html', 'marquee-1400x560.png', 1400, 560],
];

const masters = mkdtempSync(join(tmpdir(), 'lc-art-'));
const dir = new URL('.', import.meta.url).pathname;
const jobs = [];

const browser = await chromium.launch();
for (const [file, out, w, h] of assets) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
  await page.goto(`file://${dir}${file}`);
  await page.waitForTimeout(400);
  const master = join(masters, `${out}.master.png`);
  await page.screenshot({ path: master });
  await page.close();
  jobs.push({ master, out: join(dir, out), w, h });
}
await browser.close();

execFileSync('uv', ['run', '--with', 'pillow', 'python', join(dir, 'downscale.py')], {
  input: JSON.stringify(jobs),
  stdio: ['pipe', 'inherit', 'inherit'],
});
console.log(`masters kept in ${masters}`);
