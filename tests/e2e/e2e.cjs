const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const html = '<!doctype html><html><body><h1 id="h">Hello WORLD</h1><p id="p">Mixed Case Text</p><input id="i" value="KeepMe"></body></html>';

let failed = 0;
function check(name, ok, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
}

(async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const siteA = `http://127.0.0.1:${port}/`;
  const siteB = `http://localhost:${port}/`;

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcm-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, '--headless=new'],
  });

  try {
    const admin = await context.newPage();
    await admin.goto('chrome://extensions');
    const infos = await admin.evaluate(async () => (await chrome.developerPrivate.getExtensionsInfo()).map((e) => [e.id, e.name]));
    const ids = infos.filter(([, name]) => name === 'Lowercase Is a Mood').map(([id]) => id);
    check('extension loads', ids.length === 1);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${ids[0]}/popup.html`);

    const transform = (page, sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).textTransform, sel);
    const liveTabs = () => popup.evaluate(async () => {
      const out = [];
      for (const tab of await chrome.tabs.query({})) {
        try {
          if (await chrome.tabs.sendMessage(tab.id, { type: 'getState' }, { frameId: 0 })) out.push(tab.id);
        } catch {}
      }
      return out;
    });
    const send = (message, tabId) => popup.evaluate(([m, id]) => chrome.tabs.sendMessage(id, m, { frameId: 0 }), [message, tabId]);
    async function open(url) {
      const before = new Set(await liveTabs());
      const page = await context.newPage();
      await page.goto(url);
      await page.waitForTimeout(200);
      const added = (await liveTabs()).filter((id) => !before.has(id));
      if (added.length !== 1) throw new Error(`cannot identify tab for ${url}`);
      return [page, added[0]];
    }

    const [page, tab1] = await open(siteA);
    check('default is original case', (await transform(page, '#h')) === 'none');
    check('state starts off', (await send({ type: 'getState' }, tab1)).enabled === false);
    check('toggle turns on', (await send({ type: 'toggle' }, tab1)).enabled === true);
    check('text is lowercase', (await transform(page, '#h')) === 'lowercase' && (await transform(page, '#p')) === 'lowercase');
    check('source text unchanged', (await page.textContent('#h')) === 'Hello WORLD');
    check('form value unchanged', (await page.inputValue('#i')) === 'KeepMe');

    await page.evaluate(() => { document.documentElement.className = 'page-owned'; });
    await page.waitForTimeout(100);
    check('class survives the page overwriting it', (await transform(page, '#h')) === 'lowercase');
    check('state still reads on after overwrite', (await send({ type: 'getState' }, tab1)).enabled === true);

    await page.reload();
    check('persists across reload', (await transform(page, '#h')) === 'lowercase');

    const [other] = await open(siteB);
    check('other origin unaffected', (await transform(other, '#h')) === 'none');

    const [page2, tab2] = await open(siteA);
    check('second tab starts lowercase', (await transform(page2, '#h')) === 'lowercase');
    await send({ type: 'toggle' }, tab2);
    await page.waitForTimeout(300);
    check('toggle off syncs across tabs', (await transform(page, '#h')) === 'none' && (await transform(page2, '#h')) === 'none');

    await popup.bringToFront();
    await popup.reload();
    await popup.waitForTimeout(300);
    check('popup handles a non-scriptable page', (await popup.textContent('#status')) === 'Unavailable on this page');

    const granted = await popup.evaluate(() => chrome.permissions.getAll());
    check('granted permissions are storage only', JSON.stringify(granted.permissions) === '["storage"]', JSON.stringify(granted.permissions));
  } finally {
    await context.close();
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
