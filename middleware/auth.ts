export function handler(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/api/mfa"];

  const url = new URL(req.url);
  const isProtectedRoute = protectedRoutes.some((route) =>
    url.pathname.startsWith(route)
  );

  if (isProtectedRoute && !token) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
  }

  // Return modified request or continue
  return req;
}