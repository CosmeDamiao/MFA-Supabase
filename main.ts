// Load environment variables
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
await load({ export: true });

// Supabase clients (service + anon + user-scoped)
import {
  supabaseService,
  supabaseAnon,
  createUserClient,
} from "./utils/supabase.ts";

// Security utilities
import { checkRateLimit, getRateLimitHeaders } from "./utils/rateLimit.ts";
import { setHttpOnlyCookie } from "./utils/cookies.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8000");

// Helper function to refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    if (!refreshToken) {
      console.warn('⚠️  Refresh token is empty or invalid');
      return null;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // Try SUPABASE_ANON_KEY first, then fall back to SUPABASE_KEY for compatibility
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_KEY');
    
    if (!supabaseUrl || !anonKey) {
      console.error('❌ Missing SUPABASE_URL or anon key (tried SUPABASE_ANON_KEY and SUPABASE_KEY)');
      return null;
    }

    const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
    console.log(`🔄 Refreshing token from: ${url}`);
    console.log(`   Refresh token length: ${refreshToken.length} chars`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`❌ Token refresh failed with status ${response.status}`);
      console.error(`   Response: ${responseText.substring(0, 200)}`);
      return null;
    }

    const data = JSON.parse(responseText);
    if (!data.access_token) {
      console.error('❌ Token refresh returned no access_token');
      console.error(`   Response keys: ${Object.keys(data).join(', ')}`);
      return null;
    }

    console.log('✅ Token refreshed successfully');
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Use new refresh_token if provided, otherwise keep old one
    };
  } catch (error) {
    console.error('❌ Token refresh error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// API Handlers
async function handleSignIn(req: Request): Promise<Response> {
  try {
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `signin:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60000);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many login attempts. Try again later." }),
        { status: 429, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 400, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    // Check MFA enrollment status from database
    let hasMFA = false;
    try {
      const { data: mfaStatus, error: dbError } = await supabaseService
        .from('user_mfa_status')
        .select('mfa_enrolled')
        .eq('user_id', data.user.id)
        .single();

      if (dbError && dbError.code !== 'PGRST116') {
        console.error("Error checking MFA status:", dbError);
      } else {
        hasMFA = mfaStatus?.mfa_enrolled || false;
      }
    } catch (err) {
      console.error("MFA detection error:", err);
    }

    // Set HttpOnly cookie with access token (expires in 7 days)
    const cookieHeader = setHttpOnlyCookie("auth_token", data.session.access_token, 604800);
    // Store refresh token in a separate HttpOnly cookie for token refresh
    const refreshCookieHeader = data.session.refresh_token ? 
      setHttpOnlyCookie("refresh_token", data.session.refresh_token, 604800) : null;
    // Also set non-HttpOnly cookie with user email for frontend to read
    const userCookieHeader = `user_email=${encodeURIComponent(data.user?.email || '')}; Max-Age=604800; Path=/; SameSite=Strict`;

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...getRateLimitHeaders(rateLimit),
    });
    responseHeaders.append("Set-Cookie", cookieHeader);
    if (refreshCookieHeader) {
      responseHeaders.append("Set-Cookie", refreshCookieHeader);
    }
    responseHeaders.append("Set-Cookie", userCookieHeader);
    
    // Log successful sign in with refresh token info
    if (data.session?.refresh_token) {
      console.log('✓ Sign in successful with refresh token for:', data.user.email);
    } else {
      console.log('⚠️  Sign in successful but no refresh token provided by Supabase for:', data.user.email);
    }

    return new Response(
      JSON.stringify({
        user: { id: data.user.id, email: data.user.email },
        hasMFA: hasMFA,
        message: "Sign in successful",
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error("Sign in error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleSignUp(req: Request): Promise<Response> {
  try {
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `signup:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 3, 3600000); // 3 signups per hour

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many signup attempts. Try again later." }),
        { status: 429, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password required" }),
        { status: 400, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${new URL(req.url).origin}/dashboard`,
      },
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 400, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    // Set HttpOnly cookie if session is available
    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...getRateLimitHeaders(rateLimit),
    });

    if (data.session?.access_token) {
      const cookieHeader = setHttpOnlyCookie("auth_token", data.session.access_token, 604800);
      const refreshCookieHeader = data.session.refresh_token ? 
        setHttpOnlyCookie("refresh_token", data.session.refresh_token, 604800) : null;
      const userCookieHeader = `user_email=${encodeURIComponent(data.user?.email || '')}; Max-Age=604800; Path=/; SameSite=Strict`;
      responseHeaders.append("Set-Cookie", cookieHeader);
      if (refreshCookieHeader) {
        responseHeaders.append("Set-Cookie", refreshCookieHeader);
      }
      responseHeaders.append("Set-Cookie", userCookieHeader);
      
      // Log successful sign up with refresh token info
      if (data.session?.refresh_token) {
        console.log('✓ Sign up successful with session and refresh token for:', data.user?.email || 'unknown');
      } else {
        console.log('⚠️  Sign up successful with session but no refresh token provided by Supabase for:', data.user?.email || 'unknown');
      }
    } else {
      // No session returned - likely email confirmation is required
      console.log('ℹ️  Sign up successful but no session (email confirmation may be required) for:', data.user?.email || 'unknown');
      
      // Clear any existing cookies to prevent confusion
      responseHeaders.append("Set-Cookie", "auth_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict");
      responseHeaders.append("Set-Cookie", "refresh_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict");
      responseHeaders.append("Set-Cookie", `user_email=${encodeURIComponent(data.user?.email || '')}; Max-Age=604800; Path=/; SameSite=Strict`);
    }

    return new Response(
      JSON.stringify({
        user: { id: data.user?.id || '', email: data.user?.email || '' },
        message: "Sign up successful",
      }),
      { status: 201, headers: responseHeaders }
    );
  } catch (error) {
    console.error("Sign up error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleMFAVerify(req: Request): Promise<Response> {
  try {
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `verify:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60000); // 10 attempts per minute

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many verification attempts. Try again later." }),
        { status: 429, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    let token = null;
    let refreshToken = null;
    
    // Log incoming headers for debugging
    const cookieHeader = req.headers.get("cookie") || "";
    console.log("MFA Verify - Cookies: " + (cookieHeader ? "received" : "none"))
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else {
      // Read from HttpOnly cookie
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const eqIndex = cookie.indexOf('=');
        if (eqIndex !== -1) {
          const name = cookie.substring(0, eqIndex).trim();
          const value = cookie.substring(eqIndex + 1);
          acc[name] = decodeURIComponent(value || '');
        }
        return acc;
      }, {} as Record<string, string>);
      token = cookies['auth_token'];
      refreshToken = cookies['refresh_token'];
      
      console.log("MFA Verify - Token: " + (token ? "yes" : "no") + ", RefreshToken: " + (refreshToken ? "yes" : "no"));
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    let userClient = createUserClient(token);
    
    // Try to refresh token if we have a refresh token (for better reliability)
    if (refreshToken) {
      console.log('🔄 Attempting proactive token refresh in verify handler...');
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        userClient = createUserClient(token);
        console.log('✅ Token proactively refreshed in verify handler');
      } else {
        console.warn('⚠️  Proactive token refresh failed, continuing with original token');
      }
    } else {
      console.warn('⚠️  No refresh token available, cannot proactively refresh');
    }

    const { code, factorId, challengeId } = await req.json().catch(() => ({ code: undefined, factorId: undefined, challengeId: undefined }));

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Code required" }),
        { status: 400, headers: { ...getRateLimitHeaders(rateLimit), "Content-Type": "application/json" } }
      );
    }

    let actualFactorId = factorId;
    let actualChallengeId = challengeId;
    
    // If no factorId provided, try to get it from listFactors
    if (!actualFactorId || !actualChallengeId) {
      let listError = null;
      let factors = null;
      
      // Try to list factors
      let result = await userClient.auth.mfa.listFactors();
      if (result.error?.message?.includes('token is expired') && refreshToken) {
        console.log('Token expired, attempting refresh...');
        const refreshed = await refreshAccessToken(refreshToken);
        if (refreshed) {
          token = refreshed.access_token;
          refreshToken = refreshed.refresh_token;
          userClient = createUserClient(token);
          result = await userClient.auth.mfa.listFactors();
        }
      }
      
      listError = result.error;
      factors = result.data;
      
      if (listError) {
        // Check if token still expired
        if (listError.message && listError.message.includes('token is expired')) {
          return new Response(
            JSON.stringify({ error: "token is expired" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: `Failed to list factors: ${listError.message}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const totpFactor = factors?.all?.find((f: { factor_type: string; id: string }) => f.factor_type === "totp");
      if (!totpFactor) {
        return new Response(
          JSON.stringify({ error: "No TOTP factor found. Please enroll first." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      actualFactorId = totpFactor.id;
    }
    
    // Create a challenge if we don't have one
    if (!actualChallengeId) {
      let challengeError = null;
      let challenge = null;
      
      let result = await userClient.auth.mfa.challenge({ 
        factorId: actualFactorId 
      });
      
      if (result.error?.message?.includes('token is expired') && refreshToken) {
        console.log('Token expired during challenge, attempting refresh...');
        const refreshed = await refreshAccessToken(refreshToken);
        if (refreshed) {
          token = refreshed.access_token;
          refreshToken = refreshed.refresh_token;
          userClient = createUserClient(token);
          result = await userClient.auth.mfa.challenge({ factorId: actualFactorId });
        }
      }
      
      challengeError = result.error;
      challenge = result.data;
      
      if (challengeError) {
        if (challengeError.message && challengeError.message.includes('token is expired')) {
          return new Response(
            JSON.stringify({ error: "token is expired" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: `Failed to create challenge: ${challengeError.message}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      actualChallengeId = challenge?.id;
    }

    // Verify the code with the challenge
    let verifyResult = await userClient.auth.mfa.verify({
      factorId: actualFactorId,
      challengeId: actualChallengeId,
      code,
    });
    
    // If token expired during verify, try refresh and retry once
    if (verifyResult.error?.message?.includes('token is expired') && refreshToken) {
      console.log('Token expired during MFA verify, attempting refresh and retry...');
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        userClient = createUserClient(token);
        console.log('Token refreshed, retrying MFA verify...');
        verifyResult = await userClient.auth.mfa.verify({
          factorId: actualFactorId,
          challengeId: actualChallengeId,
          code,
        });
      }
    }

    const { data, error } = verifyResult;
    if (error) {
      // Check if token expired (even after retry)
      if (error.message && error.message.includes('token is expired')) {
        return new Response(
          JSON.stringify({ error: "token is expired" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const { error: dbError } = await supabaseService
        .from('user_mfa_status')
        .upsert({
          user_id: data.user.id,
          mfa_enrolled: true,
          enrolled_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (dbError) console.error("Failed to update MFA status in database:", dbError);
    } catch (dbErr) {
      console.error("Database update error:", dbErr);
    }

    return new Response(
      JSON.stringify({ user: data.user, message: "MFA verification successful" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MFA verify error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleMFAEnroll(req: Request): Promise<Response> {
  try {
    // Get token from Authorization header OR from HttpOnly cookie
    let token = null;
    let refreshToken = null;
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    
    // Log incoming headers for debugging
    const cookieHeader = req.headers.get("cookie") || "";
    console.log("MFA Enroll - Cookies: " + (cookieHeader ? "received" : "none"));
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else {
      // Read from HttpOnly cookie
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const eqIndex = cookie.indexOf('=');
        if (eqIndex !== -1) {
          const name = cookie.substring(0, eqIndex).trim();
          const value = cookie.substring(eqIndex + 1);
          acc[name] = decodeURIComponent(value || '');
        }
        return acc;
      }, {} as Record<string, string>);
      token = cookies['auth_token'];
      refreshToken = cookies['refresh_token'];
      
      console.log("MFA Enroll - Token: " + (token ? "yes" : "no") + ", RefreshToken: " + (refreshToken ? "yes" : "no"));
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let userClient = createUserClient(token);
    
    // Get user info for logging
    const userInfo = await userClient.auth.getUser();
    const userEmail = userInfo.data?.user?.email || 'unknown';
    console.log('📧 MFA Enroll - User:', userEmail);
    
    // Try to refresh token if we have a refresh token
    if (refreshToken) {
      console.log('🔄 Attempting proactive token refresh in enroll handler...');
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        userClient = createUserClient(token);
        console.log('✅ Token proactively refreshed in enroll handler');
      } else {
        console.warn('⚠️  Proactive token refresh failed, continuing with original token');
      }
    } else {
      console.warn('⚠️  No refresh token available in enroll handler');
    }

    const body = await req.json().catch(() => ({} as Record<string, string>));
    const factorType = body.factorType || "totp";

    let enrollResult = await userClient.auth.mfa.enroll({ 
      factorType,
      friendlyName: `${factorType.toUpperCase()} ${new Date().getTime()}`
    });
    
    // If token expired during enroll, try refresh and retry once
    if (enrollResult.error?.message?.includes('token is expired') && refreshToken) {
      console.log('Token expired during MFA enroll, attempting refresh and retry...');
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        userClient = createUserClient(token);
        console.log('Token refreshed, retrying MFA enroll...');
        enrollResult = await userClient.auth.mfa.enroll({ 
          factorType,
          friendlyName: `${factorType.toUpperCase()} ${new Date().getTime()}`
        });
      }
    }

    const { data, error } = enrollResult;
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MFA enroll error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleMFAChallenge(req: Request): Promise<Response> {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    
    let token = null;
    let refreshToken = null;

    console.log("MFA Challenge - Cookies: " + (cookieHeader ? "received" : "none"));

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else {
      // Read from HttpOnly cookie
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const eqIndex = cookie.indexOf('=');
        if (eqIndex !== -1) {
          const name = cookie.substring(0, eqIndex).trim();
          const value = cookie.substring(eqIndex + 1);
          acc[name] = decodeURIComponent(value || '');
        }
        return acc;
      }, {} as Record<string, string>);
      token = cookies['auth_token'];
      refreshToken = cookies['refresh_token'];
      
      console.log("MFA Challenge - Token: " + (token ? "yes" : "no") + ", RefreshToken: " + (refreshToken ? "yes" : "no"));
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let userClient = createUserClient(token);
    
    // Try to refresh token if we have a refresh token
    if (refreshToken) {
      console.log('🔄 Attempting proactive token refresh in challenge handler...');
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        userClient = createUserClient(token);
        console.log('✅ Token proactively refreshed in challenge handler');
      } else {
        console.warn('⚠️  Proactive token refresh failed, continuing with original token');
      }
    }

    const body = await req.json().catch(() => ({} as Record<string, string>));
    const factorId = body.factorId;

    if (!factorId) {
      return new Response(
        JSON.stringify({ error: "factorId required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let challengeResult = await userClient.auth.mfa.challenge({ 
      factorId
    });
    
    // If token expired during challenge, try refresh and retry once
    if (challengeResult.error?.message?.includes('token is expired') && refreshToken) {
      console.log('Token expired during MFA challenge, attempting refresh and retry...');
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.access_token;
        refreshToken = refreshed.refresh_token;
        userClient = createUserClient(token);
        console.log('Token refreshed, retrying MFA challenge...');
        challengeResult = await userClient.auth.mfa.challenge({ factorId });
      }
    }

    const { data, error } = challengeResult;
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MFA challenge error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  
  console.log(`📨 Incoming ${req.method} request to ${pathname}`);

  // API Routes
  if (pathname === "/api/auth/signin") {
    console.log('  → Handling sign-in request');
    return handleSignIn(req);
  }
  if (pathname === "/api/auth/signup") {
    return handleSignUp(req);
  }
  if (pathname === "/api/mfa/verify") {
    return handleMFAVerify(req);
  }
  if (pathname === "/api/mfa/enroll") {
    return handleMFAEnroll(req);
  }
  if (pathname === "/api/mfa/challenge") {
    return handleMFAChallenge(req);
  }

  // Page Routes
  if (pathname === "/" || pathname === "/index.html") {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MFA Auth - Secure Two-Factor Authentication</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 60px 40px; width: 100%; max-width: 500px; text-align: center; }
    h1 { color: #1f2937; font-size: 32px; margin-bottom: 10px; }
    .subtitle { color: #6b7280; font-size: 16px; margin-bottom: 30px; }
    .features { text-align: left; margin: 40px 0; }
    .feature { display: flex; align-items: flex-start; margin-bottom: 20px; }
    .feature-icon { font-size: 24px; margin-right: 15px; }
    .feature-text { flex: 1; }
    .feature-text h3 { color: #1f2937; font-size: 14px; margin-bottom: 5px; }
    .feature-text p { color: #6b7280; font-size: 13px; }
    .cta-buttons { display: flex; gap: 10px; margin-top: 40px; }
    .btn { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-block; }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5568d3; }
    .btn-secondary { background: #e5e7eb; color: #374151; }
    .btn-secondary:hover { background: #d1d5db; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 MFA Auth</h1>
    <p class="subtitle">Enterprise-grade two-factor authentication</p>
    
    <div class="features">
      <div class="feature">
        <div class="feature-icon">✅</div>
        <div class="feature-text">
          <h3>TOTP-Based MFA</h3>
          <p>Compatible with Google Authenticator, Authy, and more</p>
        </div>
      </div>
      <div class="feature">
        <div class="feature-icon">🔒</div>
        <div class="feature-text">
          <h3>Secure Authentication</h3>
          <p>State-of-the-art encryption and session management</p>
        </div>
      </div>
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <div class="feature-text">
          <h3>Lightning Fast</h3>
          <p>Built with Deno, Fresh, and Supabase for performance</p>
        </div>
      </div>
    </div>
    
    <div class="cta-buttons">
      <a href="/login" class="btn btn-primary">Sign In</a>
      <a href="/signup" class="btn btn-secondary">Create Account</a>
    </div>
  </div>
</body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (pathname === "/login") {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login - MFA Auth</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #3b82f6, #8b5cf6); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .form-container { background: white; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); padding: 40px; width: 100%; max-width: 400px; }
    h2 { color: #1f2937; margin-top: 0; }
    .message { padding: 10px; margin-bottom: 20px; display: none; border-radius: 6px; text-align: center; }
    .message.error { background: #fee2e2; color: #dc2626; }
    .message.success { background: #d1fae5; color: #059669; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #374151; font-weight: bold; margin-bottom: 5px; }
    input { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
    button:hover { background: #2563eb; }
    .signup-link { text-align: center; margin-top: 20px; }
    .signup-link a { color: #3b82f6; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="form-container">
    <h2>🔐 Welcome Back</h2>
    <p>Sign in with MFA protection</p>
    <form id="loginForm">
      <div id="message" class="message"></div>
      <div class="form-group">
        <label>Email</label>
        <input id="email" type="email" placeholder="your@email.com" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="password" type="password" placeholder="••••••••" required>
      </div>
      <button type="submit">Sign In</button>
    </form>
    <p class="signup-link">Don't have an account? <a href="/signup">Sign Up</a></p>
  </div>
  <script>
    // Check if coming from signup
    function getCookie(name) {
      const value = "; " + document.cookie;
      const parts = value.split("; " + name + "=");
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
      return null;
    }
    
    const signupEmail = getCookie('signup_email');
    if (signupEmail) {
      document.getElementById('email').value = signupEmail;
      // Clear the cookie
      document.cookie = 'signup_email=; Max-Age=0; Path=/; SameSite=Strict';
      // Show a message
      const msgEl = document.getElementById('message');
      msgEl.textContent = '✅ Account created! Please sign in to continue.';
      msgEl.className = 'message success';
      msgEl.style.display = 'block';
    }
    
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const msgEl = document.getElementById('message');
      msgEl.style.display = 'none';
      try {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          credentials: 'include', // Include cookies
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
          msgEl.textContent = '❌ ' + (data.error || 'Sign in failed');
          msgEl.className = 'message error';
          msgEl.style.display = 'block';
          return;
        }
        // Cookies are set by server automatically
        if (data.hasMFA) {
          window.location.href = '/mfa/verify';
        } else {
          window.location.href = '/mfa/enroll';
        }
      } catch (error) {
        msgEl.textContent = '❌ Error: ' + error.message;
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (pathname === "/signup") {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sign Up - MFA Auth</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #3b82f6, #8b5cf6); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .form-container { background: white; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); padding: 40px; width: 100%; max-width: 400px; }
    h2 { color: #1f2937; margin-top: 0; }
    .message { padding: 10px; margin-bottom: 20px; display: none; border-radius: 6px; }
    .message.error { background: #fee2e2; color: #dc2626; }
    .message.success { background: #d1fae5; color: #059669; }
    .form-group { margin-bottom: 20px; }
    label { display: block; color: #374151; font-weight: bold; margin-bottom: 5px; }
    input { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
    button:hover { background: #059669; }
    .login-link { text-align: center; margin-top: 20px; }
    .login-link a { color: #3b82f6; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="form-container">
    <h2>📝 Create Account</h2>
    <p>Join us with secure MFA authentication</p>
    <form id="signupForm">
      <div id="message" style="padding: 10px; margin-bottom: 20px; display: none; border-radius: 6px; text-align: center;"></div>
      <div class="form-group">
        <label>Email</label>
        <input id="email" type="email" placeholder="your@email.com" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="password" type="password" placeholder="••••••••" required>
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input id="confirmPassword" type="password" placeholder="••••••••" required>
      </div>
      <button type="submit">Sign Up</button>
      <div class="login-link">
        Already have an account? <a href="/login">Login here</a>
      </div>
    </form>
  </div>
  <script>
    const form = document.getElementById('signupForm');
    const messageEl = document.getElementById('message');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      messageEl.style.display = 'none';
      
      if (password !== confirmPassword) {
        messageEl.textContent = '❌ Passwords do not match';
        messageEl.style.background = '#fee2e2';
        messageEl.style.color = '#dc2626';
        messageEl.style.display = 'block';
        return;
      }
      
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Ensure cookies are stored
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          messageEl.textContent = '✅ Signup successful! Please sign in to continue...';
          messageEl.style.background = '#d1fae5';
          messageEl.style.color = '#059669';
          messageEl.style.display = 'block';
          
          // Store email for convenience
          document.cookie = 'signup_email=' + encodeURIComponent(email) + '; Max-Age=300; Path=/; SameSite=Strict';
          
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        } else {
          messageEl.textContent = '❌ ' + (data.error || 'Signup failed');
          messageEl.style.background = '#fee2e2';
          messageEl.style.color = '#dc2626';
          messageEl.style.display = 'block';
        }
      } catch (error) {
        messageEl.textContent = '❌ Network error: ' + error.message;
        messageEl.style.background = '#fee2e2';
        messageEl.style.color = '#dc2626';
        messageEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (pathname === "/dashboard") {
    // Check for auth_token cookie in request
    const cookieHeader = req.headers.get("cookie") || "";
    const hasAuthToken = cookieHeader.includes("auth_token=");
    
    // If no auth token, redirect to login
    if (!hasAuthToken) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
        },
      });
    }

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dashboard - MFA Auth</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f3f4f6; }
    nav { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 20px; display: flex; justify-content: space-between; align-items: center; }
    .nav-left { display: flex; align-items: center; gap: 20px; }
    .user-info { color: #6b7280; font-size: 14px; }
    .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    .card { background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; }
    h1 { color: #1f2937; margin: 0; }
    h2 { color: #1f2937; }
    .features { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    .feature-box { background: #f0f9ff; padding: 20px; border-radius: 6px; }
    .button { padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .button:hover { background: #dc2626; }
  </style>
</head>
<body>
  <nav>
    <div class="nav-left">
      <h1>🔐 MFA Auth</h1>
      <div class="user-info" id="userEmail">Loading...</div>
    </div>
    <button class="button" id="logoutBtn">Logout</button>
  </nav>
  <div class="container">
    <div class="card">
      <h2>Welcome to Dashboard</h2>
      <p>You have successfully authenticated with MFA enabled.</p>
      <div class="features">
        <div class="feature-box">
          <h3>✅ MFA Active</h3>
          <p>Your account is protected with two-factor authentication.</p>
        </div>
        <div class="feature-box">
          <h3>🔒 Secure Session</h3>
          <p>Your session is encrypted and protected.</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Check if user is authenticated by reading cookies
    function getCookie(name) {
      const value = "; " + document.cookie;
      const parts = value.split("; " + name + "=");
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
      return null;
    }
    
    const userEmail = getCookie('user_email');
    
    if (!userEmail) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
    } else {
      // Display user email
      document.getElementById('userEmail').textContent = '📧 ' + userEmail;
    }
    
    // Logout functionality
    document.getElementById('logoutBtn').addEventListener('click', () => {
      // Clear cookies by setting them to expire
      document.cookie = 'auth_token=; Max-Age=0; Path=/';
      document.cookie = 'user_email=; Max-Age=0; Path=/';
      window.location.href = '/';
    });
  </script>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (pathname === "/mfa/enroll") {
    // Check for auth_token cookie in request
    const cookieHeader = req.headers.get("cookie") || "";
    const hasAuthToken = cookieHeader.includes("auth_token=");
    
    // If no auth token, redirect to login
    if (!hasAuthToken) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
        },
      });
    }

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Set Up MFA - MFA Auth</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #3b82f6, #8b5cf6); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: white; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); padding: 40px; width: 100%; max-width: 600px; }
    h2 { color: #1f2937; margin-top: 0; text-align: center; }
    .message { padding: 15px; margin: 20px 0; border-radius: 6px; text-align: center; display: none; }
    .message.error { background: #fee2e2; color: #dc2626; }
    .message.success { background: #d1fae5; color: #059669; }
    .qr-section { text-align: center; margin: 30px 0; }
    .qr-code { background: #f9f9f9; border: 2px solid #ddd; padding: 20px; border-radius: 8px; margin: 20px 0; min-height: 200px; display: flex; align-items: center; justify-content: center; }
    .qr-code img { max-width: 100%; height: auto; }
    .secret-key { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; word-break: break-all; font-family: monospace; font-weight: bold; }
    .info-box { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6; }
    .button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
    .button:hover { background: #2563eb; }
    .back-button { width: 100%; padding: 12px; background: white; color: #3b82f6; border: 1px solid #3b82f6; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
    .verify-section { display: none; margin-top: 30px; }
    .form-group { margin: 15px 0; }
    .form-group label { display: block; color: #374151; font-weight: bold; margin-bottom: 5px; }
    .form-group input { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; }
  </style>
</head>
<body>
  <div class="container">
    <h2>📱 Set Up Two-Factor Authentication</h2>
    <div id="message" class="message"></div>
    
    <div id="enrollSection">
      <p style="text-align: center; color: #6b7280;">Click below to generate your MFA setup code</p>
      <button class="button" id="startBtn">🚀 Start MFA Setup</button>
    </div>

    <div id="setupSection" style="display: none;">
      <p style="text-align: center; color: #6b7280;">Scan this QR code with your authenticator app</p>
      
      <div class="qr-section">
        <div class="qr-code" id="qrCode">
          <p>Generating QR code...</p>
        </div>
      </div>

      <div>
        <h4 style="margin: 15px 0 5px 0;">Secret Key (Manual Entry):</h4>
        <div class="secret-key" id="secretKey">Loading...</div>
      </div>

      <div class="info-box">
        <h4 style="margin-top: 0;">✓ Supported Apps</h4>
        <ul style="text-align: left; margin: 10px 0;">
          <li>Google Authenticator</li>
          <li>Authy</li>
          <li>Microsoft Authenticator</li>
          <li>1Password</li>
        </ul>
      </div>

      <button class="button" id="nextBtn">✓ Next: Verify Code</button>
    </div>

    <div id="verifySection" class="verify-section">
      <h3 style="color: #1f2937;">Verify Your Code</h3>
      <p style="color: #6b7280;">Enter the 6-digit code from your authenticator app</p>
      <form id="verifyForm">
        <div class="form-group">
          <label for="code">6-Digit Code</label>
          <input id="code" type="text" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required>
        </div>
        <button type="submit" class="button">🔐 Verify & Complete</button>
      </form>
    </div>

    <button class="back-button" id="backBtn" style="display: none;">← Back to Home</button>
  </div>

  <script>
    let currentChallenge = null;
    let currentFactorId = null;
    
    // Server already checked auth_token (HttpOnly cookie) - if we're here, user is authenticated
    
    document.getElementById('startBtn')?.addEventListener('click', async () => {
      const msgEl = document.getElementById('message');
      msgEl.style.display = 'none';
      
      try {
        const response = await fetch('/api/mfa/enroll', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ factorType: 'totp' }),
          credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
          // Check if token is expired
          if (data.error && data.error.includes('token is expired')) {
            msgEl.textContent = '⏰ Session expired. Please sign in again.';
            msgEl.className = 'message error';
            msgEl.style.display = 'block';
            setTimeout(() => window.location.href = '/login', 2000);
            return;
          }
          msgEl.textContent = '❌ ' + (data.error || 'Failed to start MFA setup');
          msgEl.className = 'message error';
          msgEl.style.display = 'block';
          return;
        }

        currentChallenge = data.id;
        currentFactorId = data.id; // Factor ID is same as challenge ID in Supabase
        
        // Display QR code
        const qrElement = document.getElementById('qrCode');
        if (data.totp?.qr_code) {
          qrElement.innerHTML = '<img src="' + data.totp.qr_code + '" alt="QR Code">';
        } else {
          qrElement.innerHTML = '<p>❌ Could not generate QR code</p>';
        }

        // Display secret key
        const secretElement = document.getElementById('secretKey');
        if (data.totp?.secret) {
          secretElement.textContent = data.totp.secret;
        } else {
          secretElement.textContent = 'Secret key not available';
        }

        // Show setup section, hide start button
        document.getElementById('enrollSection').style.display = 'none';
        document.getElementById('setupSection').style.display = 'block';
        document.getElementById('nextBtn').style.display = 'block';

      } catch (error) {
        msgEl.textContent = '❌ Error: ' + error.message;
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
      }
    });

    document.getElementById('nextBtn').addEventListener('click', async () => {
      if (!currentFactorId) {
        const msgEl = document.getElementById('message');
        msgEl.textContent = '❌ No factor ID found. Please start again.';
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
        return;
      }

      // Create a challenge for the newly enrolled factor
      try {
        const response = await fetch('/api/mfa/challenge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ factorId: currentFactorId }),
          credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
          const msgEl = document.getElementById('message');
          msgEl.textContent = '❌ Failed to create challenge: ' + (data.error || 'Unknown error');
          msgEl.className = 'message error';
          msgEl.style.display = 'block';
          return;
        }

        // Store the challenge ID from the response
        currentChallenge = data.id;
        
        document.getElementById('setupSection').style.display = 'none';
        document.getElementById('verifySection').style.display = 'block';
        document.getElementById('backBtn').style.display = 'block';
      } catch (error) {
        const msgEl = document.getElementById('message');
        msgEl.textContent = '❌ Error creating challenge: ' + error.message;
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
      }
    });

    document.getElementById('verifyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const code = document.getElementById('code').value;
      const msgEl = document.getElementById('message');
      msgEl.style.display = 'none';

      if (code.length !== 6) {
        msgEl.textContent = '❌ Code must be 6 digits';
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('/api/mfa/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            factorId: currentFactorId,
            challengeId: currentChallenge,
            code: code
          })
        });

        const data = await response.json();

        if (response.ok) {
          msgEl.textContent = '✅ MFA Setup Complete! Redirecting to dashboard...';
          msgEl.className = 'message success';
          msgEl.style.display = 'block';
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1500);
        } else {
          // Check if token is expired
          if (data.error && data.error.includes('token is expired')) {
            msgEl.textContent = '⏰ Session expired. Please sign in again.';
            msgEl.className = 'message error';
            msgEl.style.display = 'block';
            setTimeout(() => window.location.href = '/login', 2000);
            return;
          }
          msgEl.textContent = '❌ ' + (data.error || 'Invalid code. Try again.');
          msgEl.className = 'message error';
          msgEl.style.display = 'block';
          document.getElementById('code').value = '';
        }
      } catch (error) {
        msgEl.textContent = '❌ Error: ' + error.message;
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
      }
    });

    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = '/';
    });
  </script>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  // MFA Verification page (for users with existing MFA)
  if (pathname === "/mfa/verify") {
    // Don't check for cookies here - let React component handle auth
    // Cookies might not be sent by browser, but token is in localStorage
    
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify MFA - MFA Auth</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #3b82f6, #8b5cf6); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: white; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); padding: 40px; width: 100%; max-width: 400px; }
    h2 { color: #1f2937; margin-top: 0; text-align: center; }
    .message { padding: 15px; margin: 20px 0; border-radius: 6px; text-align: center; display: none; }
    .message.error { background: #fee2e2; color: #dc2626; }
    .message.success { background: #d1fae5; color: #059669; }
    .form-group { margin: 20px 0; }
    .form-group label { display: block; color: #374151; font-weight: bold; margin-bottom: 10px; }
    .form-group input { width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 6px; box-sizing: border-box; font-size: 24px; letter-spacing: 4px; text-align: center; }
    .form-group input:focus { outline: none; border-color: #3b82f6; }
    .button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 20px; }
    .button:hover { background: #2563eb; }
    .back-button { width: 100%; padding: 12px; background: white; color: #3b82f6; border: 1px solid #3b82f6; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>🔐 Verify Your Code</h2>
    <p style="text-align: center; color: #6b7280;">Enter the 6-digit code from your authenticator app</p>
    <div id="message" class="message"></div>
    <form id="verifyForm">
      <div class="form-group">
        <label for="code">6-Digit Code</label>
        <input id="code" type="text" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autofocus>
      </div>
      <button type="submit" class="button">✓ Verify & Sign In</button>
    </form>
    <button class="back-button" id="backBtn">← Back to Login</button>
  </div>

  <script>
    let currentChallenge = localStorage.getItem('mfa_challenge_id');
    const accessToken = localStorage.getItem('access_token');

    // If no challenge, try to create one
    if (!currentChallenge) {
      console.log('No challenge stored, will create during verification');
    }
    
    document.getElementById('verifyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const code = document.getElementById('code').value;
      const msgEl = document.getElementById('message');
      msgEl.style.display = 'none';

      if (code.length !== 6) {
        msgEl.textContent = '❌ Code must be 6 digits';
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
        return;
      }

      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (accessToken) {
          headers['Authorization'] = 'Bearer ' + accessToken;
        }

        const response = await fetch('/api/mfa/verify', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            challengeId: currentChallenge,
            code: code
          })
        });

        const data = await response.json();

        if (response.ok) {
          msgEl.textContent = '✅ MFA verified! Signing you in...';
          msgEl.className = 'message success';
          msgEl.style.display = 'block';
          setTimeout(() => {
            // Clear MFA verification data, keep session
            localStorage.removeItem('mfa_challenge_id');
            localStorage.removeItem('mfa_factor_id');
            window.location.href = '/dashboard';
          }, 1500);
        } else {
          if (data.error && data.error.includes('Session expired')) {
            msgEl.textContent = '⏰ ' + data.error;
            msgEl.className = 'message error';
            msgEl.style.display = 'block';
            setTimeout(() => window.location.href = '/login', 2000);
          } else {
            msgEl.textContent = '❌ ' + (data.error || 'Invalid code. Try again.');
            msgEl.className = 'message error';
            msgEl.style.display = 'block';
            document.getElementById('code').value = '';
            document.getElementById('code').focus();
          }
        }
      } catch (error) {
        msgEl.textContent = '❌ Error: ' + error.message;
        msgEl.className = 'message error';
        msgEl.style.display = 'block';
      }
    });

    document.getElementById('backBtn').addEventListener('click', () => {
      localStorage.removeItem('mfa_challenge_id');
      localStorage.removeItem('mfa_factor_id');
      window.location.href = '/login';
    });
  </script>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  // 404
  return new Response("Not Found", { status: 404 });
};

const status = supabaseService 
  ? "✅ Supabase configured" 
  : "⚠️  Supabase not configured (set environment variables)";

console.log(`🚀 Server running at http://localhost:${PORT}`);
console.log(`${status}`);
await Deno.serve({ port: PORT }, handler);