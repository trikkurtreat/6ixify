const input = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const toggleBtn = document.getElementById('toggleBtn');
const msg = document.getElementById('msg');

chrome.storage.local.get('apiKey', ({ apiKey }) => {
  if (apiKey) input.value = apiKey;
});

toggleBtn.addEventListener('click', () => {
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
});

saveBtn.addEventListener('click', async () => {
  const key = input.value.trim();

  if (!key) {
    showMsg('Enter a key, fam.', true);
    return;
  }

  if (!key.startsWith('sk-ant-')) {
    showMsg("Doesn't look like an Anthropic key (should start with sk-ant-).", true);
    return;
  }

  await chrome.storage.local.set({ apiKey: key });
  showMsg("Saved. You're on road.");
});

function showMsg(text, isError = false) {
  msg.textContent = text;
  msg.className = isError ? 'error' : '';
}
