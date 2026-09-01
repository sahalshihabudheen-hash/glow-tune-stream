import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!roleData;

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied. Admin only." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ALL users across pages (the default page only returns 50).
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 100;
    let fetchedCount = 0;

    do {
      const { data: { users: pageUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listError) {
        throw listError;
      }
      if (!pageUsers || pageUsers.length === 0) {
        break;
      }
      allUsers.push(...pageUsers);
      fetchedCount = pageUsers.length;
      page++;
    } while (fetchedCount === perPage);

    // Fetch all user locations with device info
    const { data: locations } = await supabaseAdmin
      .from("user_locations")
      .select("user_id, country, state, city, timezone, isp, last_updated, device_type, device_info, is_vpn");

    // Fetch all user roles
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    // Fetch all profiles (username + avatar)
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url");

    const locationMap = new Map();
    if (locations) {
      locations.forEach((loc: any) => {
        locationMap.set(loc.user_id, loc);
      });
    }

    const roleMap = new Map<string, string[]>();
    if (roles) {
      roles.forEach((r: any) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });
    }

    const profileMap = new Map();
    if (profiles) {
      profiles.forEach((p: any) => {
        profileMap.set(p.user_id, p);
      });
    }

    const safeUsers = allUsers.map((u) => {
      const loc = locationMap.get(u.id);
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        roles: roleMap.get(u.id) || [],
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
        location: loc ? {
          country: loc.country,
          state: loc.state,
          city: loc.city,
          timezone: loc.timezone,
          isp: loc.isp,
          last_updated: loc.last_updated,
          device_type: loc.device_type,
          device_info: loc.device_info,
          is_vpn: loc.is_vpn || false,
        } : null,
      };
    });

    return new Response(
      JSON.stringify({ users: safeUsers }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
