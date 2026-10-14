import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  coach: process.env.COACH_MODEL ?? "claude-opus-5-5",
  path: process.env.PATH_MODEL ?? process.env.COACH_MODEL ?? "claude-opus-5-5",
  classifier: process.env.CLASSIFIER_MODEL ?? "claude-haiku-5-5",
  judge: process.env.JUDGE_MODEL ?? "claude-sonnet-5-5",
};

export const isLive = () =>
  process.env.DEMO_MODE !== "1" && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
export const getClient = () => (client ??= new Anthropic());

// Server-side refusal fallback: on a policy decline the API re-runs the same
// request on a fallback model inside the same call. Only some models take it.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);
export function fallbackFor(model: string) {
  return FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const }
    : {};
}

export const detectLang = (text: string): "th" | "en" => (/[฀-๿]/.test(text) ? "th" : "en");
