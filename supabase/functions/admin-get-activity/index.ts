import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is authenticated
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

    // Check if user is admin
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

    // Fetch listening history with user info
    const { data: historyData, error: historyError } = await supabaseAdmin
      .from("listening_history")
      .select("*")
      .order("played_at", { ascending: false })
      .limit(100);

    if (historyError) {
      console.error("Error fetching history:", historyError);
    }

    // Fetch all playlists with their items
    const { data: playlistsData, error: playlistsError } = await supabaseAdmin
      .from("playlists")
      .select(`
        id,
        name,
        description,
        user_id,
        created_at,
        playlist_items (
          id,
          track_id,
          track_title,
          track_thumbnail,
          track_channel
        )
      `)
      .order("created_at", { ascending: false });

    if (playlistsError) {
      console.error("Error fetching playlists:", playlistsError);
    }

    // Get user emails for the data
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    const userEmailMap: Record<string, string> = {};
    if (!usersError && users) {
      users.forEach(u => {
        userEmailMap[u.id] = u.email || "Unknown";
      });
    }

    // Attach user emails to history
    const historyWithUsers = (historyData || []).map(h => ({
      ...h,
      user_email: userEmailMap[h.user_id] || "Unknown",
    }));

    // Attach user emails to playlists
    const playlistsWithUsers = (playlistsData || []).map(p => ({
      ...p,
      user_email: userEmailMap[p.user_id] || "Unknown",
    }));

    return new Response(
      JSON.stringify({
        listeningHistory: historyWithUsers,
        playlists: playlistsWithUsers,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Admin activity error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
