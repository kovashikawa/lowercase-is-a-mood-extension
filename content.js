(() => {
  const key = `lowercase-mood:${location.origin}`;
  const className = 'lowercase-mood-on';
  let enabled = false;

  function render(value) {
    enabled = Boolean(value);
    document.documentElement.classList.toggle(className, enabled);
  }

  const ready = chrome.storage.local.get(key).then((values) => render(values[key]));

  new MutationObserver(() => {
    if (document.documentElement.classList.contains(className) !== enabled) render(enabled);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.hasOwn(changes, key)) {
      render(changes[key].newValue);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'getState' && message?.type !== 'toggle') return;

    (async () => {
      await ready;
      if (message.type === 'toggle') {
        const next = !enabled;
        await chrome.storage.local.set({ [key]: next });
        render(next);
      }
      return { enabled };
    })().then(respond, () => respond({ error: 'Could not save this preference.' }));

    return true;
  });
})();
