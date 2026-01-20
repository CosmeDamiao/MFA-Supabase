import { supabase } from "../../../utils/supabase.ts";
import { setHttpOnlyCookie } from "../../../utils/cookies.ts";
import { createClient } from "jsr:@supabase/supabase-js@^2";

export async function POST(req: Request, _ctx: unknown) {
  try {
    const { code, challengeId, factorId, token } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Code required" }),
        { status: 400 }
      );
    }

    let actualChallengeId = challengeId;
    let actualFactorId = factorId;

    // If no challengeId provided, try to create one using the token
    if (!actualChallengeId && token) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_KEY");

        if (supabaseUrl && supabaseKey) {
          const userSupabase = createClient(
            supabaseUrl,
            supabaseKey,
            {
              global: {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            }
          );

          // Get user and list factors
          const { data: userData } = await userSupabase.auth.getUser();
          if (userData?.user) {
            const { data: factors } = await userSupabase.auth.mfa.listFactors();
            
            if (factors?.all && factors.all.length > 0) {
              const totpFactor = factors.all.find((f: { factor_type: string; id: string }) => f.factor_type === 'totp');
              
              if (totpFactor) {
                const { data: challengeData } = await userSupabase.auth.mfa.challenge({
                  factorId: totpFactor.id,
                });
                
                if (challengeData) {
                  actualChallengeId = challengeData.id;
                  actualFactorId = totpFactor.id;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Challenge creation error:", err);
      }
    }

    if (!actualChallengeId || !actualFactorId) {
      return new Response(
        JSON.stringify({ error: "Cannot create verification challenge" }),
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.mfa.verifyOTP({
      factorId: actualFactorId,
      challengeId: actualChallengeId,
      code,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401 }
      );
    }

    // Update database to mark MFA as enrolled
    try {
      const { error: dbError } = await supabase
        .from('user_mfa_status')
        .upsert({
          user_id: data.user.id,
          mfa_enrolled: true,
          enrolled_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (dbError) {
        console.error("Failed to update MFA status in database:", dbError);
      } else {
        console.log("✅ MFA status updated in database for user:", data.user.email);
      }
    } catch (dbErr) {
      console.error("Database update error:", dbErr);
    }

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
    });
    responseHeaders.append(
      "Set-Cookie",
      setHttpOnlyCookie("auth_token", data.session.access_token, 604800)
    );
    responseHeaders.append(
      "Set-Cookie",
      `user_email=${encodeURIComponent(data.user.email)}; Max-Age=604800; Path=/; SameSite=Strict`
    );

    return new Response(
      JSON.stringify({
        session: data.session,
        user: data.user,
        message: "MFA verification successful",
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error("MFA verify error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
