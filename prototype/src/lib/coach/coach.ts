// Coach orchestration: guardrails -> retrieval -> (classifier) -> answer.
// Used by the API route and by the eval harness, so both test the same path.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { itemById } from "../../data/catalog";
import { detectLang, fallbackFor, getClient, isLive, MODELS } from "../llm";
import { planForPrompt } from "../path";
import { employeeById, profileForPrompt } from "../skills";
import type { Bilingual, Lang, LearningPlan, Level } from "../types";
import { demoAnswer } from "./demo";
import { precheck, SAFE_REPLIES, stricter, type Category } from "./guardrails";
import { buildUserTurn, CLASSIFIER_SYSTEM, COACH_SYSTEM } from "./prompt";
import { retrieve, type Retrieved } from "./retrieval";

export interface CoachInput {
  // In production the employee id comes from the SSO session, never the body.
  employeeId: string;
  messages: { role: "user" | "assistant"; content: string }[];
  lessonId?: string;
  plan?: LearningPlan;
  overrides?: Record<string, Level>;
  forceDemo?: boolean;
}

export interface SourceRef {
  n: number;
  sourceId: string;
  kind: "lesson" | "policy";
  title: Bilingual;
}

export interface CoachMeta {
  mode: "live" | "demo";
  lang: Lang;
  category: Category;
  rule?: string;
  classifier?: Category;
  sources: SourceRef[];
  pii: string[];
  model?: string;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
}

export interface Prepared {
  meta: CoachMeta;
  stream: () => AsyncGenerator<string>;
  usage: Usage; // filled once the stream completes (live mode)
}

const CATEGORIES = ["in_scope", "other_person_data", "hr_decision", "wellbeing", "crisis", "off_topic", "injection"] as const;
const ClassifierSchema = z.object({ category: z.enum(CATEGORIES), reason: z.string() });

async function classify(text: string): Promise<Category | undefined> {
  try {
    const res = await getClient().messages.parse({
      model: MODELS.classifier,
      max_tokens: 2000,
      system: CLASSIFIER_SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(ClassifierSchema) },
      messages: [{ role: "user", content: `<message>\n${text}\n</message>` }],
    });
    return res.parsed_output?.category;
  } catch (err) {
    console.error("classifier failed; deterministic verdict stands", err);
    return undefined;
  }
}

async function* chunked(text: string) {
  for (const piece of text.match(/[\s\S]{1,24}/g) ?? []) yield piece;
}

const toRefs = (sources: Retrieved[]): SourceRef[] =>
  sources.map((s, i) => ({ n: i + 1, sourceId: s.sourceId, kind: s.kind, title: s.title }));

export async function prepareCoach(input: CoachInput): Promise<Prepared> {
  const emp = employeeById(input.employeeId);
  if (!emp) throw new Error("unknown employee");
  const history = input.messages.slice(-9);
  const last = history[history.length - 1];
  if (!last || last.role !== "user") throw new Error("last message must be from the user");

  const lang = detectLang(last.content);
  const verdict = precheck(last.content, emp.id, emp.managerId);
  const live = isLive() && !input.forceDemo;

  const prevUser = [...history].reverse().slice(1).find((m) => m.role === "user");
  const query = `${verdict.redacted} ${prevUser ? prevUser.content.slice(0, 200) : ""}`;
  const sources = retrieve(query, lang, {
    pinned: input.lessonId ? [input.lessonId] : [],
    boost: input.plan?.steps.map((s) => s.itemId) ?? [],
  });

  let category = verdict.category;
  let classifier: Category | undefined;
  if (live && category === "in_scope") {
    classifier = await classify(verdict.redacted);
    if (classifier) category = stricter(category, classifier);
  }

  const meta: CoachMeta = { mode: live ? "live" : "demo", lang, category, rule: verdict.rule, classifier, sources: [], pii: verdict.piiFound };

  if (category !== "in_scope") {
    const reply = SAFE_REPLIES[category][lang];
    return { meta, stream: () => chunked(reply), usage: { input: 0, output: 0, cacheRead: 0 } };
  }

  if (!live) {
    const prevAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content;
    const out = demoAnswer({ emp, lang, lessonId: input.lessonId, message: verdict.redacted, prevAssistant, sources, plan: input.plan, overrides: input.overrides });
    meta.sources = toRefs(out.sources);
    return { meta, stream: () => chunked(out.text), usage: { input: 0, output: 0, cacheRead: 0 } };
  }

  meta.sources = toRefs(sources);
  meta.model = MODELS.coach;
  const lesson = input.lessonId ? itemById(input.lessonId) : undefined;
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.role === "user" ? precheck(m.content, emp.id, emp.managerId).redacted : m.content,
    })),
    {
      role: "user",
      content: buildUserTurn({
        profile: profileForPrompt(emp, input.overrides),
        plan: planForPrompt(input.plan, lang),
        lesson: lesson ? `${lesson.id}: ${lesson.title[lang]}` : undefined,
        sources,
        message: verdict.redacted,
      }),
    },
  ];

  const usage: Usage = { input: 0, output: 0, cacheRead: 0 };
  async function* stream() {
    const s = getClient().beta.messages.stream({
      model: MODELS.coach,
      max_tokens: 8000,
      system: [{ type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low" },
      messages,
      ...fallbackFor(MODELS.coach),
    });
    for await (const ev of s) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
    }
    const final = await s.finalMessage();
    usage.input = final.usage.input_tokens + (final.usage.cache_creation_input_tokens ?? 0);
    usage.output = final.usage.output_tokens;
    usage.cacheRead = final.usage.cache_read_input_tokens ?? 0;
    if (final.stop_reason === "refusal") yield lang === "th" ? "\n\nขออภัยค่ะ โค้ชตอบคำถามนี้ไม่ได้" : "\n\nSorry, I can't help with that one.";
  }
  return { meta, stream, usage };
}

// Non-streaming helper for the eval harness.
export async function askCoach(input: CoachInput) {
  const prepared = await prepareCoach(input);
  let text = "";
  for await (const piece of prepared.stream()) text += piece;
  return { ...prepared.meta, text, usage: prepared.usage };
}
