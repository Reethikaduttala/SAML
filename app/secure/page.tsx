import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SecurePage() {
  // Build cookie string from Next.js cookies() for iron-session adapter
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
      set: (name: string, value: string) => {
        if (!fakeRes._headers) fakeRes._headers = {};
        fakeRes._headers[name] = value;
      }
    },
    getHeader: () => undefined,
    setHeader: (name: string, value: string) => {
      if (!fakeRes._headers) fakeRes._headers = {};
      fakeRes._headers[name] = value;
    },
  };

  // Check for valid session - ALWAYS require authentication
  const session = await getSession(fakeReq, fakeRes);
  
  // STRICT validation: session.user must exist AND have nameID
  // This ensures ONLY users authenticated through Okta can access this page
  const hasValidUser = session.user && 
                       session.user.nameID && 
                       typeof session.user.nameID === 'string' &&
                       session.user.nameID.trim().length > 0;
  
  if (!hasValidUser) {
    // Force redirect to login - this will redirect to Okta
    redirect("/api/auth/login?redirect=/secure");
  }
  
  // Valid session exists - use it
  const user = session.user;

  return (
    <>
      {/* NAVBAR */}
      <header style={styles.navbar}>
        <div style={styles.logo}>SecureAccess</div>
        <form action="/api/auth/logout" method="POST" style={{ display: "inline" }}>
          <button type="submit" style={styles.logoutBtn}>
            Logout
          </button>
        </form>
      </header>

      {/* HERO / MAIN SECTION */}
      <section style={styles.hero}>
        <h1 style={styles.title}>
          Welcome to the Secure Portal
        </h1>

        <p style={styles.subtitle}>
          This is a protected-style interface designed for enterprise users.
          Once authenticated, users can access dashboards, internal tools,
          and confidential resources from this portal.
        </p>

        {/* User Info Card */}
        <div style={styles.userCard}>
          <h2 style={styles.userCardTitle}>User Information</h2>
          <div style={styles.userInfo}>
            {user.email && (
              <p style={styles.userInfoItem}>
                <strong>Email:</strong> {user.email}
              </p>
            )}
            {(user.firstName || user.lastName) && (
              <p style={styles.userInfoItem}>
                <strong>Name:</strong> {[user.firstName, user.lastName].filter(Boolean).join(" ") || "N/A"}
              </p>
            )}
            {user.nameID && (
              <p style={styles.userInfoItem}>
                <strong>User ID:</strong> {user.nameID}
              </p>
            )}
          </div>
        </div>

        <div style={styles.cardGrid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>User Dashboard</h3>
            <p style={styles.cardText}>
              View your activity, profile information, and usage insights
              in a centralized dashboard.
            </p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Access Management</h3>
            <p style={styles.cardText}>
              Manage permissions, roles, and security policies
              for enterprise applications.
            </p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Audit & Logs</h3>
            <p style={styles.cardText}>
              Monitor authentication events and security logs
              to ensure compliance and traceability.
            </p>
          </div>
        </div>
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
  logoutBtn: {
    textDecoration: "none",
    padding: "10px 22px",
    borderRadius: 6,
    border: "1px solid #ef4444",
    color: "#ef4444",
    fontWeight: 600,
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: "inherit",
    fontFamily: "inherit",
  },
  hero: {
    minHeight: "calc(100vh - 72px)",
    padding: "80px 56px",
    background:
      "linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)",
  },
  title: {
    fontSize: 44,
    fontWeight: 800,
    color: "#111827",
    maxWidth: 800,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: "#4b5563",
    maxWidth: 760,
    lineHeight: 1.6,
    marginBottom: 56,
  },
  userCard: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    marginBottom: 56,
    maxWidth: 600,
  },
  userCardTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 20,
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  userInfoItem: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 1.6,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 32,
  },
  card: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 1.6,
  },
  footer: {
    padding: 24,
    textAlign: "center",
    fontSize: 14,
    color: "#6b7280",
    borderTop: "1px solid #e5e7eb",
    backgroundColor: "#ffffff",
  },
};
