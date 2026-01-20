import { useState, useEffect } from "preact/hooks";
import { Head } from "fresh/runtime";

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to get cookie value
  function getCookie(name: string): string | null {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(';').shift()!);
    return null;
  }

  useEffect(() => {
    // Check authentication using cookies
    const token = getCookie("auth_token");
    const email = getCookie("user_email");

    if (!token) {
      globalThis.location.href = "/login";
      return;
    }

    setUserEmail(email || "User");
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    // Clear cookies by setting them to expire
    document.cookie = 'auth_token=; Max-Age=0; Path=/';
    document.cookie = 'user_email=; Max-Age=0; Path=/';
    globalThis.location.href = "/";
  };

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Dashboard - MFA Auth</title>
        </Head>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
          <div style={{ background: "white", borderRadius: "8px", padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#6b7280" }}>Loading dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard - MFA Auth</title>
      </Head>
      <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #f3f4f6, #ffffff)" }}>
        <nav style={{ background: "white", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#1f2937", margin: 0 }}>🎯 MFA Auth</h1>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "10px 20px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Logout
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
          <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", padding: "40px", marginBottom: "30px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: "bold", color: "#1f2937", marginTop: 0, marginBottom: "10px" }}>
              Welcome to Your Dashboard
            </h2>
            <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "30px" }}>
              You have successfully logged in with secure authentication.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
              <div style={{ background: "#f0f9ff", borderRadius: "6px", padding: "20px", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>👤</div>
                <h3 style={{ fontWeight: "bold", fontSize: "14px", color: "#1f2937", margin: "0 0 8px 0" }}>
                  Account Email
                </h3>
                <p style={{ color: "#1f2937", margin: 0, wordBreak: "break-all", fontSize: "14px", fontWeight: "600" }}>
                  {userEmail}
                </p>
              </div>

              <div style={{ background: "#f0fdf4", borderRadius: "6px", padding: "20px", border: "1px solid #86efac" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>🔐</div>
                <h3 style={{ fontWeight: "bold", fontSize: "14px", color: "#1f2937", margin: "0 0 8px 0" }}>
                  Security Status
                </h3>
                <p style={{ color: "#16a34a", margin: 0, fontSize: "14px", fontWeight: "600" }}>
                  ✓ Authenticated
                </p>
              </div>

              <div style={{ background: "#fef3c7", borderRadius: "6px", padding: "20px", border: "1px solid #fcd34d" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>🛡️</div>
                <h3 style={{ fontWeight: "bold", fontSize: "14px", color: "#1f2937", margin: "0 0 8px 0" }}>
                  MFA Status
                </h3>
                <p style={{ color: "#92400e", margin: 0, fontSize: "14px", fontWeight: "600" }}>
                  ✓ Active
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", padding: "40px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "bold", color: "#1f2937", margin: "0 0 20px 0" }}>
              What's Next?
            </h3>
            <ul style={{ color: "#6b7280", lineHeight: "1.8", paddingLeft: "20px" }}>
              <li>Your account is fully protected with multi-factor authentication</li>
              <li>You can log in securely from any device using your credentials and authenticator app</li>
              <li>Keep your authenticator app backed up to avoid losing access</li>
              <li>Never share your 6-digit codes with anyone</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
