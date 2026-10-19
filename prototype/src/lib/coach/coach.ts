// Coach orchestration: guardrails -> retrieval -> (classifier) -> answer.
// Used by the API route and by the eval harness, so both test the same path.
import { z } from "zod";
import { itemById } from "../../data/catalog";
import { generateJSON, isLive, models, provider, streamText, type Usage } from "../ai";
import { detectLang } from "../llm";
import { planForPrompt } from "../path";
import { employeeById, profileForPrompt } from "../skills";
import type { Bilingual, Employee, Lang, LearningPlan, Level } from "../types";
import { continuesActivity, demoAnswer } from "./demo";
import { assessmentExplainPin, PII_REPLIES, precheck, programmePolicySource, SAFE_REPLIES, stricter, type Category } from "./guardrails";
import { buildUserTurn, CLASSIFIER_SYSTEM, COACH_SYSTEM } from "./prompt";
import { hasUnknownOfferTerm, retrieve, type Retrieved } from "./retrieval";

export interface CoachInput {
  // In production the employee id comes from the SSO session, never the body.
  employeeId: string;
  employee?: Employee; // Trusted server-owned record; never populated from request JSON.
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

export type AnswerSource = "model" | "safety_template" | "no_source" | "demo" | "provider_fallback";
export interface EvaluatedSource extends SourceRef { text: string }

export interface CoachMeta {
  // Mutable until the stream finishes. Send final metadata after the last text chunk.
  answerSource: AnswerSource;
  classifierStatus: "not_run" | "ok" | "unavailable";
  evaluatedSources: EvaluatedSource[]; // Exact passages in the model prompt, never fallback-only references.
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

const OWN_RECORD_REQUEST = /(my (results?|scores?|gaps?|plan|next step|progress)|explain my|where do i stand|what should i focus|how am i doing|keep (me )?going|what'?s next|after this (lesson|one|step)|ผลประเมินของฉัน|อธิบายผล|แผนของฉัน|ขั้นต่อไปของฉัน|ทำไปถึงไหน|ไปถึงไหนแล้ว|ความคืบหน้า|เรียนอะไรต่อ)/i;
const AFFIRMATIVE = /^\s*(yes|yeah|yep|ok|okay|sure|please|go ahead|let'?s|ได้|เอา|โอเค|ค่ะ|ครับ|ลอง|สนใจ)/i;
const NO_SOURCE: Record<Lang, string> = {
  en: "I don't have approved material on that topic. Please ask your manager or HR to confirm it.",
  th: "ยังไม่มีเนื้อหาที่ได้รับอนุมัติเกี่ยวกับเรื่องนี้ค่ะ กรุณาสอบถามหัวหน้าหรือ HR เพื่อยืนยันข้อมูลนะคะ",
};
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
    void err; // Provider details can contain sensitive response data; do not log them.
    return undefined;
  }
}

async function* chunked(text: string) {
  for (const piece of text.match(/[\s\S]{1,24}/g) ?? []) yield piece;
}

const toRefs = (sources: Retrieved[]): SourceRef[] =>
  sources.map((s, i) => ({ n: i + 1, sourceId: s.sourceId, kind: s.kind, title: s.title }));

export async function prepareCoach(input: CoachInput): Promise<Prepared> {
  const emp = input.employee ?? employeeById(input.employeeId);
  if (!emp) throw new Error("unknown employee");
  const history = input.messages.slice(-9);
  const last = history[history.length - 1];
  if (!last || last.role !== "user") throw new Error("last message must be from the user");

  const lang = detectLang(last.content);
  const verdict = precheck(last.content, emp.id, emp.managerId);
  const live = isLive() && !input.forceDemo;

  // Blocked categories win over PII handling (e.g. bulk scores + email → other_person_data).
  // In-scope turns that still contain PII never reach the model — R12 previously
  // summarised a plan after an ID paste.
  if (verdict.category === "in_scope" && verdict.piiFound.length > 0) {
    const meta: CoachMeta = {
      mode: live ? "live" : "demo",
      answerSource: "safety_template",
      classifierStatus: "not_run",
      evaluatedSources: [],
      lang,
      category: "in_scope",
      rule: "pii_refusal",
      sources: [],
      pii: verdict.piiFound,
    };
    return { meta, stream: () => chunked(PII_REPLIES[lang]), usage: { input: 0, output: 0, cacheRead: 0 } };
  }

  const policySource = programmePolicySource(verdict.redacted);
  const assessmentPin = !policySource ? assessmentExplainPin(verdict.redacted) : undefined;
  const namedOfferRequest = /(course|workshop|certificate|คอร์ส|หลักสูตร)/i.test(verdict.redacted)
    && !/(this (course|workshop)|open (course|workshop)|คอร์สนี้|หลักสูตรนี้)/i.test(verdict.redacted);
  const offerSources = namedOfferRequest ? retrieve(verdict.redacted, lang).filter((s) => s.kind === "lesson") : [];
  const unsupportedOffer = namedOfferRequest && (offerSources.length === 0 || hasUnknownOfferTerm(verdict.redacted)) && !policySource;
  const prevUser = [...history].reverse().slice(1).find((m) => m.role === "user");
  const prevAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content;
  // The learner is answering an activity the coach started (role-play, quick check, reflection).
  const continuing = continuesActivity(prevAssistant);
  // Only expand a short follow-up. An unrelated new question must not inherit sources.
  const shortYes = verdict.redacted.trim().length <= 40 && AFFIRMATIVE.test(verdict.redacted);
  const followUp = !namedOfferRequest && (shortYes || /^(and |what about|why|how so|แล้ว|ทำไม|ขออีก|อีกครั้ง)/i.test(verdict.redacted.trim()));
  const previous = prevUser ? precheck(prevUser.content, emp.id, emp.managerId).redacted : "";
  const query = `${verdict.redacted} ${followUp ? previous.slice(0, 200) : ""}`;
  const pinnedSource = policySource ?? assessmentPin ?? (input.lessonId ? input.lessonId : undefined);
  const retrieved = retrieve(query, lang, {
    pinned: pinnedSource ? [pinnedSource] : [],
    boost: input.plan?.steps.map((s) => s.itemId) ?? [],
  });
  // Chat beside a lesson: "summarise this" / "give an example" is about that lesson only,
  // so the model gets only that passage and cannot drift to a neighbouring one.
  const lessonRequest = input.lessonId && !policySource && !assessmentPin && !OWN_RECORD_REQUEST.test(last.content);
  const sources = unsupportedOffer ? [] : policySource || assessmentPin
    ? retrieved.filter((s) => s.sourceId === (policySource ?? assessmentPin))
    : lessonRequest ? retrieved.filter((s) => s.sourceId === input.lessonId) : retrieved;

  let category = verdict.category;
  let classifier: Category | undefined;
  if (live && category === "in_scope" && !policySource && !unsupportedOffer) {
    classifier = await classify(verdict.redacted);
    // "Off-topic" never overrides a question that matched approved content (e.g. "SBI คืออะไร").
    // The other categories (colleague data, pay, wellbeing, crisis, injection) always win.
    if (classifier && !(classifier === "off_topic" && sources.length > 0)) category = stricter(category, classifier);
  }

  const meta: CoachMeta = {
    mode: live ? "live" : "demo", answerSource: live ? "model" : "demo", lang, category,
    rule: verdict.rule, classifier, sources: [], evaluatedSources: [], pii: verdict.piiFound,
    classifierStatus: live && verdict.category === "in_scope" && !policySource && !unsupportedOffer ? (classifier ? "ok" : "unavailable") : "not_run",
  };

  if (category !== "in_scope") {
    meta.answerSource = "safety_template";
    const reply = SAFE_REPLIES[category][lang];
    return { meta, stream: () => chunked(reply), usage: { input: 0, output: 0, cacheRead: 0 } };
  }

  // An unsupported question is a deterministic abstention, never a model invitation
  // to fill the gap. Personal-record answers may use the trusted employee context.
  if (unsupportedOffer || (sources.length === 0 && !OWN_RECORD_REQUEST.test(verdict.redacted) && !continuing)) {
    meta.answerSource = "no_source";
    return { meta, stream: () => chunked(NO_SOURCE[lang]), usage: { input: 0, output: 0, cacheRead: 0 } };
  }

  // The retrieval-backed answer is the demo-mode reply, and in live mode the
  // fallback if the model provider fails before sending anything.
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

  // Keep the initial references exactly aligned with the live prompt. If the
  // fallback is used, replace references after the error, while evaluatedSources
  // continue to describe the actual model input.
  meta.sources = toRefs(sources);
  meta.evaluatedSources = sources.map((s, i) => ({ ...toRefs([s])[0], n: i + 1, text: s.text }));
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
        lang,
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
      if (!sent) throw new Error("empty model response");
    } catch (err) {
      meta.answerSource = "provider_fallback";
      if (sent) throw err;
      meta.sources = toRefs(merged);
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
