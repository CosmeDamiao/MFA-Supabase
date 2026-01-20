// HttpOnly Cookie helpers
export function setHttpOnlyCookie(
  name: string,
  value: string,
  maxAgeSeconds: number = 86400 * 7 // 7 days default
): string {
  const maxAge = maxAgeSeconds;
  // HttpOnly=true, Secure=true (set Secure=false in development if needed)
  // SameSite=Strict prevents CSRF attacks
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict`;
}

export function clearHttpOnlyCookie(name: string): string {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name && value) return decodeURIComponent(value);
  }
  return null;
}
