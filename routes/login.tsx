import { useState } from "preact/hooks";
import { Head } from "fresh/runtime";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa" | "enroll">("credentials");
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [_userHasMFA, _setUserHasMFA] = useState(false);

  const handleSignIn = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Store token + email for client usage even though cookies are set server-side
        if (data.session?.access_token) {
          localStorage.setItem("access_token", data.session.access_token);
        }
        if (data.user?.email) {
          localStorage.setItem("user_email", data.user.email);
        }
        setUser(data.user);

        // Check if user has MFA factors
        try {
          const listResponse = await fetch("/api/auth/list-factors", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
            credentials: "include",
          });

          const listData = await listResponse.json();

          if (listData.factors && listData.factors.length > 0) {
            // User has MFA setup
            _setUserHasMFA(true);
            setStep("mfa");
          } else {
            // User doesn't have MFA, redirect to enrollment
            setStep("enroll");
          }
        } catch (_err) {
          // If endpoint doesn't exist, assume MFA might be set up
          _setUserHasMFA(true);
          setStep("mfa");
        }
      }
    } catch (_err) {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerify = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mfaCode.length !== 6 || !/^\d+$/.test(mfaCode)) {
      setError("Code must be 6 digits");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("access_token");

    try {
      const response = await fetch("/api/mfa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: mfaCode }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Update token with verified session
        if (data.session?.access_token) {
          localStorage.setItem("access_token", data.session.access_token);
        }
        // Redirect to dashboard
        setTimeout(() => {
          globalThis.location.href = "/dashboard";
        }, 500);
      }
    } catch (_err) {
      setError("MFA verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipMFA = () => {
    // Clear temporary token and go back to login
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_email");
    setStep("credentials");
    setEmail("");
    setPassword("");
    setMfaCode("");
    setError("");
    setUser(null);
  };

  // Enrollment step - redirect to enrollment page
  if (step === "enroll") {
    return (
      <>
        <Head>
          <title>Login - MFA Auth</title>
        </Head>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
          <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "40px", width: "100%", maxWidth: "400px" }}>
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <div style={{ fontSize: "48px", marginBottom: "10px" }}>🎉</div>
              <h2 style={{ color: "#1f2937", margin: "0" }}>Welcome, {user?.email}!</h2>
              <p style={{ color: "#6b7280", marginBottom: 0 }}>Let's set up two-factor authentication</p>
            </div>

            <p style={{ color: "#374151", marginBottom: "20px" }}>
              To enhance your account security, we recommend setting up two-factor authentication. You can set it up now or skip it for later.
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("_mfa_pending", "true");
                  globalThis.location.href = "/mfa/enroll";
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Set Up MFA
              </button>

              <button
                type="button"
                onClick={() => {
                  globalThis.location.href = "/dashboard";
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (step === "mfa") {
    return (
      <>
        <Head>
          <title>Login - MFA Auth</title>
        </Head>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
          <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "40px", width: "100%", maxWidth: "400px" }}>
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <div style={{ fontSize: "48px", marginBottom: "10px" }}>🔐</div>
              <h2 style={{ color: "#1f2937", margin: "0" }}>Two-Factor Authentication</h2>
              <p style={{ color: "#6b7280", marginBottom: 0 }}>{user?.email}</p>
            </div>

            {error && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "20px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleMFAVerify}>
              <p style={{ color: "#374151", marginBottom: "10px", fontWeight: "bold" }}>
                Enter the 6-digit code from your authenticator app:
              </p>
              <input
                type="text"
                maxLength={6}
                value={mfaCode}
                onInput={(e) => setMfaCode((e.target as HTMLInputElement).value)}
                placeholder="000000"
                inputMode="numeric"
                style={{
                  width: "100%",
                  padding: "15px",
                  border: "2px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "24px",
                  textAlign: "center",
                  letterSpacing: "10px",
                  fontWeight: "bold",
                  boxSizing: "border-box",
                  marginBottom: "20px",
                }}
              />

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: loading || mfaCode.length !== 6 ? "#9ca3af" : "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: loading || mfaCode.length !== 6 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleSkipMFA}
              style={{
                width: "100%",
                padding: "10px",
                background: "transparent",
                color: "#667eea",
                border: "1px solid #667eea",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "14px",
                marginTop: "10px",
              }}
            >
              Use Different Account
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Login - MFA Auth</title>
      </Head>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
        <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "40px", width: "100%", maxWidth: "400px" }}>
          <h1 style={{ color: "#1f2937", marginTop: 0, marginBottom: "30px", textAlign: "center" }}>Welcome Back</h1>

          {error && (
            <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#374151", fontWeight: "bold", marginBottom: "5px" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="your@email.com"
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#374151", fontWeight: "bold", marginBottom: "5px" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                  fontSize: "14px",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: loading ? "#9ca3af" : "#667eea",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", color: "#6b7280", marginTop: "20px", marginBottom: 0 }}>
            Don't have an account?{" "}
            <a href="/signup" style={{ color: "#667eea", textDecoration: "none", fontWeight: "bold" }}>
              Sign Up
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
