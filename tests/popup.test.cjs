const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const popupScript = path.join(__dirname, '..', 'popup.js');

function popup({ available = true, enabled = false, failToggle = false, errorOnToggle = false, errorOnGet = false, emptyReply = false } = {}) {
  const button = {
    disabled: true,
    attributes: {},
    listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    async click() { await this.listeners.click(); },
  };
  const status = { textContent: '' };
  const chrome = {
    tabs: {
      async query() { return [{ id: 1 }]; },
      async sendMessage(id, message, options) {
        assert.equal(id, 1);
        assert.equal(options.frameId, 0);
        if (!available) throw Error('No content script on this page');
        if (emptyReply) return undefined;
        if (message.type === 'getState' && errorOnGet) return { error: 'Could not read this preference.' };
        if (message.type === 'toggle' && failToggle) throw Error('tab closed');
        if (message.type === 'toggle' && errorOnToggle) return { error: 'Could not save this preference.' };
        if (message.type === 'toggle') enabled = !enabled;
        return { enabled };
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(popupScript, 'utf8'), {
    chrome,
    document: { getElementById(id) { return id === 'toggle' ? button : status; } },
  }, { filename: popupScript });
  return { button, status, async ready() { await new Promise((resolve) => setImmediate(resolve)); } };
}

test('opens in the saved state and switches both ways', async () => {
  const view = popup({ enabled: true });
  await view.ready();
  assert.equal(view.button.disabled, false);
  assert.equal(view.button.attributes['aria-pressed'], 'true');
  await view.button.click();
  assert.equal(view.button.attributes['aria-pressed'], 'false');
  await view.button.click();
  assert.equal(view.button.attributes['aria-pressed'], 'true');
});

test('disables the toggle on pages Chrome does not allow extensions to change', async () => {
  const view = popup({ available: false });
  await view.ready();
  assert.equal(view.button.disabled, true);
  assert.match(view.status.textContent, /unavailable/i);
});

test('shows unavailable when a click cannot reach the page', async () => {
  const view = popup({ failToggle: true });
  await view.ready();
  await view.button.click();
  assert.match(view.status.textContent, /unavailable/i);
});

test('shows unavailable when the page reports a save error', async () => {
  const view = popup({ errorOnToggle: true });
  await view.ready();
  await view.button.click();
  assert.match(view.status.textContent, /unavailable/i);
});

test('shows unavailable when the page reports an error on load', async () => {
  const view = popup({ errorOnGet: true });
  await view.ready();
  assert.equal(view.button.disabled, true);
  assert.match(view.status.textContent, /unavailable/i);
});

test('shows unavailable when the page sends no reply', async () => {
  const view = popup({ emptyReply: true });
  await view.ready();
  assert.equal(view.button.disabled, true);
  assert.match(view.status.textContent, /unavailable/i);
});
