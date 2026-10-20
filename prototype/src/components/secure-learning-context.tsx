import { CERTIFICATES, certificateById, LEARNING_MINUTES } from "@/data/certificates";
import type { LearningRecord } from "@/lib/suite-contracts";
import type { Lang } from "@/lib/types";
import { cx } from "./kit";

const MINUTE_LABELS: Record<number, { en: string; th: string }> = {
  60: { en: "About 1 hour", th: "ประมาณ 1 ชั่วโมง" },
  120: { en: "About 2 hours", th: "ประมาณ 2 ชั่วโมง" },
  240: { en: "About 4 hours", th: "ประมาณ 4 ชั่วโมง" },
  360: { en: "6 hours or more", th: "6 ชั่วโมงขึ้นไป" },
};

const hoursLabel = (minutes: number, lang: Lang) =>
  MINUTE_LABELS[minutes]?.[lang] ?? (lang === "th" ? `${Math.round(minutes / 60)} ชั่วโมง` : `${Math.round(minutes / 60)} hours`);

/** The two skill-check questions that size the plan: monthly lesson time and certificates already held. */
export function LearningContextFields({
  lang,
  skillIds,
  minutes,
  onMinutes,
  certificates,
  onCertificates,
  disabled,
}: {
  lang: Lang;
  skillIds: string[];
  minutes: number;
  onMinutes: (minutes: number) => void;
  certificates: string[];
  onCertificates: (ids: string[]) => void;
  disabled: boolean;
}) {
  const th = lang === "th";
  const relevant = CERTIFICATES.filter((c) => skillIds.includes(c.skillId));
  const toggle = (id: string) =>
    onCertificates(certificates.includes(id) ? certificates.filter((c) => c !== id) : [...certificates, id]);
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">{th ? "ช่วยเราจัดแผนให้พอดีกับคุณ" : "Help us size your plan"}</p>
      <fieldset disabled={disabled} className="space-y-2">
        <legend className="text-sm text-ink">{th ? "ต่อเดือนคุณมีเวลาเรียนบทเรียนประมาณเท่าไร" : "How much time can you give to lessons each month?"}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEARNING_MINUTES.map((m) => (
            <label
              key={m}
              className={cx(
                "flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-xs",
                minutes === m ? "border-brand bg-brand-soft font-semibold text-ink" : "border-line text-ink-2"
              )}
            >
              <input type="radio" name="minutes-per-month" value={m} checked={minutes === m} onChange={() => onMinutes(m)} className="sr-only" />
              <span>{MINUTE_LABELS[m][lang]}</span>
              {m === 120 && <span className="text-[10px] font-normal text-brand">{th ? "เวลาเรียนที่บริษัทให้" : "Paid learning time"}</span>}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-3">
          {th
            ? "เวิร์กช็อปจะนัดกับหัวหน้า และโปรเจกต์ทำระหว่างงาน จึงไม่นับรวมในเวลานี้"
            : "Workshops are booked with your manager and projects happen during work, so they don't count here."}
        </p>
      </fieldset>
      {relevant.length > 0 && (
        <fieldset disabled={disabled} className="space-y-2">
          <legend className="text-sm text-ink">{th ? "คุณมีใบรับรองใดต่อไปนี้แล้วบ้าง" : "Which of these certificates do you already have?"}</legend>
          <div className="flex flex-wrap gap-2">
            {relevant.map((c) => {
              const on = certificates.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  className={cx(
                    "min-h-10 cursor-pointer rounded-full border px-3 text-xs transition",
                    on ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-ink-2 hover:border-brand/40"
                  )}
                >
                  {on ? "✓ " : ""}{c.name[lang]}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-3">
            {th
              ? "ระบบจะข้ามการอบรมที่ใบรับรองครอบคลุมแล้ว หัวหน้าจะตรวจสอบให้ ถ้าไม่มีให้เว้นว่างไว้ค่ะ"
              : "We'll skip training they already cover, and your manager will check them. Leave blank if you have none."}
          </p>
        </fieldset>
      )}
    </div>
  );
}

/** Read-only line for a submitted skill check; managers see that certificates are self-declared. */
export function LearningContextSummary({
  lang,
  assessment,
  forManager = false,
}: {
  lang: Lang;
  assessment: LearningRecord["assessment"];
  forManager?: boolean;
}) {
  if (!assessment.minutesPerMonth) return null;
  const th = lang === "th";
  const certs = (assessment.certificates ?? []).map((id) => certificateById(id)?.name[lang] ?? id);
  return (
    <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2 ring-1 ring-inset ring-line">
      <span className="font-semibold text-ink">{th ? "เวลาเรียน" : "Lesson time"}:</span> {hoursLabel(assessment.minutesPerMonth, lang)}
      {th ? "ต่อเดือน" : " a month"}
      {" · "}
      <span className="font-semibold text-ink">{th ? "ใบรับรอง" : "Certificates"}:</span>{" "}
      {certs.length ? certs.join(", ") : th ? "ไม่ได้ระบุ" : "none declared"}
      {forManager && certs.length > 0 && <span className="text-ink-3">{th ? " (พนักงานระบุเอง โปรดตรวจสอบ)" : " (self-declared, please check)"}</span>}
    </p>
  );
}
