import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchYouTubeWithBackupFailover, getYouTubeApiKeys } from "../_shared/youtube-key-failover.ts";
import { getRequestUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require an authenticated user to prevent anonymous YouTube quota abuse.
  const user = await getRequestUser(req);
  if (!user) return unauthorized(corsHeaders);

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q');

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const keys = await getYouTubeApiKeys();
    console.log(`Searching YouTube for: ${query} using ${keys.length} API keys`);

    const result = await fetchYouTubeWithBackupFailover(
      keys,
      (apiKey) => `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${apiKey}`,
    );

    if (!result.ok) {
      console.warn('YouTube API failed, trying Piped fallback...');
      // Fallback to Piped search if YouTube API fails
      const pipedInstances = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.private.coffee',
        'https://piped-api.hostux.net',
        'https://pipedapi.cl7.it',
        'https://api-piped.mha.fi',
      ];

      for (const instance of pipedInstances) {
        try {
          const pipedUrl = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
          const pipedResponse = await fetch(pipedUrl, { signal: AbortSignal.timeout(5000) });
          if (pipedResponse.ok) {
            const pipedData = await pipedResponse.json();
            const items = Array.isArray(pipedData) ? pipedData : (pipedData.items || []);
            
            if (items.length > 0) {
              const pipedResults = items.map((item: any) => ({
                id: item.url?.split('v=')[1] || item.url?.split('/').pop() || item.id,
                title: item.title,
                thumbnail: item.thumbnail,
                channel: item.uploaderName || item.channelName,
                channelId: item.uploaderUrl?.split('/').pop() || item.uploaderUrl || item.channelId,
              }));

              console.log(`Found ${pipedResults.length} results via Piped fallback (${instance})`);
              return new Response(JSON.stringify(pipedResults), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }

        } catch (e) {
          console.error(`Piped fallback search failed for ${instance}:`, e.message);
        }
      }

      return new Response(
        JSON.stringify({ error: result.error }),
        { status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let results = (result.data.items || []).map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      channel: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
    }));

    // Drop YouTube Shorts / status clips so recommendations are full songs only.
    try {
      const ids = results.map((r: any) => r.id).filter(Boolean).join(',');
      if (ids) {
        const details = await fetchYouTubeWithBackupFailover(
          keys,
          (apiKey) => `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${apiKey}`,
        );
        if (details.ok) {
          const seconds = new Map<string, number>();
          for (const item of details.data.items || []) {
            const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(item.contentDetails?.duration || '');
            if (!m) continue;
            seconds.set(item.id, (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)));
          }
          const fullSongs = results.filter((r: any) => {
            const dur = seconds.get(r.id);
            if (dur !== undefined && dur < 75) return false;
            return !/#shorts?\b|\bshorts?\b\s*[|\-]|\breels?\b|whatsapp\s*status|\bringtone\b/i.test(r.title || '');
          });
          if (fullSongs.length > 0) results = fullSongs;
        }
      }
    } catch (e) {
      console.warn('Shorts filtering skipped:', (e as Error).message);
    }


    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in youtube-search function:', error);
    
    // Last ditch effort: try Piped fallback in catch block too
    try {
      const query = new URL(req.url).searchParams.get('q') || "";
      const pipedInstances = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.private.coffee',
        'https://piped-api.hostux.net',
        'https://pipedapi.cl7.it',
        'https://api-piped.mha.fi',
      ];

      for (const instance of pipedInstances) {
        try {
          const pipedUrl = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
          const pipedResponse = await fetch(pipedUrl, { signal: AbortSignal.timeout(5000) });
          if (pipedResponse.ok) {
            const pipedData = await pipedResponse.json();
            const items = Array.isArray(pipedData) ? pipedData : (pipedData.items || []);
            
            if (items.length > 0) {
              const pipedResults = items.map((item: any) => ({
                id: item.url?.split('v=')[1] || item.url?.split('/').pop() || item.id,
                title: item.title,
                thumbnail: item.thumbnail,
                channel: item.uploaderName || item.channelName,
                channelId: item.uploaderUrl?.split('/').pop() || item.uploaderUrl || item.channelId,
              }));

              return new Response(JSON.stringify(pipedResults), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (fallbackErr) {
      console.error('Fallback search also failed:', fallbackErr);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


