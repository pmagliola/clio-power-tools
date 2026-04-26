// Clio Power Tools — popup script

async function checkAuthStatus() {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
    return result.connected;
  } catch {
    return false;
  }
}

function setUI(connected) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  const sub = document.getElementById('status-sub');
  const connectBtn = document.getElementById('btn-connect');
  const disconnectBtn = document.getElementById('btn-disconnect');

  dot.className = 'status-dot' + (connected ? ' connected' : '');
  label.textContent = connected ? 'Connected to Clio' : 'Not connected';
  sub.textContent = connected ? '' : 'Timer will show but logging needs auth';
  connectBtn.style.display = connected ? 'none' : '';
  disconnectBtn.style.display = connected ? '' : 'none';
}

document.getElementById('btn-connect').addEventListener('click', async () => {
  const btn = document.getElementById('btn-connect');
  btn.disabled = true;
  btn.textContent = 'Opening Clio...';

  const result = await chrome.runtime.sendMessage({ type: 'CONNECT' });

  if (result.error) {
    btn.disabled = false;
    btn.textContent = 'Connect to Clio';
    alert('Connection failed: ' + result.error);
    return;
  }

  setUI(true);
});

document.getElementById('btn-disconnect').addEventListener('click', async () => {
  const btn = document.getElementById('btn-disconnect');
  btn.disabled = true;

  await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
  setUI(false);
});

document.getElementById('btn-open-clio').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://app.clio.com' });
  window.close();
});

// Init
checkAuthStatus().then(setUI);
