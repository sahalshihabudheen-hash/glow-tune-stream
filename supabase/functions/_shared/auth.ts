import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Returns the authenticated user for the request, or null when the caller
 * did not provide a valid user session JWT. The anon/publishable key is
 * explicitly rejected so functions can require a real signed-in user.
 */
export async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!token || token === anonKey) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** Checks whether the given user has the admin role. */
export async function isAdmin(userId: string, _email?: string | null): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export const unauthorized = (corsHeaders: Record<string, string>, message = "Unauthorized") =>
  new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const forbidden = (corsHeaders: Record<string, string>, message = "Access denied") =>
  new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
