// ─── Clio OAuth credentials ───────────────────────────────────────────────────
// Get these from: https://app.clio.com/settings/developer_applications
// See SETUP.md for instructions.

export const CLIO_CLIENT_ID = 'Fy7CRgdZ9Tv1wOOQxSYPFzISkaxJvBb0F6a06vn6';
export const CLIO_CLIENT_SECRET = 'TL8LGVOOASRGtOPCrxJM5RiXOezEN2XKZ6DppgFO';

export const CLIO_SCOPES = 'activities:write matters:read';
export const CLIO_REGIONS = [
  'https://app.clio.com',
  'https://au.app.clio.com',
  'https://eu.app.clio.com',
  'https://ca.app.clio.com',
];

// ─── ExtensionPay ─────────────────────────────────────────────────────────────
// Get this from: https://extensionpay.com after creating your extension.
// Leave empty for free-only builds.

export const EXTENSIONPAY_ID = 'REPLACE_WITH_YOUR_EXTENSIONPAY_ID';
