// Long-lived browser host for the demo recording.
//
// Launches Chrome with the unpacked extension, pins the action to the toolbar,
// positions the window deterministically over CDP, then serves commands from
// cmd.json. The driving scripts have to run under a terminal that owns the
// Screen Recording and Accessibility grants, so they cannot be the same process
// that holds the Playwright handle; this host lets them ask questions about
// page state over the filesystem instead.
//
// It also keeps a journal of NAV and TRANSFORM lines on stdout, which is the
// ground truth used to verify that the recording really shows the extension
// working rather than a plausible-looking animation.
import { chromium } from 'playwright';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = process.env.LC_EXT_DIR || resolve(HERE, '..', '..');
const DIR = process.env.LC_DEMO_WORK
  || join(process.env.TMPDIR || '/tmp', 'lc-demo');
const START = process.env.LC_DEMO_URL || 'https://news.ycombinator.com/';

mkdirSync(DIR, { recursive: true });
const CMD = join(DIR, 'cmd.json');
const RESP = join(DIR, 'resp.json');
const STOP = join(DIR, 'stop.flag');

// Window geometry request. Chrome for Testing ignores --window-size and
// --window-position unpredictably, so this is applied over CDP after launch
// and then read back; on a 1920x1080 display Chrome answers with a maximized
// 1920x987 window at top=30.
const WIN = { left: 0, top: 36, width: 1920, height: 1044 };

for (const f of [CMD, RESP, STOP]) if (existsSync(f)) rmSync(f);

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'lc-profile-'));
mkdirSync(join(profile, 'Default'), { recursive: true });
// A fresh profile otherwise opens a "Sign in to Chromium" promo window in
// front of the page, which would sit in the middle of the recording.
writeFileSync(
  join(profile, 'Default', 'Preferences'),
  JSON.stringify({
    signin: { allowed_on_next_startup: false },
    browser: { has_seen_welcome_page: true },
  }),
);

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,ChromeWhatsNewUI',
    '--hide-crash-restore-bubble',
  ],
  ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
  viewport: null,
});

// --- pin the action to the toolbar ------------------------------------------
// Extensions loaded with --load-extension are not pinned, and writing
// extensions.pinned_extensions into Default/Preferences is ignored. The only
// thing that works is toggling it in the extensions UI.
const admin = ctx.pages()[0] || await ctx.newPage();
const idFromUrl = async () => {
  await admin.goto('chrome://extensions/');
  await admin.waitForLoadState('load');
  await admin.waitForTimeout(1200);
  return admin.evaluate(() => {
    const mgr = document.querySelector('extensions-manager');
    const list = mgr.shadowRoot.querySelector('extensions-item-list');
    const item = list.shadowRoot.querySelector('extensions-item');
    return item ? item.getAttribute('id') : null;
  });
};
const ID = process.env.LC_EXT_ID || await idFromUrl();
log('EXT_ID', ID);

await admin.goto(`chrome://extensions/?id=${ID}`);
await admin.waitForLoadState('load');
await admin.waitForTimeout(2200);
const pinned = await admin.evaluate(() => {
  const row = document
    .querySelector('extensions-manager').shadowRoot
    .querySelector('extensions-detail-view').shadowRoot
    .querySelector('#pin-to-toolbar');
  if (!row) return 'NO_ROW';
  const t = row.shadowRoot.querySelector('cr-toggle');
  if (!t) return 'NO_TOGGLE';
  if (!t.checked) t.click();
  return `checked=${t.checked}`;
});
log('PIN', pinned);
if (!/checked=true/.test(pinned)) {
  log('FATAL the action is not pinned, the toolbar click would miss');
  await ctx.close();
  process.exit(1);
}
await admin.waitForTimeout(1000);

// --- the demo tab -----------------------------------------------------------
const page = await ctx.newPage();
await page.goto(START, { waitUntil: 'load' });
await admin.close();
for (const p of ctx.pages()) {
  if (p !== page && /signin|welcome|chrome:\/\/intro|whats-new/i.test(p.url())) {
    log('CLOSE_PROMO', p.url().slice(0, 80));
    await p.close().catch(() => {});
  }
}
await page.bringToFront();

const cdp = await ctx.newCDPSession(page);
const { windowId } = await cdp.send('Browser.getWindowForTarget');
await cdp.send('Browser.setWindowBounds', {
  windowId,
  bounds: { ...WIN, windowState: 'normal' },
});
await sleep(900);
const bounds = (await cdp.send('Browser.getWindowBounds', { windowId })).bounds;
log('BOUNDS', JSON.stringify(bounds));

// Focus the document, but never synthesise a page click here: on the HN front
// page any click can land on a story link. record.sh issues a real CGEvent
// click on empty page background, which is also what clears the omnibox
// selection.
await page.evaluate(() => window.focus());
await sleep(400);

