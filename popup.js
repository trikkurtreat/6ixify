const btn = document.getElementById('mainBtn');
const statusEl = document.getElementById('status');
const settingsBtn = document.getElementById('settingsBtn');
const slider = document.getElementById('levelSlider');
const levelName = document.getElementById('levelName');
const levelLabels = document.querySelectorAll('.level-labels span');

const LEVEL_NAMES = ['Yorkville', 'Etobicoke', 'Scarborough'];

settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

// --- Slider ---

function applyLevel(level) {
  slider.value = level;
  levelName.textContent = LEVEL_NAMES[level];
  levelLabels.forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.level) === level);
  });
  // Yorkville = no-op, disable the button
  if (level === 0) {
    btn.disabled = true;
    setStatus('Yorkville mode — nothing changes, it\'s giving bougie.');
  } else {
    btn.disabled = false;
    setStatus('');
  }
  chrome.storage.local.set({ sliderLevel: level });
}

slider.addEventListener('input', () => applyLevel(parseInt(slider.value)));

levelLabels.forEach(el => {
  el.addEventListener('click', () => applyLevel(parseInt(el.dataset.level)));
});

// --- Helpers ---

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'error' : '';
}

function setConverted(converted) {
  if (converted) {
    btn.textContent = 'Revert to English';
    btn.classList.add('active');
  } else {
    btn.textContent = '6ixify This Page';
    btn.classList.remove('active');
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// --- Init ---

async function init() {
  const tab = await getActiveTab();

  if (!tab?.url || /^(chrome|chrome-extension|about|edge):\/\//i.test(tab.url)) {
    btn.disabled = true;
    setStatus('Cannot run on this page.');
    return;
  }

  const { apiKey, sliderLevel } = await chrome.storage.local.get(['apiKey', 'sliderLevel']);

  // Restore saved level (default 1 = Etobicoke)
  applyLevel(sliderLevel ?? 1);

  if (!apiKey) {
    setStatus('Add your API key in Settings first.', true);
  }

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
    setConverted(res.isConverted);
  } catch {
    // Content script not yet active on this tab
  }
}

// --- Button ---

btn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  const level = parseInt(slider.value);

  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) {
    chrome.runtime.openOptionsPage();
    return;
  }

  let currentState;
  try {
    currentState = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
  } catch {
    setStatus('Could not reach page — try refreshing it.', true);
    return;
  }

  if (currentState.isConverted) {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'revert' });
    setConverted(res.isConverted);
    setStatus('');
    return;
  }

  btn.disabled = true;
  setStatus(level === 2 ? 'Going rogue... hold tight fam' : 'Linking up with Claude...');

  const res = await chrome.tabs.sendMessage(tab.id, { action: 'convert', level });

  btn.disabled = false;

  if (res.error) {
    setStatus(res.error, true);
  } else if (res.empty) {
    setStatus('No text to convert on this page.');
  } else {
    setConverted(res.isConverted);
    setStatus('');
  }
});

init();
