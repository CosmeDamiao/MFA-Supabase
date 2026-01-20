import { createClient } from "jsr:@supabase/supabase-js@^2";
import { load } from "dotenv";

// Only load .env file in development (Deno Deploy uses platform env vars)
if (Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
  try {
    await load({ export: true, allowEmptyValues: true });
  } catch {
    // Ignore errors if .env doesn't exist
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
// Prefer explicit service role key; fall back to legacy SUPABASE_KEY for compatibility
const supabaseServiceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_KEY");
// Use anon key for user-scoped clients; fall back to service key if not provided (dev convenience only)
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? supabaseServiceKey;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Type assertions after null checks to satisfy TypeScript
const url = supabaseUrl as string;
const serviceKey = supabaseServiceKey as string;
const anonKey = supabaseAnonKey as string;

// Service-role client: use ONLY for trusted server-side DB access
export const supabase = createClient(url, serviceKey);
export const supabaseService = supabase;

// Anon client without user token, suitable for public auth flows like sign-in/sign-up
export const supabaseAnon = createClient(url, anonKey);

// User-scoped client created from the user's access token; respects RLS
export function createUserClient(accessToken: string) {
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function getUserSession(token: string) {
  try {
    const userClient = createUserClient(token);
    const { data, error } = await userClient.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error("Session error:", error);
    return null;
  }
}
