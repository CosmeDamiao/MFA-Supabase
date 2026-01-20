import { supabase } from "../../../utils/supabase.ts";

export async function POST(req: Request, _ctx: unknown) {
  try {
    const { factorType } = await req.json();

    if (!factorType) {
      return new Response(
        JSON.stringify({ error: "Factor type required" }),
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        type: data.type,
        totp: {
          qr_code: data.totp?.qr_code,
          secret: data.totp?.secret,
        },
        message: "MFA enrollment started. Verify with the QR code.",
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("MFA enroll error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
