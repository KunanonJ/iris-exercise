// "Keep going" nudges built only from the learner's own plan: progress, the
// next step and what it takes. Shared by the coach replies and the home card.
import { itemById } from "../../data/catalog";
import type { Lang, LearningPlan, PlanStep } from "../types";

export interface Nudge {
  done: number;
  total: number;
  awaiting: number; // project evidence waiting for manager sign-off
  next?: PlanStep;
  text: string;
}

// First step the learner can act on: not done and not waiting on the manager.
// With `afterItemId`, only steps that come after that item in the plan.
export function nextStep(plan: LearningPlan | undefined, afterItemId?: string): PlanStep | undefined {
  if (!plan) return undefined;
  const steps = [...plan.steps].sort((a, b) => a.order - b.order);
  const from = afterItemId ? steps.findIndex((s) => s.itemId === afterItemId) + 1 : 0;
  return steps.slice(from).find((s) => s.status === "todo" || s.status === "in_progress");
}

export function progressNudge(plan: LearningPlan | undefined, lang: Lang, afterItemId?: string): Nudge {
  const th = lang === "th";
  if (!plan || plan.steps.length === 0) {
    return {
      done: 0, total: 0, awaiting: 0,
      text: th
        ? "คุณยังไม่มีแผนการเรียนค่ะ เมื่อหัวหน้าอนุมัติผลประเมินแล้ว สร้างแผนได้ที่แท็บแผนการเรียนนะคะ"
        : "You don't have a learning plan yet. Once your assessment is approved, build one from the Learning path tab.",
    };
  }
  const total = plan.steps.length;
  const done = plan.steps.filter((s) => s.status === "done").length;
  const awaiting = plan.steps.filter((s) => s.status === "submitted").length;
  const next = nextStep(plan, afterItemId);
  const item = next && itemById(next.itemId);
  const lines: string[] = [];

  lines.push(done === 0
    ? (th ? "คุณยังไม่ได้เริ่มเรียนตามแผนค่ะ" : "You haven't started your plan yet.")
    : (th ? `คุณเรียนจบแล้ว ${done} จาก ${total} ขั้นตอนค่ะ` : `You've completed ${done} of ${total} steps.`));
  if (awaiting) lines.push(th ? `อีก ${awaiting} ขั้นตอนรอหัวหน้าอนุมัติหลักฐานอยู่นะคะ` : `${awaiting} waiting for your manager's sign-off.`);

  if (!item || !next) {
    lines.push(done === total
      ? (th ? "คุณเรียนครบทุกขั้นตอนในแผนแล้ว เก่งมากค่ะ ลองคุยกับหัวหน้าเรื่องเป้าหมายถัดไปนะคะ" : "That's every step in your plan. Great work. Ask your manager what to aim for next.")
      : afterItemId
        ? (th ? "บทนี้เป็นขั้นตอนสุดท้ายที่คุณทำได้ตอนนี้ค่ะ" : "This is the last step you can take for now.")
        : (th ? "ตอนนี้ไม่มีขั้นตอนที่รอคุณทำอยู่ค่ะ" : "Nothing is waiting on you right now."));
    return { done, total, awaiting, next, text: lines.join(" ") };
  }

  lines.push(th
    ? `ขั้นต่อไปคือ "${item.title.th}" (${item.minutes} นาที สัปดาห์ที่ ${next.week})`
    : `Next up: "${item.title.en}" (${item.minutes} min, week ${next.week}).`);
  if (plan.status === "pending") {
    lines.push(th ? "แผนของคุณรอหัวหน้าอนุมัติอยู่ ระหว่างนี้เปิดดูเนื้อหาล่วงหน้าได้นะคะ" : "Your plan is waiting for your manager's approval, so you can preview it but not start yet.");
  } else if (plan.status !== "approved") {
    lines.push(th ? "แผนของคุณยังไม่ได้ส่งให้หัวหน้าค่ะ ส่งได้ที่แท็บแผนการเรียนนะคะ" : "Your plan isn't with your manager yet: submit it from the Learning path tab.");
  } else if (next.status === "in_progress") {
    lines.push(th ? "คุณเริ่มไว้แล้ว เรียนต่อจากเดิมได้เลยค่ะ" : "You've already started it, so pick up where you left off.");
  } else if (item.format === "video") {
    lines.push(th ? `ใช้เวลาแค่ ${item.minutes} นาที เรียนช่วงพักได้สบายๆ ค่ะ` : `It takes ${item.minutes} minutes, short enough for a break.`);
  } else if (item.format === "workshop") {
    lines.push(th ? "เปิดดูรอบอบรมได้ในหน้าบทเรียนค่ะ" : "Open it to see the session dates.");
  } else {
    lines.push(th ? "เปิดดูว่าต้องส่งหลักฐานอะไรได้ในหน้าบทเรียนค่ะ" : "Open it to see what evidence to submit.");
  }
  return { done, total, awaiting, next, text: lines.join(" ") };
}
