import { useState, useEffect } from "preact/hooks";

export default function MFAEnrollPage() {
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [_factorId, setFactorId] = useState("");
  const [step, setStep] = useState<"enroll" | "verify">("enroll");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    // Prefer HttpOnly cookie; fallback to localStorage for legacy
    const getCookie = (name: string): string | null => {
      const value = "; " + document.cookie;
      const parts = value.split("; " + name + "=");
      if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(";").shift()!);
      return null;
    };

    const token = getCookie("auth_token") || localStorage.getItem("access_token");
    if (!token) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/mfa/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ factorType: "totp" }),
      });

      const data = await response.json();

      if (data.error) {
        // If factor already exists, show message
        if (data.error.includes("already exists")) {
          setError("You already have MFA enabled. Navigate to verify.");
          setStep("verify");
        } else {
          setError(data.error);
        }
      } else {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch (_err) {
      setError("Failed to enroll in MFA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: Event) => {
    e.preventDefault();
    setVerifying(true);
    setError("");

    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setError("Code must be 6 digits");
      setVerifying(false);
      return;
    }

    const getCookie = (name: string): string | null => {
      const value = "; " + document.cookie;
      const parts = value.split("; " + name + "=");
      if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(";").shift()!);
      return null;
    };

    const token = getCookie("auth_token") || localStorage.getItem("access_token");
    if (!token) {
      setError("Not authenticated");
      setVerifying(false);
      return;
    }

    try {
      const response = await fetch("/api/mfa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        // Update token with new session
        if (data.session?.access_token) {
          localStorage.setItem("access_token", data.session.access_token);
        }
        // Redirect to dashboard
        setTimeout(() => {
          globalThis.location.href = "/dashboard";
        }, 1500);
      }
    } catch (_err) {
      setError("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  if (loading && step === "enroll") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
        <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "40px", maxWidth: "500px", textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "20px" }}>⏳</div>
          <p style={{ color: "#6b7280" }}>Loading MFA setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "40px", width: "100%", maxWidth: "500px" }}>
        {step === "enroll" ? (
          <>
            <h1 style={{ color: "#1f2937", marginTop: 0, marginBottom: "10px", textAlign: "center" }}>
              🔐 Enable Two-Factor Authentication
            </h1>
            <p style={{ color: "#6b7280", textAlign: "center", marginBottom: "30px" }}>
              Scan this QR code with your authenticator app
            </p>

            {error && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "20px" }}>
                {error}
              </div>
            )}

            {qrCode && (
              <>
                <div style={{ background: "#f3f4f6", padding: "20px", borderRadius: "6px", marginBottom: "20px", display: "flex", justifyContent: "center" }}>
                  <div dangerouslySetInnerHTML={{ __html: qrCode }} />
                </div>

                <div style={{ background: "#eff6ff", padding: "15px", borderRadius: "6px", marginBottom: "20px" }}>
                  <p style={{ color: "#1e40af", fontSize: "12px", margin: "0 0 10px 0", fontWeight: "bold" }}>
                    📌 Manual Entry (if QR code doesn't work):
                  </p>
                  <code
                    style={{
                      display: "block",
                      background: "white",
                      padding: "10px",
                      borderRadius: "4px",
                      fontSize: "14px",
                      wordBreak: "break-all",
                      color: "#1f2937",
                    }}
                  >
                    {secret}
                  </code>
                </div>

                <div style={{ background: "#f0fdf4", padding: "15px", borderRadius: "6px", marginBottom: "20px" }}>
                  <p style={{ color: "#166534", fontSize: "14px", margin: 0 }}>
                    ✓ After scanning with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.), click below to verify.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep("verify")}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#667eea",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  I've Scanned the Code
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <h1 style={{ color: "#1f2937", marginTop: 0, marginBottom: "10px", textAlign: "center" }}>
              ✓ Verify Your Code
            </h1>
            <p style={{ color: "#6b7280", textAlign: "center", marginBottom: "30px" }}>
              Enter the 6-digit code from your authenticator
            </p>

            {error && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "20px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleVerify}>
              <div style={{ marginBottom: "20px" }}>
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onInput={(e) => setCode((e.target as HTMLInputElement).value)}
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
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: verifying || code.length !== 6 ? "#9ca3af" : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: verifying || code.length !== 6 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                {verifying ? "Verifying..." : "Verify & Enable MFA"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setStep("enroll");
                setCode("");
                setError("");
              }}
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
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
