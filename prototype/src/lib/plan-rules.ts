// Rules engine for learning paths (no model calls, safe to import on the
// client). Shortlists approved catalogue items per skill gap and builds a
// deterministic plan; the AI layer in path.ts only re-sequences this shortlist.
import { CATALOG, itemById } from "../data/catalog";
import { certifiedLevels } from "../data/certificates";
import { roleById, skillById } from "../data/taxonomy";
import { nextRoleGaps, profile } from "./skills";
import type { Employee, Gap, LearningItem, LearningPlan, Level, PlanStep } from "./types";

export const PLAN_START = "2026-10-26";
export const MAX_STEPS = 8;
const FORMAT_ORDER = { video: 0, workshop: 1, project: 2 } as const;

/** What the employee told us in the skill check. Omitted fields keep the original behaviour. */
export interface LearningContext {
  minutesPerMonth?: number;
  certificates?: string[];
}

// An item is skipped when certificates already prove every skill it teaches, at its target level.
const coveredByCertificates = (item: LearningItem, certified: Record<string, Level>) =>
  item.skills.every((s) => (certified[s.skillId] ?? 0) >= s.targetLevel);

/** Keeps self-paced videos within about three months of the monthly learning time; the first video always stays. */
export function fitToLearningTime<T extends { itemId: string }>(steps: T[], minutesPerMonth?: number): T[] {
  if (!minutesPerMonth) return steps;
  const budget = minutesPerMonth * 3;
  let used = 0;
  return steps.filter((step) => {
    const item = itemById(step.itemId);
    if (item?.format !== "video") return true;
    if (used > 0 && used + item.minutes > budget) return false;
    used += item.minutes;
    return true;
  });
}

export function shortlist(emp: Employee, overrides?: Record<string, Level>, context: LearningContext = {}) {
  const certified = certifiedLevels(context.certificates);
  // Employees in a terminal role have no next-role gaps; develop the current role instead.
  const nextGaps = nextRoleGaps(emp, overrides);
  const gaps = nextGaps.length
    ? nextGaps
    : profile(emp, overrides)
        .current.filter((g) => g.gap > 0)
        .sort((a, b) => Number(b.critical) - Number(a.critical) || b.gap - a.gap);
  const gapSkills = new Set(gaps.map((g) => g.skillId));
  return gaps.map((gap) => {
    const items = CATALOG.filter((item) =>
      item.skills.some((s) => s.skillId === gap.skillId && s.targetLevel > gap.current && s.targetLevel <= gap.required) &&
      !coveredByCertificates(item, certified),
    )
      .map((item) => ({
        item,
        score: (item.content ? 3 : 0) + (item.format === "project" ? 1 : 0) + item.skills.filter((s) => s.skillId !== gap.skillId && gapSkills.has(s.skillId)).length,
      }))
      .sort((a, b) => b.score - a.score)
      // Prefer items with real lesson content; generic catalogue entries only fill gaps that have none.
      .filter((x, _, all) => x.item.content || !all.some((y) => y.item.content))
      .slice(0, 3)
      .map((x) => x.item);
    return { gap, items };
  });
}

const weekOf = (date: string) => Math.max(1, Math.min(12, Math.floor((Date.parse(date) - Date.parse(PLAN_START)) / (7 * 864e5)) + 1));

function rationale(gap: Gap, item: LearningItem, targetRole: { en: string; th: string }) {
  const s = skillById(gap.skillId);
  const why = {
    video: { en: "Short video you can watch on a break.", th: "วิดีโอสั้น ดูได้ช่วงพัก" },
    workshop: { en: "Practise with others in person; needs manager approval.", th: "ฝึกกับผู้อื่นในห้องเรียน ต้องให้หัวหน้าอนุมัติ" },
    project: { en: "Apply it on the job; your manager signs off the evidence.", th: "นำไปใช้จริงในงาน หัวหน้าเป็นผู้อนุมัติหลักฐาน" },
  }[item.format];
  return {
    en: `Builds ${s.name.en} from L${gap.current} to L${gap.required}${gap.critical ? `, a critical skill for ${targetRole.en}` : ""}. ${why.en}`,
    th: `พัฒนา${s.name.th}จากระดับ ${gap.current} เป็น ${gap.required}${gap.critical ? ` ซึ่งเป็นทักษะสำคัญของตำแหน่ง${targetRole.th}` : ""} ${why.th}`,
  };
}

export function rulesPlan(emp: Employee, overrides?: Record<string, Level>, context: LearningContext = {}): LearningPlan {
  const target = roleById(emp.nextRoleId ?? emp.roleId);
  const chosen: { gap: Gap; item: LearningItem; itemId: string }[] = [];
  for (const { gap, items } of shortlist(emp, overrides, context)) {
    const learn = items.find((i) => i.format === "video");
    const apply = items.find((i) => i.format !== "video");
    for (const item of [learn, apply]) if (item && !chosen.some((c) => c.item.id === item.id)) chosen.push({ gap, item, itemId: item.id });
  }
  // Highest-priority gaps come first, so the time limit drops the least important lessons.
  const picked = fitToLearningTime(chosen, context.minutesPerMonth).slice(0, MAX_STEPS);
  const steps: PlanStep[] = picked.map(({ gap, item }, i) => ({
    itemId: item.id,
    skillId: gap.skillId,
    order: i + 1,
    week: item.sessions?.[0] ? weekOf(item.sessions[0].date) : Math.min(12, 1 + Math.floor((i * 12) / Math.max(1, picked.length))),
    rationale: rationale(gap, item, target.title),
    status: "todo",
  }));
  steps.sort((a, b) => a.week - b.week || FORMAT_ORDER[itemById(a.itemId)!.format] - FORMAT_ORDER[itemById(b.itemId)!.format]);
  steps.forEach((s, i) => (s.order = i + 1));
  const hours = context.minutesPerMonth ? Math.round(context.minutesPerMonth / 60) : 0;
  return {
    employeeId: emp.id,
    targetRoleId: target.id,
    status: "draft",
    steps,
    summary: {
      en: `A 12-week path to ${target.title.en}: critical gaps first, each skill learned by video then applied on the job.${hours ? ` Sized for about ${hours} ${hours === 1 ? "hour" : "hours"} of lessons a month.` : ""}`,
      th: `เส้นทาง 12 สัปดาห์สู่ตำแหน่ง${target.title.th}: เริ่มจากทักษะสำคัญก่อน เรียนจากวิดีโอแล้วนำไปใช้จริงในงาน${hours ? ` จัดให้พอดีกับเวลาเรียนประมาณ ${hours} ชั่วโมงต่อเดือน` : ""}`,
    },
    generatedBy: "rules",
  };
}

export const planForPrompt = (plan: LearningPlan | undefined, lang: "th" | "en") =>
  plan?.steps
    .map((s) => {
      const item = itemById(s.itemId);
      return item ? `${s.order}. [${s.status}] week ${s.week}: ${item.title[lang]} (${item.format}, ${item.minutes} min)` : "";
    })
    .join("\n");
