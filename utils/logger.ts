// Production-safe logger utility
// Only logs in development, can be configured for production with external services

const isDevelopment = Deno.env.get("DENO_ENV") !== "production";

export const logger = {
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
    // TODO: In production, send to error tracking service (Sentry, etc.)
  },
  
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log("[DEBUG]", ...args);
    }
  },
  
  // Security-related events that should always be logged
  security: (event: string, details?: Record<string, unknown>) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...details,
    };
    
    if (isDevelopment) {
      console.log("[SECURITY]", JSON.stringify(logEntry, null, 2));
    } else {
      // In production, send to security monitoring service
      console.log("[SECURITY]", JSON.stringify(logEntry));
    }
  },
};

export default logger;
