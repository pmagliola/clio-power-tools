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

async function checkPaymentStatus() {
  try {
    return await chrome.runtime.sendMessage({ type: 'GET_PAYMENT_STATUS' });
  } catch {
    return null;
  }
}

function setPaymentUI(status) {
  const section = document.getElementById('trial-section');
  const card = document.getElementById('trial-card');
  const label = document.getElementById('trial-label');
  const sub = document.getElementById('trial-sub');
  const startTrialBtn = document.getElementById('btn-start-trial');
  const upgradeBtn = document.getElementById('btn-upgrade');
  const badge = document.getElementById('tier-badge');

  if (!status) {
    badge.textContent = '';
    return;
  }

  if (status.paid) {
    badge.textContent = 'Pro';
    badge.style.color = '#059669';
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (status.trialStartedAt === null) {
    // No trial started yet — prompt to start one
    badge.textContent = 'Free';
    card.style.display = 'none';
    startTrialBtn.style.display = '';
    upgradeBtn.style.display = 'none';
  } else if (status.trialDaysLeft > 0) {
    // Trial active
    badge.textContent = `Trial — ${status.trialDaysLeft}d left`;
    card.className = 'trial-card';
    card.style.display = '';
    label.textContent = `${status.trialDaysLeft} days left in your free trial`;
    sub.textContent = 'All features included. No card needed yet.';
    startTrialBtn.style.display = 'none';
    upgradeBtn.style.display = '';
  } else {
    // Trial expired
    badge.textContent = 'Trial expired';
    badge.style.color = '#9A3412';
    card.className = 'trial-card expired';
    card.style.display = '';
    label.textContent = 'Your free trial has ended';
    sub.textContent = 'Upgrade to keep logging time to Clio.';
    startTrialBtn.style.display = 'none';
    upgradeBtn.style.display = '';
  }
}

document.getElementById('btn-start-trial').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_TRIAL_PAGE' });
});

document.getElementById('btn-upgrade').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
});

// Init
Promise.all([checkAuthStatus(), checkPaymentStatus()]).then(([connected, status]) => {
  setUI(connected);
  setPaymentUI(status);
});
