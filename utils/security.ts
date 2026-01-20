// Security headers for production
// Add these headers to all HTTP responses

const isProduction = Deno.env.get("DENO_ENV") === "production";

export function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    // Prevent clickjacking attacks
    "X-Frame-Options": "DENY",
    
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Enable XSS protection (legacy browsers)
    "X-XSS-Protection": "1; mode=block",
    
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Restrict feature/API access
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };

  // In production, add stricter CSP
  if (isProduction) {
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // TODO: Remove unsafe-inline and use nonces
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    
    // Enable HSTS in production
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}

export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  const securityHeaders = getSecurityHeaders();
  
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
