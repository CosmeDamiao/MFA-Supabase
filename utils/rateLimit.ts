// Simple in-memory rate limiter (use Redis in production)
interface RateLimitStore {
  [key: string]: { attempts: number; resetTime: number };
}

const store: RateLimitStore = {};

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000 // 1 minute default
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const existing = store[key];

  if (!existing || now > existing.resetTime) {
    store[key] = { attempts: 1, resetTime: now + windowMs };
    return { allowed: true, remaining: maxAttempts - 1, resetTime: now + windowMs };
  }

  if (existing.attempts >= maxAttempts) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime };
  }

  existing.attempts += 1;
  return {
    allowed: true,
    remaining: maxAttempts - existing.attempts,
    resetTime: existing.resetTime,
  };
}

export function getRateLimitHeaders(
  result: ReturnType<typeof checkRateLimit>
): Record<string, string> {
  const resetSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
  return {
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.max(0, resetSeconds)),
  };
}
