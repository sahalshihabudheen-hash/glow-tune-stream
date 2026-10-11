import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { forbidden, getRequestUser, isAdmin, unauthorized } from "../_shared/auth.ts";

// Admin-only AI helper for the "What's new" editor, powered by Groq.
// The API key lives in the GROQ_API_KEY secret and never reaches the browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";

const MAX_TEXT = 500; // matches MAX_ITEM_TEXT in src/lib/updates.ts
const MAX_TITLE = 80;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LEN = 2000;
const MAX_CONTEXT_LEN = 6000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BASE_RULES = `You help the admin of "Nyra Pulse", a music streaming app, write release notes ("What's new") for end users.
Style: friendly, clear, plain text only. No markdown, no HTML, no hashtags. Emojis only if the admin's own text already uses them.
Never invent features that the admin did not mention.`;

async function callGroq(messages: { role: string; content: string }[], temperature: number, maxTokens: number) {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("AI is not configured (missing GROQ_API_KEY secret)");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("AI is rate limited right now. Try again in a moment.");
    const detail = await res.text();
    console.error("Groq error", res.status, detail);
    throw new Error("The AI service returned an error");
  }
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content;
  if (typeof out !== "string" || !out.trim()) throw new Error("The AI returned an empty answer");
  return out.trim();
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized(corsHeaders);
    if (!(await isAdmin(user.id, user.email))) return forbidden(corsHeaders);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode;

    // ---- Rewrite a single item: elaborate / shorten / polish ----
    if (mode === "rewrite") {
      const action = body.action as string;
      const title = clip(body.title, MAX_TITLE);
      const text = clip(body.text, MAX_TEXT);
      if (!["elaborate", "shorten", "polish"].includes(action)) return json({ error: "Invalid action" }, 400);
      if (!text && !title) return json({ error: "Write something first, then let AI rework it." }, 400);

      const instruction = {
        elaborate: `Expand the description into 2 or 3 friendly sentences that explain what changed and why users will like it. Keep it under ${MAX_TEXT - 40} characters.`,
        shorten: `Rewrite the description as one short, punchy sentence. Keep every important fact. Under 140 characters.`,
        polish: `Fix grammar and flow without changing the meaning or length much.`,
      }[action];

      const reply = await callGroq(
        [
          {
            role: "system",
            content: `${BASE_RULES}
You rewrite ONE release-note item. Reply with ONLY a JSON object: {"title": string, "text": string}.
"title" is a short feature name (max ${MAX_TITLE} characters, keep the admin's title unless it is empty). "text" is the description. No extra keys, no code fences.`,
          },
          { role: "user", content: `${instruction}\n\nTitle: ${title || "(empty)"}\nDescription: ${text || "(empty)"}` },
        ],
        0.5,
        400,
      );

      let parsed: { title?: string; text?: string } = {};
      try {
        parsed = JSON.parse(reply.replace(/^```(?:json)?|```$/g, "").trim());
      } catch {
        parsed = { text: reply };
      }
      return json({
        title: clip(parsed.title, MAX_TITLE) || title,
        text: clip(parsed.text, MAX_TEXT) || text,
      });
    }

    // ---- Free chat about the release being edited ----
    if (mode === "chat") {
      const incoming = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
      const messages = incoming
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m: any) => ({ role: m.role as string, content: clip(m.content, MAX_MESSAGE_LEN) }))
        .filter((m: { content: string }) => m.content);

      if (!messages.length || messages[messages.length - 1].role !== "user") {
        return json({ error: "Send a message first" }, 400);
      }

      const context = clip(body.context, MAX_CONTEXT_LEN);
      const reply = await callGroq(
        [
          {
            role: "system",
            content: `${BASE_RULES}
You are chatting with the admin inside the release editor. You can draft notes from rough bullet points, elaborate, shorten, rename features, or suggest which section (Added, Changed, Improved, Fixed, Removed) an item belongs to.
When you write a ready-to-use item, format it as "Title: ..." and "Text: ..." on separate lines. Each item text must be under ${MAX_TEXT} characters. Keep answers short.
${context ? `\nThe release currently being edited:\n${context}` : ""}`,
          },
          ...messages,
        ],
        0.6,
        700,
      );
      return json({ reply });
    }

    return json({ error: "Invalid mode" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
