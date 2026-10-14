// Provider layer. Two backends:
//   anthropic: Claude API directly (official SDK; structured outputs, caching, refusal fallbacks)
//   opencode:  OpenCode's model gateway (https://opencode.ai/inference/v1). Claude and some Qwen
//              models speak the Anthropic Messages format there; Kimi, DeepSeek, GLM, MiniMax and
//              the free models speak OpenAI-style chat completions.
// Picked by AI_PROVIDER, else by whichever key is set. No key = demo mode.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export type Provider = "anthropic" | "opencode";
export type Effort = "low" | "medium" | "high";
export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
}
export interface ChatArgs {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  effort?: Effort;
  onUsage?: (u: Usage) => void;
}

// Read lazily: on Cloudflare Workers process.env is filled per request context.
const env = (k: string) => (typeof process !== "undefined" ? process.env?.[k] : undefined) || undefined;

export function provider(): Provider | null {
  if (env("DEMO_MODE") === "1") return null;
  const forced = env("AI_PROVIDER");
  if (forced === "anthropic" || forced === "opencode") return forced;
  if (env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN")) return "anthropic";
  if (env("OPENCODE_API_KEY")) return "opencode";
  return null;
}

export const isLive = () => provider() !== null;

export function models() {
  const p = provider();
  // Anthropic direct defaults to Opus 5.5 for coaching and paths. Via OpenCode the default is
  // Sonnet 5.5; switch to a cheaper or free gateway model with COACH_MODEL and re-run the eval.
  const strong = p === "opencode" ? "claude-sonnet-5-5" : "claude-opus-5-5";
  return {
    coach: env("COACH_MODEL") ?? strong,
    path: env("PATH_MODEL") ?? env("COACH_MODEL") ?? strong,
    classifier: env("CLASSIFIER_MODEL") ?? "claude-haiku-5-5",
    judge: env("JUDGE_MODEL") ?? "claude-sonnet-5-5",
  };
}

const OPENCODE_BASE = () => (env("OPENCODE_BASE_URL") ?? "https://opencode.ai/inference/v1").replace(/\/$/, "");

// Models OpenCode serves on its Anthropic-format /messages endpoint; everything else uses /chat/completions.
const OPENCODE_MESSAGES = new Set(["qwen3.8-flash", "qwen3.7-max", "qwen3.7-plus", "qwen3.6-plus", "qwen3.5-plus"]);
function opencodeStyle(model: string): "messages" | "chat" {
  const forced = env("OPENCODE_API_STYLE");
  if (forced === "messages" || forced === "chat") return forced;
  return model.startsWith("claude-") || OPENCODE_MESSAGES.has(model) ? "messages" : "chat";
}

let anthropicClient: Anthropic | null = null;
let opencodeClient: Anthropic | null = null;
function anthropic() {
  return (anthropicClient ??= new Anthropic());
}
function opencodeMessages() {
  // The SDK appends /v1/messages to baseURL; the gateway takes the key as a bearer token.
  return (opencodeClient ??= new Anthropic({ baseURL: OPENCODE_BASE().replace(/\/v1$/, ""), apiKey: null, authToken: env("OPENCODE_API_KEY") }));
}

// Server-side refusal fallback (Claude API only): a declined request is re-run on a fallback model.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);
const fallbackFor = (model: string) =>
  FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const } : {};

const REFUSED = "\n\n(The model declined to answer this one.)";

// ---------------------------------------------------------------- streaming text

export async function* streamText(a: ChatArgs): AsyncGenerator<string> {
  const p = provider();
  if (!p) throw new Error("No AI provider configured");
  if (p === "anthropic") yield* streamAnthropicDirect(a);
  else if (opencodeStyle(a.model) === "messages") yield* streamOpencodeMessages(a);
  else yield* streamOpencodeChat(a);
}

async function* streamAnthropicDirect(a: ChatArgs) {
  const s = anthropic().beta.messages.stream({
    model: a.model,
    max_tokens: a.maxTokens,
    system: [{ type: "text", text: a.system, cache_control: { type: "ephemeral" } }],
    ...(a.effort ? { output_config: { effort: a.effort } } : {}),
    messages: a.messages,
    ...fallbackFor(a.model),
  });
  for await (const ev of s) if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
  const final = await s.finalMessage();
  a.onUsage?.({
    input: final.usage.input_tokens + (final.usage.cache_creation_input_tokens ?? 0),
    output: final.usage.output_tokens,
    cacheRead: final.usage.cache_read_input_tokens ?? 0,
  });
  if (final.stop_reason === "refusal") yield REFUSED;
}

async function* streamOpencodeMessages(a: ChatArgs) {
  // Plain Messages request: gateway support for beta features is not guaranteed.
  const s = opencodeMessages().messages.stream({ model: a.model, max_tokens: a.maxTokens, system: a.system, messages: a.messages });
  for await (const ev of s) if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
  const final = await s.finalMessage();
  a.onUsage?.({ input: final.usage.input_tokens, output: final.usage.output_tokens, cacheRead: final.usage.cache_read_input_tokens ?? 0 });
  if (final.stop_reason === "refusal") yield REFUSED;
}

async function chatCompletions(a: ChatArgs, stream: boolean) {
  const res = await fetch(`${OPENCODE_BASE()}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("OPENCODE_API_KEY")}` },
    body: JSON.stringify({
      model: a.model,
      max_tokens: a.maxTokens,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      messages: [{ role: "system", content: a.system }, ...a.messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenCode ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

type ChatChunk = { choices?: { delta?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };

async function* streamOpencodeChat(a: ChatArgs) {
  const res = await chatCompletions(a, true);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const chunk = JSON.parse(data) as ChatChunk;
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield text;
        if (chunk.usage) a.onUsage?.({ input: chunk.usage.prompt_tokens ?? 0, output: chunk.usage.completion_tokens ?? 0, cacheRead: 0 });
      } catch {
        // keep-alive or partial line; ignore
      }
    }
  }
}

// ---------------------------------------------------------------- structured JSON

/**
 * Returns an object that passes `schema`, or null. Anthropic direct uses
 * structured outputs; OpenCode models get a JSON-only instruction and the
 * reply is validated with the same schema (one retry).
 */
export async function generateJSON<T>(a: Omit<ChatArgs, "onUsage"> & { schema: z.ZodType<T>; shape: string }): Promise<T | null> {
  const p = provider();
  if (!p) return null;
  if (p === "anthropic") {
    const res = await anthropic().beta.messages.parse({
      model: a.model,
      max_tokens: a.maxTokens,
      system: a.system,
      output_config: { ...(a.effort ? { effort: a.effort } : {}), format: betaZodOutputFormat(a.schema) },
      messages: a.messages,
      ...fallbackFor(a.model),
    });
    return res.stop_reason === "refusal" ? null : ((res.parsed_output as T | null) ?? null);
  }
  const system = `${a.system}\n\nReply with ONLY one JSON object, no prose and no code fences, with this shape:\n${a.shape}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let text = "";
    if (opencodeStyle(a.model) === "messages") {
      const res = await opencodeMessages().messages.create({ model: a.model, max_tokens: a.maxTokens, system, messages: a.messages });
      for (const b of res.content) if (b.type === "text") text += b.text;
    } else {
      const res = await chatCompletions({ ...a, system }, false);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      text = body.choices?.[0]?.message?.content ?? "";
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) continue;
    try {
      const parsed = a.schema.safeParse(JSON.parse(match[0]));
      if (parsed.success) return parsed.data;
    } catch {
      // invalid JSON; retry once
    }
  }
  return null;
}
