import { useState } from "preact/hooks";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          globalThis.location.href = "/login";
        }, 2000);
      }
    } catch (_err) {
      setError("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
        <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "40px", maxWidth: "400px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>✅</div>
          <h2 style={{ color: "#1f2937", margin: "0 0 20px 0" }}>Account Created!</h2>
          <p style={{ color: "#6b7280", marginBottom: "20px" }}>Your account has been created successfully. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "40px", width: "100%", maxWidth: "400px" }}>
        <h1 style={{ color: "#1f2937", marginTop: 0, marginBottom: "30px", textAlign: "center" }}>Create Account</h1>

        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp}>
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

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", color: "#374151", fontWeight: "bold", marginBottom: "5px" }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
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
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "#6b7280", marginTop: "20px", marginBottom: 0 }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#667eea", textDecoration: "none", fontWeight: "bold" }}>
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}
