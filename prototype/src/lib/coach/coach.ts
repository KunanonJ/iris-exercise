// Coach orchestration: guardrails -> retrieval -> (classifier) -> answer.
// Used by the API route and by the eval harness, so both test the same path.
import { z } from "zod";
import { itemById } from "../../data/catalog";
import { generateJSON, isLive, models, provider, streamText, type Usage } from "../ai";
import { detectLang } from "../llm";
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
  provider?: string;
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
    const out = await generateJSON({
      model: models().classifier,
      maxTokens: 2000,
      effort: "low",
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: `<message>\n${text}\n</message>` }],
      schema: ClassifierSchema,
      shape: `{"category": one of ${CATEGORIES.map((c) => `"${c}"`).join(" | ")}, "reason": string}`,
    });
    return out?.category;
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

  // The retrieval-backed answer is the demo-mode reply, and in live mode the
  // fallback if the model provider fails before sending anything.
  const prevAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content;
  const retrievalAnswer = demoAnswer({ emp, lang, lessonId: input.lessonId, message: verdict.redacted, prevAssistant, sources, plan: input.plan, overrides: input.overrides });

  if (!live) {
    meta.sources = toRefs(retrievalAnswer.sources);
    return { meta, stream: () => chunked(retrievalAnswer.text), usage: { input: 0, output: 0, cacheRead: 0 } };
  }

  // Live sources come first (the model cites them as S1..Sn); sources only the
  // fallback answer uses are appended so its citations still resolve.
  const merged = [...sources, ...retrievalAnswer.sources.filter((f) => !sources.some((s) => s.sourceId === f.sourceId))];
  const fallbackText = retrievalAnswer.text.replace(/\[S(\d+)\]/g, (m, n) => {
    const src = retrievalAnswer.sources[Number(n) - 1];
    const i = src ? merged.findIndex((x) => x.sourceId === src.sourceId) : -1;
    return i >= 0 ? `[S${i + 1}]` : m;
  });
  const unavailable = lang === "th" ? "\n\n(ตอนนี้ AI ไม่พร้อมใช้งาน คำตอบนี้มาจากเนื้อหาบทเรียนโดยตรง)" : "\n\n(The AI is unavailable right now; this answer comes straight from the lesson content.)";

  meta.sources = toRefs(merged);
  meta.model = models().coach;
  meta.provider = provider() ?? undefined;
  const lesson = input.lessonId ? itemById(input.lessonId) : undefined;
  const messages: { role: "user" | "assistant"; content: string }[] = [
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
    let sent = false;
    try {
      for await (const piece of streamText({
        model: models().coach,
        maxTokens: 8000,
        effort: "low",
        system: COACH_SYSTEM,
        messages,
        onUsage: (u) => Object.assign(usage, u),
      })) {
        sent = true;
        yield piece;
      }
    } catch (err) {
      if (sent) throw err;
      console.error("model provider failed; serving the retrieval answer", err);
      yield* chunked(fallbackText + unavailable);
    }
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
