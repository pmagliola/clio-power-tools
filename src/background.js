import { CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_SCOPES, CLIO_REGIONS, EXTENSIONPAY_ID } from './config.js';
import ExtPay from 'extpay';

const extpay = ExtPay(EXTENSIONPAY_ID);
extpay.startBackground();

// ─── Payment status ───────────────────────────────────────────────────────────

async function isAllowedToLog() {
  const user = await extpay.getUser();
  if (user.paid) return true;
  if (user.trialStartedAt) {
    const trialDays = 14;
    const elapsed = (Date.now() - user.trialStartedAt.getTime()) / (1000 * 60 * 60 * 24);
    return elapsed < trialDays;
  }
  return false;
}

// ─── Region detection ─────────────────────────────────────────────────────────

async function getBaseUrl() {
  const { clioBaseUrl } = await chrome.storage.local.get('clioBaseUrl');
  return clioBaseUrl || CLIO_REGIONS[0];
}

// ─── Token management ─────────────────────────────────────────────────────────

async function getValidToken() {
  const stored = await chrome.storage.local.get([
    'access_token',
    'refresh_token',
    'token_expires_at',
  ]);

  // Return existing token if still valid (with 60s buffer)
  if (stored.access_token && stored.token_expires_at > Date.now() + 60_000) {
    return stored.access_token;
  }

  // Try to refresh
  if (stored.refresh_token) {
    return await refreshAccessToken(stored.refresh_token);
  }

  return null;
}

async function refreshAccessToken(refreshToken) {
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIO_CLIENT_ID,
      client_secret: CLIO_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    // Refresh failed — clear stored tokens so user re-connects
    await chrome.storage.local.remove(['access_token', 'refresh_token', 'token_expires_at']);
    return null;
  }

  const data = await response.json();
  await persistTokens(data);
  return data.access_token;
}

async function persistTokens(tokenData) {
  await chrome.storage.local.set({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: Date.now() + tokenData.expires_in * 1000,
  });
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

async function attemptOAuth(detectedUrl) {
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl = new URL(`${detectedUrl}/oauth/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIO_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', CLIO_SCOPES);

  let responseUrl;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });
  } catch (err) {
    throw err;
  }

  const url = new URL(responseUrl);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('No authorisation code returned from Clio');

  const regionsToTry = [
    detectedUrl,
    ...CLIO_REGIONS.filter(r => r !== detectedUrl),
  ];

  for (const baseUrl of regionsToTry) {
    try {
      const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: CLIO_CLIENT_ID,
          client_secret: CLIO_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code,
        }),
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        await persistTokens(tokenData);
        await chrome.storage.local.set({ clioBaseUrl: baseUrl });
        return;
      }
    } catch {
      // CORS or network error on this region — try next
    }
  }

  throw new Error('Could not connect to Clio. Please try again.');
}

async function connectToClio() {
  const detectedUrl = await getBaseUrl();
  try {
    await attemptOAuth(detectedUrl);
  } catch (err) {
    // If the user explicitly cancelled, stop immediately
    const msg = err.message ?? '';
    if (msg.includes('cancel') || msg.includes('Cancel') || msg.includes('closed by user')) {
      throw new Error('Connection cancelled.');
    }
    // Otherwise retry once — handles the login-then-consent case where
    // the initial flow errors out after login before reaching the consent screen
    await attemptOAuth(detectedUrl);
  }
}

async function disconnectFromClio() {
  await chrome.storage.local.remove(['access_token', 'refresh_token', 'token_expires_at']);
}

// ─── Clio API ─────────────────────────────────────────────────────────────────

async function createTimeEntry({ matterId, seconds, date, description }) {
  const token = await getValidToken();
  if (!token) throw new Error('Not connected to Clio. Please connect from the extension popup.');

  const baseUrl = await getBaseUrl();
  const body = {
    data: {
      type: 'TimeEntry',
      date: date || new Date().toISOString().slice(0, 10),
      quantity: seconds,
      ...(description ? { note: description } : {}),
      ...(matterId ? { matter: { id: parseInt(matterId, 10) } } : {}),
    },
  };

  const response = await fetch(`${baseUrl}/api/v4/activities.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Clio API error (${response.status}): ${errBody.slice(0, 200)}`);
  }

  return await response.json();
}

async function getMatter(matterId) {
  const token = await getValidToken();
  if (!token) return null;

  const baseUrl = await getBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/v4/matters/${matterId}.json?fields=id,display_number,description`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data.data ?? null;
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // keep message channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'CONNECT':
      await connectToClio();
      return { success: true };

    case 'DISCONNECT':
      await disconnectFromClio();
      return { success: true };

    case 'GET_AUTH_STATUS': {
      const token = await getValidToken();
      return { connected: !!token };
    }

    case 'CREATE_TIME_ENTRY': {
      const user = await extpay.getUser();
      if (!user.paid && !user.trialStartedAt) return { error: 'trial_not_started' };
      if (!user.paid && user.trialStartedAt) {
        const elapsed = (Date.now() - user.trialStartedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (elapsed >= 14) return { error: 'upgrade_required' };
      }
      return await createTimeEntry(message.payload);
    }

    case 'GET_MATTER':
      return await getMatter(message.matterId);

    case 'GET_PAYMENT_STATUS': {
      const user = await extpay.getUser();
      const trialDays = 14;
      const trialStartedAt = user.trialStartedAt;
      let trialDaysLeft = null;
      if (trialStartedAt && !user.paid) {
        const elapsed = (Date.now() - trialStartedAt.getTime()) / (1000 * 60 * 60 * 24);
        trialDaysLeft = Math.max(0, Math.ceil(trialDays - elapsed));
      }
      return { paid: user.paid, trialStartedAt: trialStartedAt?.toISOString() ?? null, trialDaysLeft };
    }

    case 'OPEN_PAYMENT_PAGE':
      extpay.openPaymentPage();
      return { success: true };

    case 'OPEN_TRIAL_PAGE':
      extpay.openTrialPage();
      return { success: true };

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
