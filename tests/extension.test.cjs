const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contentScript = path.join(__dirname, '..', 'content.js');
const storageListeners = new WeakMap();

function page(origin, sharedStorage = new Map(), { failWrites = false } = {}) {
  const classes = new Set();
  let messageListener;
  if (!storageListeners.has(sharedStorage)) storageListeners.set(sharedStorage, new Set());
  const listeners = storageListeners.get(sharedStorage);
  const chrome = {
    storage: {
      local: {
        async get(key) { return { [key]: sharedStorage.get(key) }; },
        async set(values) {
          if (failWrites) throw Error('quota exceeded');
          for (const [key, value] of Object.entries(values)) {
            const oldValue = sharedStorage.get(key);
            sharedStorage.set(key, value);
            for (const listener of listeners) listener({ [key]: { oldValue, newValue: value } }, 'local');
          }
        },
      },
      onChanged: { addListener(listener) { listeners.add(listener); } },
    },
    runtime: { onMessage: { addListener(listener) { messageListener = listener; } } },
  };
  const document = {
    documentElement: {
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); },
        toggle(name, force) {
          if (force) classes.add(name);
          else classes.delete(name);
          return Boolean(force);
        },
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(contentScript, 'utf8'), { chrome, document, location: { origin } }, { filename: contentScript });
  return {
    classes,
    listeners,
    raw(message) { return messageListener(message, {}, () => assert.fail('must not respond')); },
    async send(type) {
      return new Promise((resolve) => {
        const asynchronous = messageListener({ type }, {}, resolve);
        assert.equal(asynchronous, true, 'message listener must keep the reply channel open');
      });
    },
  };
}

const applied = (view) => view.classes.has('lowercase-mood-on');

test('starts in original case and toggles without changing source text', async () => {
  const storage = new Map();
  const view = page('https://example.com', storage);
  assert.equal((await view.send('getState')).enabled, false);
  assert.equal(applied(view), false);
  assert.equal((await view.send('toggle')).enabled, true);
  assert.equal(applied(view), true);
  assert.equal(storage.get('lowercase-mood:https://example.com'), true);
  assert.equal((await view.send('toggle')).enabled, false);
  assert.equal(applied(view), false);
});

test('remembers the preference on reload', async () => {
  const storage = new Map([['lowercase-mood:https://example.com', true]]);
  const view = page('https://example.com', storage);
  assert.equal((await view.send('getState')).enabled, true);
  assert.equal(applied(view), true);
});

test('keeps other origins unchanged', async () => {
  const storage = new Map();
  const first = page('https://example.com', storage);
  const second = page('https://other.example', storage);
  await first.send('toggle');
  assert.equal(applied(first), true);
  assert.equal((await second.send('getState')).enabled, false);
  assert.equal(applied(second), false);
});

test('propagates state changes between open tabs on the same origin', async () => {
  const storage = new Map();
  const first = page('https://example.com', storage);
  const second = page('https://example.com', storage);
  await second.send('getState');
  await first.send('toggle');
  assert.equal(applied(first), true);
  assert.equal(applied(second), true);
});

test('ignores messages that are not for this extension', () => {
  const view = page('https://example.com');
  assert.equal(view.raw({ type: 'something-else' }), undefined);
  assert.equal(view.raw(undefined), undefined);
});

test('ignores storage changes for other keys and other storage areas', async () => {
  const storage = new Map();
  const view = page('https://example.com', storage);
  await view.send('getState');
  for (const listener of view.listeners) {
    listener({ 'lowercase-mood:https://other.example': { newValue: true } }, 'local');
    listener({ 'lowercase-mood:https://example.com': { newValue: true } }, 'sync');
  }
  assert.equal(view.classes.has('lowercase-mood-on'), false);
});

test('reports an error and keeps the page unchanged when saving fails', async () => {
  const view = page('https://example.com', new Map(), { failWrites: true });
  const reply = await view.send('toggle');
  assert.equal(reply.error, 'Could not save this preference.');
  assert.equal(view.classes.has('lowercase-mood-on'), false);
});
