import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check current maintenance state
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();

    const currentMaintenance = settingsData?.value as { enabled: boolean; allowed_emails: string[]; [k: string]: unknown } | null;

    // Auto-maintenance checks
    const checks = {
      highErrorRate: false,
      dbOverload: false,
    };

    // Check for high error rate in recent activity logs
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentErrors } = await supabase
      .from("admin_activity_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fiveMinAgo)
      .eq("action_type", "error");

    if (recentErrors && recentErrors > 50) {
      checks.highErrorRate = true;
    }

    // Check for excessive concurrent sessions (e.g., DDOS indicator)
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recentLocations } = await supabase
      .from("user_locations")
      .select("*", { count: "exact", head: true })
      .gte("last_updated", oneMinAgo);

    if (recentLocations && recentLocations > 500) {
      checks.dbOverload = true;
    }

    const shouldEnableMaintenance = checks.highErrorRate || checks.dbOverload;
    const isCurrentlyEnabled = currentMaintenance?.enabled ?? false;

    // Only auto-enable, never auto-disable (admin should manually disable)
    if (shouldEnableMaintenance && !isCurrentlyEnabled) {
      const reason = [
        checks.highErrorRate ? "high error rate" : "",
        checks.dbOverload ? "unusual traffic spike" : "",
      ].filter(Boolean).join(", ");

      await supabase
        .from("app_settings")
        .update({
          // Keep every other field (e.g. the admin's custom_message) intact
          value: {
            ...(currentMaintenance || {}),
            enabled: true,
            allowed_emails: currentMaintenance?.allowed_emails || [],
          },
          updated_at: new Date().toISOString(),
        })
        .eq("key", "maintenance_mode");

      // Log the auto-maintenance event
      await supabase.from("admin_activity_logs").insert({
        admin_id: "00000000-0000-0000-0000-000000000000",
        admin_email: "system@auto-maintenance",
        action_type: "auto_maintenance",
        action_details: `Auto-maintenance triggered: ${reason}`,
      });

      return new Response(
        JSON.stringify({ activated: true, reason }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ activated: false, checks, currentlyEnabled: isCurrentlyEnabled }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
