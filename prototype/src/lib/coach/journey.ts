// Where the employee is in the journey (skill check -> manager -> plan -> learning), so the
// coach never calls estimates "results" or recommends steps the employee can't take yet.
import { certificateById } from "../../data/certificates";
import type { LearningRecord } from "../suite-contracts";
import type { Lang, LearningPlan } from "../types";

export interface CoachJourney {
  assessment: LearningRecord["assessment"]["status"];
  minutesPerMonth?: number;
  certificates?: string[];
}

const hours = (minutes: number) => Math.max(1, Math.round(minutes / 60));
const hoursEn = (minutes: number) => `${hours(minutes)} ${hours(minutes) === 1 ? "hour" : "hours"}`;

/** The one step the employee can take next, until they have an approved plan; then undefined. */
export function journeyGuidance(journey: CoachJourney | undefined, plan: LearningPlan | undefined, lang: Lang): string | undefined {
  if (!journey) return undefined;
  const th = lang === "th";
  switch (journey.assessment) {
    case "not_started":
      return th
        ? "เริ่มจากแบบประเมินทักษะก่อนนะคะ ใช้เวลาประมาณ 5 นาทีที่แท็บประเมินทักษะ เมื่อหัวหน้าอนุมัติแล้ว คุณจะสร้างแผนการเรียนได้ค่ะ"
        : "Start with your skill check: about 5 minutes on the Skill check tab. Once your manager approves it, you can build your learning plan.";
    case "changes_requested":
      return th
        ? "หัวหน้าขอให้แก้ไขแบบประเมินทักษะค่ะ เปิดแท็บประเมินทักษะ อ่านหมายเหตุจากหัวหน้า แล้วส่งอีกครั้งนะคะ"
        : "Your manager asked you to update your skill check. Open the Skill check tab, read their note and send it again.";
    case "submitted":
      return th
        ? "แบบประเมินทักษะของคุณรอหัวหน้าอนุมัติอยู่ค่ะ เมื่ออนุมัติแล้วคุณจะสร้างแผนการเรียนได้ ระหว่างนี้ถามโค้ชเรื่องทักษะของตำแหน่งถัดไปได้นะคะ"
        : "Your skill check is with your manager. Once they approve it, you can build your learning plan. Meanwhile, ask me about the skills for your next role.";
  }
  if (!plan || plan.steps.length === 0) {
    const time = journey.minutesPerMonth
      ? th ? ` แผนจะจัดให้พอดีกับเวลาเรียนประมาณ ${hours(journey.minutesPerMonth)} ชั่วโมงต่อเดือนที่คุณบอกไว้ค่ะ` : ` It will fit the ${hoursEn(journey.minutesPerMonth)} a month you told us.`
      : "";
    return th
      ? `แบบประเมินทักษะของคุณได้รับอนุมัติแล้วค่ะ ไปที่แท็บแผนการเรียน แล้วกด "สร้างแผนการเรียน"${time}`
      : `Your skill check is approved. Go to the Learning plan tab and tap "Build my plan".${time}`;
  }
  if (plan.status === "draft")
    return th
      ? 'แผนการเรียนของคุณพร้อมแล้วค่ะ ตรวจดูที่แท็บแผนการเรียน แล้วกด "ส่งแผนให้หัวหน้าอนุมัติ" นะคะ'
      : 'Your learning plan is ready. Check it on the Learning plan tab, then tap "Send plan to my manager".';
  if (plan.status === "changes_requested")
    return th
      ? "หัวหน้าขอให้ปรับแผนการเรียนค่ะ เปิดแท็บแผนการเรียน อ่านหมายเหตุ แล้วสร้างแผนใหม่หรือส่งอีกครั้งนะคะ"
      : "Your manager asked for changes to your plan. Open the Learning plan tab, read their note, then rebuild it or send it again.";
  if (plan.status === "pending")
    return th
      ? "แผนการเรียนของคุณรอหัวหน้าอนุมัติอยู่ค่ะ เมื่ออนุมัติแล้วเริ่มขั้นแรกได้เลยนะคะ"
      : "Your plan is with your manager. Once they approve it, you can start the first step.";
  return undefined;
}

/** A sentence about the monthly lesson time for a self-paced step, or "". */
export function timeNote(journey: CoachJourney | undefined, minutes: number, lang: Lang): string {
  if (!journey?.minutesPerMonth) return "";
  return lang === "th"
    ? `\nใช้เวลา ${minutes} นาที จากเวลาเรียนประมาณ ${hours(journey.minutesPerMonth)} ชั่วโมงต่อเดือนของคุณค่ะ`
    : `\nIt takes ${minutes} minutes of your ${hoursEn(journey.minutesPerMonth)} a month.`;
}

/** Certificate names, for "your plan already counts these". */
export const certificateNames = (journey: CoachJourney | undefined, lang: Lang) =>
  (journey?.certificates ?? []).map((id) => certificateById(id)?.name[lang] ?? id);

/** Extra lines for the live model's <employee_context>. */
export function journeyForPrompt(journey?: CoachJourney): string {
  if (!journey) return "";
  const status = {
    not_started: "not started (levels below are starting estimates, not results)",
    submitted: "sent, waiting for manager approval (levels are not final)",
    changes_requested: "returned by the manager for changes (levels are not final)",
    approved: "approved by the manager",
  }[journey.assessment];
  return [
    `\nSkill check: ${status}`,
    journey.minutesPerMonth ? `Monthly lesson time: about ${journey.minutesPerMonth} minutes` : "",
    journey.certificates?.length ? `Certificates (self-declared): ${certificateNames(journey, "en").join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
