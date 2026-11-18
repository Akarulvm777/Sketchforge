// Sketchforge AI helper: answers questions about the app (where things are, how to use a tool, fixing problems).
// It never makes art for people. Deployed as the Supabase Edge Function "ask"; needs the secret ANTHROPIC_API_KEY
// (Dashboard -> Edge Functions -> Secrets). Optional secrets: AI_DAILY_LIMIT (questions per user per day, default 40).
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { KNOWLEDGE } from "./knowledge.ts";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const DAILY = Number(Deno.env.get("AI_DAILY_LIMIT") || 40);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// Frozen system prompt (cached): the rules first, then the generated knowledge of the app.
const SYSTEM = `You are the Sketchforge Helper, the assistant built into Sketchforge, a drawing and animation app.
You help people use the app: find a tool, menu or setting, explain what an option does, give short step-by-step
instructions, and fix problems (pen pressure, exporting, saving, installing, updates, accounts).

How to answer:
- Be brief and concrete: name the exact menu path or button (e.g. "Animation › Repeat frames…", "the ＋ New drawing button in the timeline").
- Reply in the language the person writes in.
- You can add buttons to your answer. [[cmd:ID|Label]] runs an app command, [[tut:ID|Label]] opens a guided tutorial.
  Only use IDs that appear in the knowledge below; add at most three buttons.
- If you are not sure a feature exists, say so instead of inventing it.

What you do not do:
- You never create, draw, paint, sketch, trace, finish, colour, describe-for-tracing or "improve" artwork, characters
  or images for the person, and you do not write prompts for image generators. The art is theirs to make. You can
  still explain which tools and settings to use and how they work.
- If someone asks why you won't draw for them, answer: "AI is not supposed to steal your job." Then offer to show
  them the tools that help.
- Politely steer unrelated questions back to Sketchforge.

${KNOWLEDGE}`;

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // signed-in users only
  const auth = req.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Please sign in to use the AI helper." }, 401);

  let body: { messages?: Msg[]; context?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!history.length || history[history.length - 1].role !== "user") return json({ error: "Ask a question first." }, 400);
  while (history.length && history[0].role !== "user") history.shift();

  // daily limit per person
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: left, error: limErr } = await admin.rpc("ai_take", { uid: user.id, max_per_day: DAILY });
  if (limErr) return json({ error: "The helper is not set up yet (database)." }, 500);
  if (left === -1) return json({ error: `You reached today's limit of ${DAILY} questions. It resets tomorrow.` }, 429);

  // what the person is doing right now goes with the last question (not in the cached system prompt)
  const ctx = body.context || {};
  const where = `[App ${String(ctx.version || "?")}, ${String(ctx.platform || "?")}, workspace: ${String(ctx.mode || "?")}, tool: ${String(ctx.tool || "?")}]`;
  const messages = history.map((m, i) => (i === history.length - 1 ? { ...m, content: `${where}\n${m.content}` } : m));

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (response.stop_reason === "refusal") return json({ text: "Sorry, I can't help with that one. Ask me anything about using Sketchforge!", left });
    const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    return json({ text: text || "Sorry, I don't have an answer for that.", left });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The helper is busy, try again in a minute." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "The helper is not set up yet (API key)." }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: `The helper had a problem (${e.status}). Try again.` }, 502);
    return json({ error: "The helper could not be reached. Try again." }, 502);
  }
});
