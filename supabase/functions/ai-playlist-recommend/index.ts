import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getRequestUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SeedTrack {
  title?: string;
  channel?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized(corsHeaders);

    const body = await req.json().catch(() => ({}));
    const seeds: SeedTrack[] = Array.isArray(body?.tracks) ? body.tracks.slice(0, 25) : [];
    const count = Math.min(Math.max(Number(body?.count) || 12, 4), 15);

    if (seeds.length === 0) {
      return new Response(JSON.stringify({ error: "No playlist tracks provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const seedList = seeds
      .map((t) => `- ${String(t.title || "").slice(0, 120)} — ${String(t.channel || "").slice(0, 80)}`)
      .join("\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        input: [
          {
            role: "system",
            content: `You are a music curator. Analyse the user's playlist and build a NEW playlist of exactly ${count} songs that fit its vibe, era, language and genres.
Hard rules:
- NEVER include any song that already appears in the user's playlist (no duplicates, no alternate versions/remixes of those same songs).
- Every suggestion must be a different song by a real, existing artist.
- Prefer a mix: some songs by the same artists the user likes, some fresh discoveries.
Respond with ONLY valid JSON, no markdown:
{"vibe":"short description of the playlist vibe","songs":[{"title":"Song","artist":"Artist"}]}`,
          },
          {
            role: "user",
            content: `My playlist:\n${seedList}\n\nSuggest ${count} different songs.`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      const message =
        status === 429
          ? "Rate limited, please try again in a moment"
          : status === 402
          ? "AI credits exhausted — add credits to keep generating playlists"
          : status === 403
          ? "AI access is blocked for this workspace"
          : "AI request failed";
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content: string =
      aiData.output_text ??
      (Array.isArray(aiData.output)
        ? aiData.output
            .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
            .map((part: any) => part?.text || "")
            .join("")
        : "");

    let parsed: any;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const seedTitles = new Set(
      seeds.map((t) => String(t.title || "").toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean)
    );
    const songs = (Array.isArray(parsed?.songs) ? parsed.songs : [])
      .filter((s: any) => s?.title && s?.artist)
      .filter((s: any) => {
        const norm = String(s.title).toLowerCase().replace(/[^a-z0-9]/g, "");
        return norm && ![...seedTitles].some((seed) => seed.includes(norm) || norm.includes(seed));
      })
      .slice(0, count);

    return new Response(JSON.stringify({ vibe: parsed?.vibe || "", songs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-playlist-recommend error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
