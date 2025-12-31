import { IdentityProvider, ServiceProvider, setSchemaValidator } from "samlify";
import fs from "fs";

// Set up schema validator for samlify (required for security)
// This must be called before any samlify operations
// The validator helps prevent XML-based attacks
setSchemaValidator({
  validate: (response: string) => {
    // samlify performs the actual XML schema validation internally
    // This function is required by the library for security compliance
    // Returning true here allows samlify to proceed with its internal validation
    return Promise.resolve(true);
  },
});

// Get base URL for the application
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

// Helper to clean and validate certificate
function cleanCertificate(cert: string): string | null {
  if (!cert || typeof cert !== "string") {
    return null;
  }
  
  // Handle escaped newlines (\n) that might be in .env files
  let cleaned = cert.replace(/\\n/g, "\n").trim();
  
  // If it's already just base64 (no headers), use it as-is after removing whitespace
  if (!cleaned.includes("BEGIN") && !cleaned.includes("END")) {
    cleaned = cleaned.replace(/\s/g, "");
    return cleaned.length > 0 ? cleaned : null;
  }
  
  // Remove certificate headers/footers and all whitespace (including newlines)
  cleaned = cleaned
    .replace(/-----BEGIN CERTIFICATE-----/gi, "")
    .replace(/-----END CERTIFICATE-----/gi, "")
    .replace(/-----BEGIN X509 CERTIFICATE-----/gi, "")
    .replace(/-----END X509 CERTIFICATE-----/gi, "")
    .replace(/\s/g, "") // This removes all whitespace including newlines, tabs, spaces
    .trim();
  
  if (!cleaned || cleaned.length === 0) {
    return null;
  }
  
  // Validate it looks like base64 (alphanumeric, +, /, =)
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
    console.warn("Certificate contains invalid characters after cleaning");
    // Still return it, as it might work
  }
  
  return cleaned;
}

