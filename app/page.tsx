import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Secure Access Platform",
  description: "Enterprise-grade secure authentication platform",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; loggedOut?: string }>;
}) {
  // Don't auto-redirect - let users see the home page and choose to login
  // Dev bypass will only work when accessing /secure directly or through login
  const devBypass = process.env.ENABLE_DEV_BYPASS === "true";

  // Await searchParams in Next.js 15+
  const params = await searchParams;
  // Don't show error if dev bypass should be enabled (even if not set correctly)
  const hasError = (params?.error === "idp_not_configured" || params?.error === "invalid_certificate") && !devBypass;
  const isCertError = params?.error === "invalid_certificate";
  const loggedOut = params?.loggedOut === "true";
  
  // CRITICAL: If loggedOut parameter is present, aggressively clear any remaining session
  if (loggedOut) {
    const { getSession } = await import("@/lib/session");
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieString = cookieStore
      .getAll()
      .map((c: any) => `${c.name}=${c.value}`)
      .join("; ");
    
    const fakeReq: any = {
      headers: {
        cookie: cookieString,
        get: (name: string) => {
          if (name.toLowerCase() === "cookie") return cookieString;
          return undefined;
        },
      },
    };
    
    const fakeRes: any = {
      headers: { 
        get: () => undefined, 
        set: () => {},
      },
      getHeader: () => undefined,
      setHeader: () => {},
    };
    
    try {
      const session = await getSession(fakeReq, fakeRes);
      if (session.user) {
        session.user = undefined;
        await session.destroy();
      }
    } catch (error) {
      // Continue even if destroy fails
    }
  }

  return (
    <>
      {/* Client-side cleanup script - clears all browser storage on logout */}
      {loggedOut && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Clear all localStorage
                  localStorage.clear();
                  // Clear all sessionStorage
                  sessionStorage.clear();
                  // Clear any cookies that might be set client-side (though server should handle this)
                  console.log('🧹 All browser storage cleared after logout');
                  
                  // Remove the loggedOut parameter from URL without reload
                  if (window.history && window.history.replaceState) {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('loggedOut');
                    window.history.replaceState({}, '', url.toString());
                  }
                } catch (e) {
                  console.error('Error clearing storage:', e);
                }
              })();
            `,
          }}
        />
      )}

      {/* NAVBAR */}
      <header style={styles.navbar}>
        <div style={styles.logo}>SecureAccess</div>
        <a href="/api/auth/login" style={styles.loginBtn}>
          Login
        </a>
      </header>


      {/* ERROR MESSAGE */}
      {hasError && (
        <div style={styles.errorBanner}>
          <div style={styles.errorContent}>
            {isCertError ? (
              <>
                <strong>❌ Invalid Certificate Configuration</strong>
                <p>
                  Your Okta certificate is invalid or incomplete. This is causing an infinite redirect loop.
                </p>
                <p style={styles.errorHint}>
                  <strong>The certificate in your .env.local is only 27 characters (just the header).</strong>
                </p>
                <p style={styles.errorHint}>
                  <strong>To fix this:</strong>
                </p>
                <ol style={styles.stepsList}>
                  <li><strong>Option 1 (EASIEST):</strong> Create <code>okta-cert.pem</code> file in project root</li>
                  <li>Copy the FULL certificate from Okta (including BEGIN/END lines, all lines)</li>
                  <li>Save it as <code>okta-cert.pem</code> (can be multiline)</li>
                  <li>Restart your dev server</li>
                </ol>
                <p style={styles.errorHint}>
                  <strong>OR</strong>
                </p>
                <ol style={styles.stepsList}>
                  <li><strong>Option 2:</strong> Fix <code>OKTA_CERT</code> in <code>.env.local</code></li>
                  <li>Use escaped newlines: <code>OKTA_CERT="-----BEGIN CERTIFICATE-----\\n[full cert]\\n-----END CERTIFICATE-----"</code></li>
                  <li>Or use base64 only: <code>OKTA_CERT="[base64 string]"</code></li>
                  <li>Restart your dev server</li>
                </ol>
              </>
            ) : (
              <>
                <strong>⚠️ Configuration Required</strong>
                <p>
                  Okta SAML is not configured. To fix this, add the following to your <code>.env.local</code> file:
                </p>
                <div style={styles.codeBlock}>
                  <code>ENABLE_DEV_BYPASS=true</code>
                </div>
                <p style={styles.errorHint}>
                  <strong>Steps:</strong>
                </p>
                <ol style={styles.stepsList}>
                  <li>Open <code>.env.local</code> in the <code>okta-saml-nextjs</code> folder</li>
                  <li>Add the line: <code>ENABLE_DEV_BYPASS=true</code> (no quotes around true)</li>
                  <li>Save the file</li>
                  <li><strong>Restart your dev server</strong> (stop with Ctrl+C, then run <code>npm run dev</code> again)</li>
                  <li>Refresh this page</li>
                </ol>
                <p style={styles.errorHint}>
                  After restarting, you'll be automatically redirected to the secure page.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>
          Secure Access for <br /> Modern Enterprises
        </h1>

        <p style={styles.heroSubtitle}>
          A scalable, enterprise-ready authentication platform built with
          modern web technologies and industry-standard identity solutions.
        </p>

        <a href="/api/auth/login" style={styles.primaryBtn}>
          Access Secure Portal
        </a>
      </section>

      {/* ABOUT SECTION */}
      <section style={styles.about}>
        <h2 style={styles.sectionTitle}>About the Platform</h2>

        <p style={styles.aboutText}>
          This platform provides a secure and reliable authentication
          architecture designed for enterprise applications. By integrating
          trusted identity providers such as Okta and leveraging SAML 2.0,
          it ensures seamless user authentication without handling passwords
          directly.
        </p>

        <p style={styles.aboutText}>
          Built with Next.js and cloud-native infrastructure, the application
          focuses on performance, scalability, and security best practices,
          making it suitable for internal tools, enterprise dashboards, and
          secure portals.
        </p>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        © 2025 SecureAccess. All rights reserved.
      </footer>
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  navbar: {
    height: 72,
    padding: "0 56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#ffffff",
  },
  logo: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
  },
  loginBtn: {
    textDecoration: "none",
    padding: "10px 22px",
    borderRadius: 6,
    border: "1px solid #2563eb",
    color: "#2563eb",
    fontWeight: 600,
  },
  hero: {
    minHeight: "calc(100vh - 72px)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "0 56px",
    background:
      "linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)",
  },
  heroTitle: {
    fontSize: 52,
    fontWeight: 800,
    maxWidth: 760,
    lineHeight: 1.15,
    color: "#111827",
  },
  heroSubtitle: {
    fontSize: 19,
    maxWidth: 640,
    marginTop: 24,
    color: "#4b5563",
  },
  primaryBtn: {
    marginTop: 36,
    width: "fit-content",
    padding: "14px 34px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 16,
  },
  about: {
    padding: "96px 56px",
    backgroundColor: "#ffffff",
    maxWidth: 900,
    margin: "0 auto",
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 700,
    marginBottom: 28,
    color: "#111827",
  },
  aboutText: {
    fontSize: 17,
    lineHeight: 1.7,
    marginBottom: 20,
    color: "#374151",
  },
  footer: {
    padding: 24,
    textAlign: "center",
    fontSize: 14,
    color: "#6b7280",
    borderTop: "1px solid #e5e7eb",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderBottom: "2px solid #ef4444",
    padding: "20px 56px",
  },
  errorContent: {
    maxWidth: 1200,
    margin: "0 auto",
    color: "#991b1b",
  },
  errorHint: {
    marginTop: 12,
    fontSize: 14,
    color: "#7f1d1d",
  },
  codeBlock: {
    backgroundColor: "#1f2937",
    color: "#10b981",
    padding: "12px 16px",
    borderRadius: 6,
    margin: "12px 0",
    fontFamily: "monospace",
    fontSize: 14,
  },
  stepsList: {
    marginTop: 12,
    paddingLeft: 24,
    color: "#7f1d1d",
    lineHeight: 1.8,
  },
};
