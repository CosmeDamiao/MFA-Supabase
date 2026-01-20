import { createClient } from "jsr:@supabase/supabase-js@^2";

export async function POST(req: Request, _ctx: unknown) {
  try {
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500 }
      );
    }

    // Create a client with the user's token
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

    // Verify the token by getting user first
    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error("User verification error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 200 }
      );
    }

    // List MFA factors for this user
    const { data: factors, error: factorsError } = await userSupabase.auth.mfa.listFactors();
    
    if (factorsError || !factors?.all || factors.all.length === 0) {
      console.error("MFA listFactors error:", factorsError);
      return new Response(
        JSON.stringify({ error: "No MFA factors found" }),
        { status: 200 }
      );
    }

    // Create challenge for the first TOTP factor
    const totpFactor = factors.all.find((f: { factor_type: string; id: string }) => f.factor_type === 'totp');
    
    if (!totpFactor) {
      return new Response(
        JSON.stringify({ error: "No TOTP factor found" }),
        { status: 200 }
      );
    }

    const { data: challengeData, error: challengeError } = await userSupabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });

    if (challengeError || !challengeData) {
      console.error("MFA challenge error:", challengeError);
      return new Response(
        JSON.stringify({ error: "Challenge creation failed" }),
        { status: 200 }
      );
    }

    console.log("Challenge created for factor:", totpFactor.id);

    return new Response(
      JSON.stringify({
        challengeId: challengeData.id,
        factorId: totpFactor.id,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Challenge creation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
