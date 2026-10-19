// Learning path generation. A rules engine shortlists approved catalogue items
// per skill gap; the LLM only sequences that shortlist and writes the
// rationale. Output is validated against catalogue ids, so the model can
// never invent a course. The manager approves the result.
import { z } from "zod";
import { skillById } from "../data/taxonomy";
import { generateJSON, isLive, models } from "./ai";
import { MAX_STEPS, PLAN_START, rulesPlan, shortlist } from "./plan-rules";
import { profileForPrompt } from "./skills";
import type { Employee, LearningPlan, Level, PlanStep } from "./types";

export { planForPrompt, rulesPlan, shortlist } from "./plan-rules";

const PlanSchema = z.object({
  summary_en: z.string(),
  summary_th: z.string(),
  steps: z.array(
    z.object({
      itemId: z.string(),
      skillId: z.string(),
      week: z.number(),
      rationale_en: z.string(),
      rationale_th: z.string(),
    }),
  ),
});

const PATH_SYSTEM = `You design a 12-week personal learning path for one employee of a large Thai company.
Rules:
- Use only items from the shortlist, by exact itemId. Do not invent items.
- At most ${MAX_STEPS} steps. Cover every critical gap. Prefer learn (video) before practise (workshop) before apply (project) for the same skill.
- Paid learning time is 2 hours per month for videos and workshops; projects happen on the job. Spread the load across the 12 weeks.
- Workshops must be scheduled in the week of one of their listed sessions (week 1 starts ${PLAN_START}).
- Write each rationale in one sentence that a frontline employee understands: what gap it closes and why this item, in both English and natural Thai (polite, simple).
- The summary is two sentences in each language.`;

export async function aiPlan(emp: Employee, overrides?: Record<string, Level>): Promise<LearningPlan> {
  const base = rulesPlan(emp, overrides);
  if (!isLive()) return base;
  const list = shortlist(emp, overrides);
  const allowed = new Map(list.flatMap(({ gap, items }) => items.map((i) => [i.id, { item: i, gap }] as const)));
  const shortlistText = list
    .map(({ gap, items }) =>
      `Gap ${gap.skillId} (${skillById(gap.skillId).name.en}) L${gap.current}->L${gap.required}${gap.critical ? " CRITICAL" : ""}:\n` +
      items.map((i) => `  - ${i.id} | ${i.format} | ${i.minutes} min | ${i.title.en}${i.sessions ? ` | sessions: ${i.sessions.map((s) => s.date).join(", ")}` : ""}`).join("\n"),
    )
    .join("\n");
  try {
    const out = await generateJSON({
      model: models().path,
      maxTokens: 16000,
      effort: "medium",
      system: PATH_SYSTEM,
      messages: [{ role: "user", content: `<employee>\n${profileForPrompt(emp, overrides)}\n</employee>\n\n<shortlist>\n${shortlistText}\n</shortlist>` }],
      schema: PlanSchema,
      shape: '{"summary_en": string, "summary_th": string, "steps": [{"itemId": string, "skillId": string, "week": number, "rationale_en": string, "rationale_th": string}]}',
    });
    if (!out) return base;
    const seen = new Set<string>();
    const steps: PlanStep[] = out.steps
      .filter((s) => allowed.has(s.itemId) && !seen.has(s.itemId) && seen.add(s.itemId))
      .slice(0, MAX_STEPS)
      .map((s, i) => ({
        itemId: s.itemId,
        skillId: allowed.get(s.itemId)!.gap.skillId,
        order: i + 1,
        week: Math.max(1, Math.min(12, Math.round(s.week))),
        rationale: { en: s.rationale_en, th: s.rationale_th },
        status: "todo",
      }));
    // Guarantee coverage of critical gaps even if the model skipped one.
    for (const { gap } of list.filter((l) => l.gap.critical)) {
      if (!steps.some((s) => s.skillId === gap.skillId)) {
        const fill = base.steps.find((s) => s.skillId === gap.skillId);
        if (fill && steps.length < MAX_STEPS) steps.push({ ...fill, order: steps.length + 1 });
      }
    }
    if (!steps.length) return base;
    steps.sort((a, b) => a.week - b.week);
    steps.forEach((s, i) => (s.order = i + 1));
    return { ...base, steps, summary: { en: out.summary_en, th: out.summary_th }, generatedBy: "ai" };
  } catch {
    // Provider details can contain sensitive response data; do not log them.
    return base;
  }
}

