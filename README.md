# Okta SAML Next.js

Next.js application with Okta SAML 2.0 authentication.

## Setup

1. **Place `okta-metadata.xml` in project root** (download from Okta Admin → Applications → Your App → SAML Settings → Identity Provider metadata)

2. **Create `.env.local`**:
   ```bash
   SESSION_SECRET="your-random-secret-key-here"
   ```

3. **Generate SP certificates** (optional, for SP metadata):
   ```bash
   node scripts/generate-sp-cert.js
   ```

4. **Run**:
   ```bash
   npm install
   npm run dev
   ```

## Endpoints

- `/api/auth/login` - Initiate SAML login
- `/api/auth/saml/callback` - SAML response handler
- `/api/auth/logout` - Logout (SP-initiated SLO)
- `/secure` - Protected page (requires authentication)
- `/careers` - Protected page (requires authentication)

## Environment Variables

- `SESSION_SECRET` - Required. Session encryption key
- `OKTA_ENTRY_POINT` - Optional (if not using metadata file)
- `OKTA_CERT` - Optional (if not using metadata file)
- `NEXT_PUBLIC_BASE_URL` - Optional (auto-detected in development)
