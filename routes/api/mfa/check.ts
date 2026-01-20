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
        JSON.stringify({ hasMFA: false, error: "Invalid token" }),
        { status: 200 }
      );
    }

    console.log("User verified:", userData.user.email);

    // List MFA factors for this user
    const { data: factors, error: factorsError } = await userSupabase.auth.mfa.listFactors();
    
    if (factorsError) {
      console.error("MFA listFactors error:", factorsError);
      return new Response(
        JSON.stringify({ hasMFA: false }),
        { status: 200 }
      );
    }
    
    console.log("MFA Check - Factors:", JSON.stringify(factors, null, 2));
    
    const hasMFA = factors && factors.all && factors.all.length > 0;

    if (hasMFA) {
      // Create MFA challenge
      const { data: challengeData, error: challengeError } = await userSupabase.auth.mfa.challenge({
        factorId: factors.all[0].id,
      });

      if (challengeError) {
        console.error("MFA challenge error:", challengeError);
        return new Response(
          JSON.stringify({ hasMFA: true, error: "Challenge creation failed" }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          hasMFA: true,
          challengeId: challengeData?.id,
          factorId: factors.all[0].id,
        }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        hasMFA: false,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("MFA check error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", hasMFA: false }),
      { status: 500 }
    );
  }
}
