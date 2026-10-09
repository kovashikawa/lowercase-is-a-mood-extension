const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const THROTTLE = 4;
const REPS = 5;
const SMALL = 200;
const LARGE = 3000;

// Generous budgets: roughly 5-10x what a 2024 laptop measures at 4x CPU throttle.
// They catch order-of-magnitude regressions, not small drift on a noisy runner.
const BUDGETS = {
  'toggle, 200 rows (ms)': 100,
  'toggle, 3000 rows (ms)': 600,
  'class lands before first paint (ms vs FCP)': 0,
  '2000 class rewrites by the page (ms)': 300,
  'popup open to enabled (ms)': 500,
};

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (value) => Math.round(value * 10) / 10;

function pageHtml(rows) {
  let body = '';
  for (let i = 0; i < rows; i++) body += `<div><span>Mixed Case Text ${i}</span> <a href="#">Link Text</a></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body><h1>Heading</h1>${body}</body></html>`;
}

const probe = () => {
  window.__m = {};
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') window.__m.fcp = entry.startTime;
  }).observe({ type: 'paint', buffered: true });
  new MutationObserver(() => {
    if (!document.documentElement.classList.contains('lowercase-mood-on')) return;
    const now = performance.now();
    window.__m.classAt ??= now;
    window.__m.lastClassAt = now;
    requestAnimationFrame(() => setTimeout(() => { window.__m.lastPaintAt = performance.now(); }));
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
};

(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(pageHtml(Number(req.url.match(/^\/n\/(\d+)/)?.[1] ?? 10)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const storageKey = `lowercase-mood:${base}`;

  const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'lcm-perf-')), {
    headless: false,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--headless=new'],
  });

  const measured = {};
  try {
    const admin = await context.newPage();
    await admin.goto('chrome://extensions');
    const infos = await admin.evaluate(async () => (await chrome.developerPrivate.getExtensionsInfo()).map((e) => [e.id, e.name]));
    const extId = infos.find(([, name]) => name === 'Lowercase Is a Mood')[0];
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    const setStored = (value) => popup.evaluate(([k, v]) => chrome.storage.local.set({ [k]: v }), [storageKey, value]);

    const throttle = async (page) => {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    };
    const liveTabs = () => popup.evaluate(async () => {
      const out = [];
      for (const tab of await chrome.tabs.query({})) {
        try {
          if (await chrome.tabs.sendMessage(tab.id, { type: 'getState' }, { frameId: 0 })) out.push(tab.id);
        } catch {}
      }
      return out;
    });
    async function openTab(url) {
      const before = new Set(await liveTabs());
      const page = await context.newPage();
      await page.addInitScript(probe);
      await page.goto(url);
      await page.waitForTimeout(300);
      const added = (await liveTabs()).filter((id) => !before.has(id));
      if (added.length !== 1) throw new Error(`cannot identify tab for ${url}`);
      return [page, added[0]];
    }

    // Toggle latency off -> on, from class change to painted frame.
    for (const rows of [SMALL, LARGE]) {
      await setStored(false);
      const [page, tabId] = await openTab(`${base}/n/${rows}`);
      await throttle(page);
      const paint = [];
      for (let i = 0; i < REPS * 2; i++) {
        await page.evaluate(() => { window.__m = {}; });
        const { enabled } = await popup.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'toggle' }, { frameId: 0 }), tabId);
        await page.waitForTimeout(400);
        if (!enabled) continue;
        const m = await page.evaluate(() => window.__m);
        paint.push(m.lastPaintAt - m.classAt);
      }
      measured[`toggle, ${rows} rows (ms)`] = round(median(paint));
      await page.close();
    }

    // Saved state must be applied before the first paint (no flash of original case).
    await setStored(true);
    const lead = [];
    for (let i = 0; i < REPS; i++) {
      const page = await context.newPage();
      await page.addInitScript(probe);
      await throttle(page);
      await page.goto(`${base}/n/${LARGE}`);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => window.__m);
      lead.push(m.classAt - m.fcp);
      await page.close();
    }
    measured['class lands before first paint (ms vs FCP)'] = round(median(lead));

    // A page that keeps rewriting <html class> must not make the observer expensive or loop.
    const rewrites = [];
    for (let i = 0; i < REPS; i++) {
      const page = await context.newPage();
      await throttle(page);
      await page.goto(`${base}/n/${SMALL}`);
      await page.waitForTimeout(300);
      const r = await page.evaluate(async () => {
        const start = performance.now();
        for (let n = 0; n < 2000; n++) { document.documentElement.className = `page-${n}`; await Promise.resolve(); }
        await new Promise((resolve) => setTimeout(resolve, 0));
        return { ms: performance.now() - start, cls: document.documentElement.className };
      });
      if (r.cls !== 'page-1999 lowercase-mood-on') throw new Error(`unexpected final class: ${r.cls}`);
      rewrites.push(r.ms);
      await page.close();
    }
    measured['2000 class rewrites by the page (ms)'] = round(median(rewrites));

    // Popup open until the toggle is enabled. tabs.query is pointed at the test tab because
    // the popup opened as a tab would otherwise see itself; sendMessage is real.
    await setStored(false);
    const [target, tabId] = await openTab(`${base}/n/${SMALL}`);
    const ready = [];
    for (let i = 0; i < REPS; i++) {
      const page = await context.newPage();
      await page.addInitScript((id) => {
        chrome.tabs.query = async () => [{ id }];
        new MutationObserver(() => {
          const button = document.getElementById('toggle');
          if (button && !button.disabled && window.__ready == null) window.__ready = performance.now();
        }).observe(document, { attributes: true, subtree: true, attributeFilter: ['disabled'], childList: true });
      }, tabId);
      await throttle(page);
      await page.goto(`chrome-extension://${extId}/popup.html`);
      await page.waitForFunction(() => window.__ready != null, null, { timeout: 30000 });
      ready.push(await page.evaluate(() => window.__ready));
      await page.close();
    }
    measured['popup open to enabled (ms)'] = round(median(ready));
    await target.close();
  } finally {
    await context.close();
    server.close();
  }

  let failed = 0;
  const lines = ['| Check | Median | Budget | |', '|---|---|---|---|'];
  for (const [name, budget] of Object.entries(BUDGETS)) {
    const value = measured[name];
    const ok = value <= budget;
    if (!ok) failed++;
    lines.push(`| ${name} | ${value} | ${budget} | ${ok ? 'pass' : 'FAIL'} |`);
  }
  const report = [`Perf at ${THROTTLE}x CPU throttle, median of ${REPS} (${os.cpus()[0].model}, ${os.cpus().length} cores)`, '', ...lines].join('\n');
  console.log(report);
  if (process.env.PERF_OUT) fs.writeFileSync(process.env.PERF_OUT, JSON.stringify({ throttle: THROTTLE, reps: REPS, measured, budgets: BUDGETS }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
