interface User {
  id: string;
  email: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  mfaRequired: boolean;
  mfaFactors: Array<{ id: string; type: string }>;
}

export function createAuthContext(): AuthContextType {
  return {
    user: null,
    loading: true,
    error: null,
    mfaRequired: false,
    mfaFactors: [],
  };
}

export async function signUp(email: string, password: string) {
  try {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(`Sign up failed: ${error}`);
  }
}

export async function signIn(email: string, password: string) {
  try {
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(`Sign in failed: ${error}`);
  }
}

export async function verifyMFA(code: string, challengeId: string) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Not authenticated");

    const response = await fetch("/api/mfa/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, challengeId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(`MFA verification failed: ${error}`);
  }
}

export async function enrollMFA(factorType: string) {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Not authenticated");

    const response = await fetch("/api/mfa/enroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ factorType }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(`MFA enrollment failed: ${error}`);
  }
}
