import { CLIO_CLIENT_ID, CLIO_CLIENT_SECRET, CLIO_SCOPES, CLIO_REGIONS } from './config.js';

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

async function connectToClio() {
  const detectedUrl = await getBaseUrl();
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
    throw new Error(`OAuth cancelled or failed: ${err.message}`);
  }

  const url = new URL(responseUrl);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('No authorisation code returned from Clio');

  // Try detected region first, then fall back to others
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

    case 'CREATE_TIME_ENTRY':
      return await createTimeEntry(message.payload);

    case 'GET_MATTER':
      return await getMatter(message.matterId);

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
