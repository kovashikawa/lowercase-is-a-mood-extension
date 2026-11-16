const button = document.getElementById('toggle');
const status = document.getElementById('status');
let tabId;

function show(enabled) {
  button.setAttribute('aria-pressed', String(enabled));
  status.textContent = enabled ? 'Lowercase on this site' : 'Original case on this site';
  status.classList.remove('shown');
  button.disabled = false;
}

function unavailable() {
  status.textContent = 'Unavailable on this page. Reload this tab, then try again.';
  status.classList.add('shown');
}

(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab.id;
    const state = await chrome.tabs.sendMessage(tabId, { type: 'getState' }, { frameId: 0 });
    if (state?.error) throw Error(state.error);
    show(state.enabled);
  } catch {
    unavailable();
  }
})();

button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const state = await chrome.tabs.sendMessage(tabId, { type: 'toggle' }, { frameId: 0 });
    if (state?.error) throw Error(state.error);
    show(state.enabled);
  } catch {
    unavailable();
  }
});
