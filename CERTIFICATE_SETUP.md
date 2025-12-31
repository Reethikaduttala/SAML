# Certificate Setup Instructions

## Problem
Your OKTA_CERT in .env.local is only 27 characters (just the BEGIN line).
A valid certificate should be 1000+ characters.

## Solution: Create okta-cert.pem file

1. **Get your certificate from Okta:**
   - Go to: Okta Admin → Applications → Your App → SAML Settings
   - Click "View Certificate" or download the certificate
   - Copy the FULL certificate (including BEGIN and END lines)

2. **Create the file:**
   ```bash
   # In the okta-saml-nextjs folder, create okta-cert.pem
   nano okta-cert.pem
   # or use any text editor
   ```

3. **Paste the certificate:**
   ```
   -----BEGIN CERTIFICATE-----
   MIIDXTCCAkWgAwIBAgIJAKL3... [your full certificate here, 1000+ chars]
   -----END CERTIFICATE-----
   ```

4. **Save the file** in the `okta-saml-nextjs` folder (same level as package.json)

5. **Restart your Next.js server**

## Alternative: Use Metadata XML (EASIEST)

1. Go to: Okta Admin → Applications → Your App → SAML Settings
2. Click "Identity Provider metadata" link
3. Download the XML file
4. Save it as `okta-metadata.xml` in the `okta-saml-nextjs` folder
5. Restart your server

The metadata file contains everything automatically!
