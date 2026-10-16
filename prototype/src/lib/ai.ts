// Provider layer. Three backends:
//   anthropic:  Claude API directly (official SDK; structured outputs, caching, refusal fallbacks)
//   opencode:   OpenCode's model gateway (https://opencode.ai/inference/v1). Claude and some Qwen
//               models speak the Anthropic Messages format there; Kimi, DeepSeek, GLM and MiniMax
//               speak OpenAI-style chat completions. (Its free tier is app-only, not API.)
//   workers-ai: Cloudflare Workers AI, free daily allowance. The Worker uses its AI binding; Node
//               scripts use the OpenAI-compatible REST endpoint with CLOUDFLARE_API_TOKEN.
// Picked by AI_PROVIDER, else by whichever key is set. Nothing configured = demo mode.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export type Provider = "anthropic" | "opencode" | "workers-ai";
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

type AIBinding = { run(model: string, inputs: Record<string, unknown>): Promise<unknown> };
let aiBinding: AIBinding | null = null;
/** Called by the Worker on each request with env.AI. */
export function setAIBinding(b: AIBinding | undefined) {
  aiBinding = b ?? null;
}
const workersAIReady = () => Boolean(aiBinding || (env("CLOUDFLARE_API_TOKEN") && env("CLOUDFLARE_ACCOUNT_ID")));