log('TITLE', await page.title());
log('READY');

// --- helpers used by commands ------------------------------------------------
const MARK_ID = '__lc_demo_markers__';

// Chrome's window.screenX/screenY report the window FRAME, not the viewport,
// and the chrome height is not a constant worth guessing. Painting known pure
// colours into the viewport corners and finding them in a screen capture gives
// the exact page-to-screen mapping instead.
const markersOn = () => page.evaluate((id) => {
  document.getElementById(id)?.remove();
  const host = document.createElement('div');
  host.id = id;
  const mk = (css, color) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;width:12px;height:12px;z-index:2147483647;
      background:${color};${css}`;
    return d;
  };
  host.appendChild(mk('left:0;top:0;', 'rgb(255,0,255)'));
  host.appendChild(mk('right:0;top:0;', 'rgb(0,255,255)'));
  host.appendChild(mk('left:0;bottom:0;', 'rgb(255,255,0)'));
  document.documentElement.appendChild(host);
  return { w: window.innerWidth, h: window.innerHeight };
}, MARK_ID);

const markersOff = () => page.evaluate((id) => {
  document.getElementById(id)?.remove();
  return true;
}, MARK_ID);

const commentLinks = (ox, oy) => page.evaluate(([ox, oy]) => {
  const out = [];
  for (const a of document.querySelectorAll('a[href^="item?id="]')) {
    const txt = (a.textContent || '').trim();
    if (!/comment/i.test(txt)) continue;
    const b = a.getBoundingClientRect();
    if (b.width < 4 || b.top < 10) continue;
    if (b.bottom > window.innerHeight - 10) continue;
    out.push({
      text: txt.slice(0, 30),
      href: a.getAttribute('href'),
      x: Math.round(ox + b.left + b.width / 2),
      y: Math.round(oy + b.top + b.height / 2),
    });
  }
  return out;
}, [ox, oy]);

const pageState = () => page.evaluate(() => {
  const el = document.querySelector('.titleline a, .commtext, h1, a');
  return {
    url: location.href,
    transform: el ? getComputedStyle(el).textTransform : 'no-el',
    rootClass: document.documentElement.className,
    scrollY: Math.round(window.scrollY),
    inner: { w: window.innerWidth, h: window.innerHeight },
  };
});

const handlers = {
  state: () => pageState(),
  markers_on: () => markersOn(),
  markers_off: () => markersOff(),
  links: async (a) => commentLinks(a.ox, a.oy),
  blank: async (a) => page.evaluate(([ox, oy]) => {
    // A click target that hits no link, used to dismiss the popup and to clear
    // the omnibox selection without navigating.
    for (let fy = 0.45; fy < 0.92; fy += 0.04) {
      for (let fx = 0.86; fx < 0.99; fx += 0.02) {
        const x = Math.round(window.innerWidth * fx);
        const y = Math.round(window.innerHeight * fy);
        const el = document.elementFromPoint(x, y);
        if (el && !el.closest('a,input,button,textarea')) {
          return { x: Math.round(ox + x), y: Math.round(oy + y) };
        }
      }
    }
    return null;
  }, [a.ox, a.oy]),
  goto: async (a) => {
    await page.goto(a.url, { waitUntil: 'load' });
    await sleep(500);
    return pageState();
  },
  bounds: async () => (await cdp.send('Browser.getWindowBounds', { windowId })).bounds,
  activate: async () => { await page.bringToFront(); return true; },
};

// --- command loop + navigation/transform journal ----------------------------
let lastSeq = -1;
let lastUrl = '';
let lastTf = '';
const t0 = Date.now();

while (!existsSync(STOP)) {
  if (existsSync(CMD)) {
    let req = null;
    try { req = JSON.parse(readFileSync(CMD, 'utf8')); } catch { req = null; }
    if (req && req.seq !== lastSeq) {
      lastSeq = req.seq;
      let out;
      try {
        const h = handlers[req.action];
        out = h ? { ok: true, data: await h(req.args || {}) }
                : { ok: false, error: `unknown action ${req.action}` };
      } catch (e) {
        out = { ok: false, error: String(e && e.message ? e.message : e) };
      }
      writeFileSync(RESP, JSON.stringify({ seq: req.seq, ...out }));
      log('CMD', req.action, JSON.stringify(out).slice(0, 220));
    }
  }

  try {
    const s = await pageState();
    if (s.url !== lastUrl) { log('NAV', Date.now() - t0, s.url); lastUrl = s.url; }
    if (s.transform !== lastTf) {
      log('TRANSFORM', Date.now() - t0, s.transform, `root=${s.rootClass}`);
      lastTf = s.transform;
    }
  } catch { /* navigation in flight */ }

  await sleep(150);
}

log('STOPPING');
await ctx.close();
rmSync(profile, { recursive: true, force: true });
log('CLOSED');