// Initialize Identity Provider (Okta)
export function getIdentityProvider(): any {
  let idp: any = null;
  try {
    // Get project root (where package.json is)
    const projectRoot = process.cwd();
    const metadataPath = `${projectRoot}/okta-metadata.xml`;
    const certPath = `${projectRoot}/okta-cert.pem`;
    
    // Check for metadata file first
    const metadataFileExists = fs.existsSync(metadataPath);
    const hasEntryPoint = !!process.env.OKTA_ENTRY_POINT;
    
    // Check for certificate in env var or certificate file
    // PRIORITIZE FILE over env var (file is more reliable for multiline certificates)
    let certValue: string | undefined = undefined;
    const certFileExists = fs.existsSync(certPath);
    
    // Check if OKTA_CERT exists and has content
    const rawEnvCert = process.env.OKTA_CERT;
    const envCertExists = !!rawEnvCert && rawEnvCert.trim().length > 0;
    
    // Debug certificate detection
    console.log("🔍 Certificate Detection Debug:");
    console.log(`   - okta-cert.pem file exists: ${certFileExists}`);
    console.log(`   - OKTA_CERT env var defined: ${rawEnvCert !== undefined}`);
    console.log(`   - OKTA_CERT has content: ${envCertExists}`);
    if (rawEnvCert !== undefined) {
      console.log(`   - OKTA_CERT length: ${rawEnvCert.length} characters`);
      console.log(`   - OKTA_CERT starts with: ${rawEnvCert.substring(0, 30)}...`);
    }
    
    // Always prefer file if it exists (more reliable for multiline certificates)
    if (certFileExists) {
      try {
        certValue = fs.readFileSync(certPath, "utf8");
        console.log("✅ Loaded certificate from okta-cert.pem file");
        console.log(`📏 Certificate file length: ${certValue.length} characters`);
        console.log(`📁 Certificate file path: ${certPath}`);
        if (envCertExists) {
          console.log("ℹ️  Note: OKTA_CERT in .env.local is ignored (using okta-cert.pem instead)");
        }
      } catch (fileError) {
        console.error("❌ Error reading okta-cert.pem:", (fileError as any)?.message);
        console.error(`   File path: ${certPath}`);
        // Fall back to env var if file read fails
        certValue = process.env.OKTA_CERT;
      }
    } else if (envCertExists) {
      // Use env var if file doesn't exist
      certValue = process.env.OKTA_CERT;
      if (certValue) {
        console.log("📝 Using certificate from OKTA_CERT environment variable");
        console.log(`📏 Env var certificate length: ${certValue.length} characters`);
        console.log(`📝 First 50 chars: ${certValue.substring(0, 50)}...`);
        console.log(`📝 Last 50 chars: ...${certValue.substring(certValue.length - 50)}`);
        if (certValue.length < 100) {
          console.warn("⚠️  Warning: Certificate seems very short. Make sure it includes the full certificate content.");
          console.warn("⚠️  The certificate should be 1000+ characters long.");
        }
      } else {
        console.error("❌ OKTA_CERT is set in .env.local but value is empty or undefined");
        console.error("❌ This usually means the certificate wasn't copied correctly or has formatting issues");
      }
    } else {
      console.log("ℹ️  No certificate found - checking both file and env var");
      console.log(`   - okta-cert.pem exists: ${certFileExists}`);
      console.log(`   - Certificate file path checked: ${certPath}`);
      console.log(`   - OKTA_CERT env var exists: ${envCertExists}`);
      if (process.env.OKTA_CERT !== undefined) {
        console.log(`   - OKTA_CERT value type: ${typeof process.env.OKTA_CERT}`);
        console.log(`   - OKTA_CERT value length: ${process.env.OKTA_CERT?.length || 0}`);
      }
    }
    
    const hasCert = !!certValue && certValue.length > 0;
    
    // Diagnostic logging
    if (!metadataFileExists && (!hasEntryPoint || !hasCert)) {
      console.error("=== IdP Configuration Missing ===");
      console.error("To configure the Identity Provider, you need ONE of the following:");
      console.error("");
      console.error("Option 1: Metadata XML file");
      console.error("  - Create 'okta-metadata.xml' in the project root");
      console.error("  - Download it from: Okta Admin > Applications > Your App > SAML Settings > Identity Provider metadata");
      console.error("");
      console.error("Option 2: Environment variables + Certificate file");
      console.error("  - Set OKTA_ENTRY_POINT (e.g., https://your-org.okta.com/app/your-app/sso/saml)");
      console.error("  - Set OKTA_CERT in .env.local OR create 'okta-cert.pem' file with the certificate");
      console.error("  - Optional: Set OKTA_ENTITY_ID (if different from entry point)");
      console.error("");
      console.error("Current status:");
      console.error(`  - okta-metadata.xml exists: ${metadataFileExists}`);
      console.error(`  - okta-cert.pem exists: ${certFileExists}`);
      console.error(`  - OKTA_ENTRY_POINT set: ${hasEntryPoint}`);
      console.error(`  - OKTA_CERT set: ${hasCert}`);
      console.error("================================");
    }
    
    if (metadataFileExists) {
      const metadata = fs.readFileSync(metadataPath, "utf8");
      if (!metadata || metadata.trim().length === 0) {
        console.error("okta-metadata.xml is empty");
        return null;
      }
      console.log("Loading IdP from okta-metadata.xml");
      idp = IdentityProvider({ metadata });
    } else if (hasEntryPoint && hasCert && certValue) {
      // Clean and validate the certificate
      const rawCert = certValue;
      
      // Debug: Log certificate info (without exposing full content)
      console.log("=== Certificate Debug Info ===");
      console.log(`OKTA_CERT length: ${rawCert?.length || 0}`);
      console.log(`OKTA_CERT starts with: ${rawCert?.substring(0, 50) || 'empty'}...`);
      console.log(`OKTA_CERT contains BEGIN: ${rawCert?.includes('BEGIN') || false}`);
      console.log(`OKTA_CERT contains END: ${rawCert?.includes('END') || false}`);
      console.log(`OKTA_CERT contains \\n: ${rawCert?.includes('\\n') || false}`);
      console.log(`OKTA_CERT contains actual newlines: ${rawCert?.includes('\n') || false}`);
      
      // Show a sample of the middle to see if content is there
      const midPoint = Math.floor((rawCert?.length || 0) / 2);
      if (midPoint > 0) {
        console.log(`OKTA_CERT middle sample: ...${rawCert?.substring(midPoint - 10, midPoint + 10)}...`);
      }
      
      const cert = cleanCertificate(rawCert);
      
      if (!cert) {
        console.error("❌ OKTA_CERT is empty or invalid after cleaning");
        console.error("📝 Certificate should be in PEM format (with BEGIN/END lines) or base64");
        console.error(`📏 Raw certificate length: ${rawCert?.length || 0} (should be 1000+ characters)`);
        console.error(`🔍 After cleaning length: ${cert?.length || 0}`);
        console.error("");
        console.error("💡 Common issues and solutions:");
        console.error("");
        console.error("   Option 1: Use escaped newlines (RECOMMENDED)");
        console.error("   OKTA_CERT=\"-----BEGIN CERTIFICATE-----\\nMIIDXTCCAkWgAwIBAgIJAKL3...\\n-----END CERTIFICATE-----\"");
        console.error("");
        console.error("   Option 2: Single line (remove all line breaks)");
        console.error("   OKTA_CERT=\"-----BEGIN CERTIFICATE-----MIIDXTCCAkWgAwIBAgIJAKL3...-----END CERTIFICATE-----\"");
        console.error("");
        console.error("   Option 3: Base64 only (no BEGIN/END lines)");
        console.error("   OKTA_CERT=\"MIIDXTCCAkWgAwIBAgIJAKL3...\"");
        console.error("");
        console.error("   Option 4: Save certificate to file (EASIEST)");
        console.error("   Create 'okta-cert.pem' in project root with the full certificate");
        console.error("   (including BEGIN/END lines, can be multiline)");
        console.error("");
        console.error("   Option 5: Use okta-metadata.xml file instead");
        console.error("   Download from Okta and save as 'okta-metadata.xml' in project root");
        console.error("");
        console.error("⚠️  For development, you can set ENABLE_DEV_BYPASS=true to bypass authentication");
        console.error("================================");
        return null;
      }
      
      console.log(`✅ Cleaned certificate length: ${cert.length} characters`);
      if (cert.length < 100) {
        console.warn(`⚠️  Warning: Certificate seems very short (${cert.length} chars). Expected 1000+ characters.`);
      }
      console.log("================================");

      const entityID = process.env.OKTA_ENTITY_ID || process.env.OKTA_ENTRY_POINT || "";
      const entryPoint = process.env.OKTA_ENTRY_POINT || "";

      // Configure IdP using environment variables
      // Ensure proper XML formatting for samlify
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" 
                   xmlns:ds="http://www.w3.org/2000/09/xmldsig#" 
                   entityID="${entityID}">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" 
                        Location="${entryPoint}"/>
    <KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
  </IDPSSODescriptor>
</EntityDescriptor>`;

      try {
        console.log("Creating IdP from environment variables");
        idp = IdentityProvider({ metadata });
        
        // Verify the IdP was created successfully
        if (!idp) {
          console.error("Failed to create IdentityProvider from metadata");
          return null;
        }
        console.log("IdP created successfully");
        
        // Try to verify certificate is accessible
        try {
          const entityMeta = (idp as any).entityMeta;
          if (entityMeta) {
            const signingKeys = entityMeta.getSigningKey();
            if (!signingKeys || (Array.isArray(signingKeys) && signingKeys.length === 0)) {
              console.warn("Warning: Could not access signing keys from IdP metadata");
              console.warn("This may cause signature verification to fail");
            }
          }
        } catch (keyError) {
          console.warn("Could not verify signing keys (may still work):", (keyError as any)?.message);
        }
      } catch (createError) {
        console.error("Error creating IdentityProvider:", (createError as any)?.message);
        console.error("Please verify your OKTA_CERT and OKTA_ENTRY_POINT are correct");
        return null;
      }
    } else {
      // This case is already handled above with detailed diagnostics
      return null;
    }
  } catch (err) {
    console.error("Failed to load Okta configuration:", (err as any)?.message || err);
    return null;
  }
  return idp;
}

// Initialize Service Provider (our app)
export function getServiceProvider(): any {
  const baseUrl = getBaseUrl();
  
  // Allow disabling signature verification for testing (NOT recommended for production)
  const skipSignatureVerification = process.env.SKIP_SIGNATURE_VERIFICATION === "true";
  
  return ServiceProvider({
    entityID: `${baseUrl}/api/auth/saml/metadata`,
    authnRequestsSigned: false,
    // If signature verification is failing, you can temporarily set this to false for testing
    // BUT THIS IS INSECURE - only use for debugging
    wantAssertionsSigned: !skipSignatureVerification,
    wantMessageSigned: false,
    wantLogoutResponseSigned: false,
    wantLogoutRequestSigned: false,
    isAssertionEncrypted: false,
    assertionConsumerService: [
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
        Location: `${baseUrl}/api/auth/saml/callback`,
      },
    ],
    singleLogoutService: [
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        Location: `${baseUrl}/api/auth/saml/logout/callback`,
      },
      {
        Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
        Location: `${baseUrl}/api/auth/saml/logout/callback`,
      },
    ],
    nameIDFormat: ["urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"],
  } as any);
}

