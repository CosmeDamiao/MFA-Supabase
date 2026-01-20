// Global configuration for the MFA application

export const APP_CONFIG = {
  name: "MFA Auth",
  version: "1.0.0",
  description: "Multi-Factor Authentication with Supabase, Deno, Fresh, and Vite",
  
  // API Configuration
  api: {
    baseUrl: Deno.env.get("DENO_ENV") === "production" 
      ? "https://api.example.com" 
      : "http://localhost:8000",
    timeout: 10000,
  },

  // Authentication
  auth: {
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    mfaTimeout: 10 * 60 * 1000, // 10 minutes
    tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  },

  // MFA Configuration
  mfa: {
    totpWindow: 30, // seconds
    backupCodesCount: 10,
    enableTotp: true,
    enableSms: false, // Can be enabled later
  },

  // UI Configuration
  ui: {
    theme: "light",
    animationsEnabled: true,
  },
};

export const ROUTES = {
  public: ["/", "/login", "/signup"],
  protected: ["/dashboard", "/settings"],
  api: {
    auth: "/api/auth",
    mfa: "/api/mfa",
  },
};
