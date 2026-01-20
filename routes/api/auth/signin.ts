import { supabase } from "../../../utils/supabase.ts";
import { setHttpOnlyCookie } from "../../../utils/cookies.ts";

export async function POST(req: Request, _ctx: unknown) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password required" }),
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401 }
      );
    }

    // Check MFA enrollment status from database
    let hasMFA = false;
    try {
      const { data: mfaStatus, error: dbError } = await supabase
        .from('user_mfa_status')
        .select('mfa_enrolled')
        .eq('user_id', data.user.id)
        .single();

      if (dbError && dbError.code !== 'PGRST116') { // PGRST116 = not found
        console.error("Error checking MFA status:", dbError);
      } else {
        hasMFA = mfaStatus?.mfa_enrolled || false;
        console.log("✅ MFA check for", data.user.email, "- Enrolled:", hasMFA);
      }
    } catch (err) {
      console.error("MFA detection error:", err);
    }

    // Return session with MFA status
    const responseHeaders = new Headers({ "Content-Type": "application/json" });

    // Set HttpOnly cookies for session + refresh; non-HttpOnly for email
    if (data.session?.access_token) {
      responseHeaders.append("Set-Cookie", setHttpOnlyCookie("auth_token", data.session.access_token, 604800));
    }
    if (data.session?.refresh_token) {
      responseHeaders.append("Set-Cookie", setHttpOnlyCookie("refresh_token", data.session.refresh_token, 604800));
    }
    if (data.user?.email) {
      responseHeaders.append(
        "Set-Cookie",
        `user_email=${encodeURIComponent(data.user.email)}; Max-Age=604800; Path=/; SameSite=Strict`
      );
    }

    return new Response(
      JSON.stringify({
        user: data.user,
        session: data.session,
        hasMFA: hasMFA,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    console.error("Signin error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
