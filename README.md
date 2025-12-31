**Okta SAML Next.js — Flow Overview**

**Overview**: This Next.js app implements a simple SAML login flow that redirects users to an Okta (IdP) entry point, handles the SAML callback, creates a session, and returns users to the protected page.

**Flow**
- **Login redirect**: The app exposes `GET`/`POST` at [app/api/auth/login/route.ts](app/api/auth/login/route.ts#L1-L21). That route builds the SAML entry URL using `process.env.OKTA_ENTRY_POINT` and appends `?RelayState=/secure`, then immediately redirects the browser to the IdP.
- **IdP authentication**: The user authenticates with Okta. The IdP sends a SAML response back to the app's callback endpoint (configured in Okta).
- **SAML callback**: The callback handler is at [app/api/auth/saml/callback/route.ts](app/api/auth/saml/callback/route.ts). It parses and validates the SAML response, creates a server-side session (via [lib/session.ts](lib/session.ts)), sets appropriate cookies, and redirects to the RelayState (typically `/secure`).
- **Protected page**: The protected UI is at [app/secure/page.tsx](app/secure/page.tsx). It should only be accessible when a valid session exists.
- **Logout**: The logout route is at [app/api/auth/logout/route.ts](app/api/auth/logout/route.ts) and the logout page is at [app/logout/page.tsx](app/logout/page.tsx). The logout handler clears the session and redirects or renders a logged-out UI.

**Key files**
- `app/api/auth/login/route.ts`: redirects to IdP with `RelayState=/secure`.
- `app/api/auth/saml/callback/route.ts`: receives and validates SAMLResponse, establishes session.
- `lib/session.ts`: session creation / cookie helper used by the callback.
- `app/secure/page.tsx`: sample protected page shown after successful login.

**Environment Configuration**

You need to configure the Identity Provider (Okta) using **ONE** of the following methods:

**Option 1: Metadata XML File (Recommended)**
1. Download the metadata XML from Okta:
   - Go to Okta Admin > Applications > Your App > SAML Settings
   - Click "Identity Provider metadata" link
   - Save the XML file as `okta-metadata.xml` in the project root

**Option 2: Environment Variables**
Create a `.env.local` file in the project root with:

```bash
# Required: Okta SAML endpoint URL
OKTA_ENTRY_POINT="https://your-okta-domain.okta.com/app/your-app/sso/saml"

# Required: X.509 certificate from Okta (can include BEGIN/END lines or just base64)
OKTA_CERT="-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKL3...
-----END CERTIFICATE-----"

# Optional: Entity ID (defaults to OKTA_ENTRY_POINT if not set)
OKTA_ENTITY_ID="https://your-okta-domain.okta.com"

# Required: Session secret for cookie encryption (generate a random string)
SESSION_SECRET="your-random-secret-key-here"

# Optional: Base URL (auto-detected in development)
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

**Getting the Certificate from Okta:**
1. Go to Okta Admin > Applications > Your App > SAML Settings
2. Scroll to "SAML Signing" section
3. Copy the X.509 Certificate (it will have BEGIN/END lines)
4. Paste it as `OKTA_CERT` in your `.env.local` file

**Important Notes:**
- The certificate is required for signature verification
- Without proper configuration, you'll see `idp_not_configured` error
- For development/testing only: Set `SKIP_SIGNATURE_VERIFICATION=true` (INSECURE - do not use in production)

**Run (development)**

```bash
npm install
npm run dev
```

**Notes & reminders**
- The login route supports both `GET` and `POST` (so form POSTs will work).
- Ensure the IdP is configured to send the SAML response to your callback endpoint and that `RelayState` is supported/returned.
- If you want, I can expand this README with sequence diagrams, sample Okta settings, or the exact session cookie shape.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
