"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    try {
      // Call the logout API which clears the session and redirects server-side.
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      // If fetch fails, attempt browser navigation to the logout endpoint.
      try {
        window.location.href = "/api/auth/logout";
        return;
      } catch (_) {
        // ignore
      }
    }

    // After logout API call, navigate to the public root.
    router.push("/");
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Sign out</h1>
      <p>Click the button below to sign out and clear your session.</p>
      <button
        onClick={handleLogout}
        disabled={loading}
        style={{
          padding: "10px 18px",
          borderRadius: 6,
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 600,
        }}
      >
        {loading ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
