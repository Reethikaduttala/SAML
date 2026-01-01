import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CareersPage() {
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
    redirect("/api/auth/login?redirect=/careers");
  }
  
  // Valid session exists - use it
  const user = session.user;

  return (
    <>
      {/* NAVBAR */}
      <header style={styles.navbar}>
        <div style={styles.logo}>Careers Portal</div>
        <form action="/api/auth/logout" method="POST" style={{ display: "inline" }}>
          <button type="submit" style={styles.logoutBtn}>
            Logout
          </button>
        </form>
      </header>

      {/* HERO / MAIN SECTION */}
      <section style={styles.hero}>
        <h1 style={styles.title}>
          Explore Career Opportunities
        </h1>

        <p style={styles.subtitle}>
          Discover exciting career opportunities and join our team. 
          Browse open positions, learn about our culture, and find the perfect role for you.
        </p>

        {/* User Info Card */}
        <div style={styles.userCard}>
          <h2 style={styles.userCardTitle}>Welcome, {user.firstName || user.email || 'User'}!</h2>
          <p style={styles.userInfoText}>
            You're viewing this page as an authenticated user. Browse available positions below.
          </p>
        </div>

        <div style={styles.cardGrid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Software Engineer</h3>
            <p style={styles.cardLocation}>San Francisco, CA • Remote</p>
            <p style={styles.cardText}>
              Join our engineering team to build innovative solutions and work with cutting-edge technology.
            </p>
            <button style={styles.applyBtn}>Apply Now</button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Product Manager</h3>
            <p style={styles.cardLocation}>New York, NY • Hybrid</p>
            <p style={styles.cardText}>
              Lead product strategy and work closely with cross-functional teams to deliver exceptional products.
            </p>
            <button style={styles.applyBtn}>Apply Now</button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>UX Designer</h3>
            <p style={styles.cardLocation}>Austin, TX • Remote</p>
            <p style={styles.cardText}>
              Create beautiful and intuitive user experiences that delight our customers.
            </p>
            <button style={styles.applyBtn}>Apply Now</button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Data Scientist</h3>
            <p style={styles.cardLocation}>Seattle, WA • Hybrid</p>
            <p style={styles.cardText}>
              Analyze complex data sets and build machine learning models to drive business insights.
            </p>
            <button style={styles.applyBtn}>Apply Now</button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>DevOps Engineer</h3>
            <p style={styles.cardLocation}>Remote • Full-time</p>
            <p style={styles.cardText}>
              Manage infrastructure, automate deployments, and ensure system reliability at scale.
            </p>
            <button style={styles.applyBtn}>Apply Now</button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Marketing Manager</h3>
            <p style={styles.cardLocation}>Los Angeles, CA • Hybrid</p>
            <p style={styles.cardText}>
              Develop and execute marketing strategies to grow our brand and reach new audiences.
            </p>
            <button style={styles.applyBtn}>Apply Now</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        © 2025 Careers Portal. All rights reserved.
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
    marginBottom: 12,
  },
  userInfoText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 1.6,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 32,
  },
  card: {
    padding: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 8,
  },
  cardLocation: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    fontWeight: 500,
  },
  cardText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 1.6,
    marginBottom: 24,
    flexGrow: 1,
  },
  applyBtn: {
    padding: "12px 24px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
    fontFamily: "inherit",
    transition: "background-color 0.2s",
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