export function provider(): Provider | null {
  if (env("DEMO_MODE") === "1") return null;
  const forced = env("AI_PROVIDER");
  if (forced === "anthropic" || forced === "opencode") return forced;
  if (forced === "workers-ai") return workersAIReady() ? forced : null;
  if (env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN")) return "anthropic";
  if (env("OPENCODE_API_KEY")) return "opencode";
  return null;
}

export const isLive = () => provider() !== null;

// SEA-LION v4 (AI Singapore, tuned for Southeast Asian languages) gave the most natural Thai of
// the free-allowance models we tried; Qwen3 judges, so the coach is not grading itself.
const SEA_LION = "@cf/aisingapore/gemma-sea-lion-v4-27b-it";
const DEFAULTS: Record<Provider, { strong: string; classifier: string; judge: string }> = {
  anthropic: { strong: "claude-opus-5-5", classifier: "claude-haiku-5-5", judge: "claude-sonnet-5-5" },
  opencode: { strong: "claude-sonnet-5-5", classifier: "claude-haiku-5-5", judge: "claude-sonnet-5-5" },
  "workers-ai": { strong: SEA_LION, classifier: SEA_LION, judge: "@cf/qwen/qwen3-30b-a3b-fp8" },
};

export function models() {
  const d = DEFAULTS[provider() ?? "anthropic"];
  return {
    coach: env("COACH_MODEL") ?? d.strong,
    path: env("PATH_MODEL") ?? env("COACH_MODEL") ?? d.strong,
    classifier: env("CLASSIFIER_MODEL") ?? d.classifier,
    judge: env("JUDGE_MODEL") ?? d.judge,
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
  else if (p === "workers-ai") yield* streamWorkersAI(a);
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

// OpenAI-style /chat/completions: OpenCode, or Workers AI over REST (Node scripts).
function chatTarget() {
  return provider() === "workers-ai"
    ? { base: `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/ai/v1`, key: env("CLOUDFLARE_API_TOKEN"), name: "Workers AI" }
    : { base: OPENCODE_BASE(), key: env("OPENCODE_API_KEY"), name: "OpenCode" };
}

async function chatCompletions(a: ChatArgs, stream: boolean) {
  const t = chatTarget();
  const res = await fetch(`${t.base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${t.key}` },
    body: JSON.stringify({
      model: a.model,
      max_tokens: a.maxTokens,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      messages: [{ role: "system", content: a.system }, ...a.messages],
    }),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`${t.name} HTTP ${res.status}`);
  }
  return res;
}

// Workers AI streams either OpenAI-style chunks or legacy {"response": "..."} chunks.
type ChatChunk = {
  response?: string;
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

async function* streamOpencodeChat(a: ChatArgs) {
  yield* readSSE((await chatCompletions(a, true)).body!, a);
}

async function* streamWorkersAI(a: ChatArgs) {
  if (!aiBinding) {
    yield* streamOpencodeChat(a); // REST transport, same wire format
    return;
  }
  const out = await aiBinding.run(a.model, { messages: [{ role: "system", content: a.system }, ...a.messages], max_tokens: a.maxTokens, stream: true });
  yield* readSSE(out as ReadableStream<Uint8Array>, a);
}

async function* readSSE(body: ReadableStream<Uint8Array>, a: ChatArgs) {
  const reader = body.getReader();
  const dec = new TextDecoder("utf-8", { fatal: true });
  let buf = "";
  let stopped = false, bodyEnded = false;
  function frame(raw: string): { text?: string; done?: boolean } {
    const lines = raw.split("\n");
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
    if (event === "error") throw new Error("Model stream returned an error event");
    const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n").trim();
    if (!data) return {}; // SSE comments and keep-alive events carry no data.
    if (data === "[DONE]") return { done: true };
    let chunk: ChatChunk;
    try {
      const parsed: unknown = JSON.parse(data);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || "error" in parsed) throw new Error();
      chunk = parsed as ChatChunk;
    } catch { throw new Error("Model stream contained malformed data"); }
    if ((chunk.response !== undefined && typeof chunk.response !== "string") || (chunk.choices !== undefined && !Array.isArray(chunk.choices)) ||
      (chunk.response === undefined && chunk.choices === undefined && chunk.usage === undefined)) throw new Error("Model stream contained invalid data");
    const choice = chunk.choices?.[0];
    if (choice !== undefined && (!choice || typeof choice !== "object" || Array.isArray(choice) ||
      (choice.delta !== undefined && (!choice.delta || typeof choice.delta !== "object" || Array.isArray(choice.delta))))) throw new Error("Model stream contained invalid choice data");
    const text = choice?.delta?.content ?? chunk.response;
    if (text !== undefined && typeof text !== "string") throw new Error("Model stream contained invalid text");
    if (stopped && text) throw new Error("Model stream continued after its finish marker");
    if (choice?.finish_reason != null) {
      // OpenAI-compatible stop is a complete answer. Length, content filtering,
      // or a tool-call finish cannot certify this plain-text coach response.
      if (choice.finish_reason !== "stop") throw new Error("Model stream has an incomplete finish reason");
      stopped = true;
    }
    if (chunk.usage) a.onUsage?.({ input: chunk.usage.prompt_tokens ?? 0, output: chunk.usage.completion_tokens ?? 0, cacheRead: 0 });
    return { text };
  }
  try {
    for (;;) {
      const { done, value } = await reader.read();
      bodyEnded = done;
      buf = (buf + dec.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
      if (buf.length > 1_048_576) throw new Error("Model stream frame exceeds limit");
      let end: number;
      while ((end = buf.indexOf("\n\n")) >= 0) {
        const out = frame(buf.slice(0, end));
        buf = buf.slice(end + 2);
        if (out.text) yield out.text;
        if (out.done) return;
      }
      if (done) break;
    }
    if (buf.trim()) {
      const out = frame(buf);
      if (out.text) yield out.text;
      if (out.done) return;
    }
    // EOF alone proves only transport closure, not model completion. Legacy
    // Workers AI must send [DONE]; compatible streams may send finish_reason=stop.
    if (!stopped) throw new Error("Model stream ended without a completion terminal marker");
  } finally {
    if (!bodyEnded) await reader.cancel().catch(() => {});
    reader.releaseLock();
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
    if (p === "workers-ai" && aiBinding) {
      const out = (await aiBinding.run(a.model, { messages: [{ role: "system", content: system }, ...a.messages], max_tokens: a.maxTokens })) as {
        response?: unknown;
        choices?: { message?: { content?: string } }[];
      };
      const r = out.choices?.[0]?.message?.content ?? out.response;
      text = typeof r === "string" ? r : JSON.stringify(r ?? "");
    } else if (p === "opencode" && opencodeStyle(a.model) === "messages") {
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
