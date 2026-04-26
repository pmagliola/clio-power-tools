# Clio Power Tools — Accounts & Setup

Complete these before we can test payments and publish. None block the initial build.

---

## 1. Chrome Web Store Developer Account — $5 one-time

1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account (pmagliola@gmail.com)
3. Pay the $5 registration fee
4. Done — you'll be able to publish extensions from this account

---

## 2. Clio Developer Application — Free (requires Clio account)

You need a Clio account to register an OAuth app. If you don't have one, start a free trial at https://www.clio.com/

Once you have a Clio account:

1. Go to: https://app.clio.com/settings/developer_applications
2. Click **Create new application**
3. Fill in:
   - **Name:** Clio Power Tools
   - **Redirect URI:** `https://extensionpay.com/oauth/clio` (placeholder — we'll update this once ExtensionPay is set up, or use `chrome-extension://YOUR_EXTENSION_ID/oauth.html`)
   - **Scopes:** Select `activities:read`, `activities:write`, `matters:read`
4. Save and note down:
   - **Client ID** (looks like a long alphanumeric string)
   - **Client Secret** (treat this like a password — don't share it)

Send me the Client ID and Client Secret when you have them. I'll wire them into the extension config.

---

## 3. Stripe Account — Free

1. Go to: https://stripe.com
2. Sign up with pmagliola@gmail.com
3. Complete business verification (you'll need to provide basic info about the business — use Handstands as the business name)
4. Note down your **Publishable Key** and **Secret Key** from the Stripe dashboard (Settings > API Keys)

---

## 4. ExtensionPay Account — Free

ExtensionPay handles subscription billing specifically for Chrome extensions. It connects to your Stripe account.

1. Go to: https://extensionpay.com
2. Sign up and connect your Stripe account
3. Create a new extension called **Clio Power Tools**
4. Set up the Pro plan: $15/month per user
5. Note down your **ExtensionPay extension ID** (looks like `clio-power-tools` or similar)

---

## 5. Domain — ~$12/year

A landing page domain for SEO and direct signups outside the Chrome Web Store.

1. Go to: https://www.cloudflare.com/products/registrar/ (same place as handstands.io)
2. Search for `cliotools.com` — if taken, alternatives: `cliopowertools.com`, `powertools.law`, `cliotimer.com`
3. Register whichever is available for the best price
4. Let me know the domain you registered and I'll build the landing page

---

## Summary checklist

- [ ] Chrome Web Store developer account registered ($5)
- [ ] Clio account created (free trial is fine)
- [ ] Clio developer application created — send me the Client ID + Client Secret
- [ ] Stripe account created
- [ ] ExtensionPay account created and connected to Stripe — send me the extension ID
- [ ] Domain registered — let me know which one you got
