import { useState } from "preact/hooks";
import { Head } from "fresh/runtime";
import { MFAVerify } from "../../components/MFAVerify.tsx";

export default function MFAVerifyPage() {
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Get parameters from URL
  const params = new URLSearchParams(globalThis.location?.search || "");
  const _challengeId = params.get("challengeId") || "";
  const _factorId = params.get("factorId") || "";

  // Helper function to get cookie value
  function getCookie(name: string): string | null {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(';').shift()!);
    return null;
  }

  const handleMFAVerify = async (code: string) => {
    setIsLoading(true);
    setError("");
    try {
      // Prefer HttpOnly cookie, fallback to localStorage; header optional
      let token = getCookie("auth_token");
      if (!token) token = localStorage.getItem("access_token") || null;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/mfa/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ code }),
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        // Update localStorage with new token if provided
        if (data.session?.access_token) {
          localStorage.setItem("access_token", data.session.access_token);
        }
        // Cookies are set by server, just redirect
        globalThis.location.href = "/dashboard";
      } else {
        if (response.status === 401) {
          setError(data.error || "Session missing or expired. Please sign in again.");
        } else {
          setError(data.error);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>MFA Verification - MFA Auth</title>
      </Head>
      <MFAVerify
        onSubmit={handleMFAVerify}
        isLoading={isLoading}
        error={error}
      />
    </>
  );
}
