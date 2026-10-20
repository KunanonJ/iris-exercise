import type { Principal } from "@/lib/suite-contracts";
import type { Bilingual, Lang } from "@/lib/types";
import { Badge, Button, Card, cx, Icon } from "./kit";

type Role = Principal["role"];

const ROLE_OPTIONS: { role: Role; icon: "home" | "team" | "skills"; title: Bilingual; persona: Bilingual; detail: Bilingual }[] = [
  {
    role: "employee",
    icon: "home",
    title: { en: "Employee", th: "พนักงาน" },
    persona: { en: "Somchai Jaidee · Senior Store Associate", th: "สมชาย ใจดี · พนักงานขายอาวุโส" },
    detail: {
      en: "Take the skill check, build a learning plan and practise with the AI coach.",
      th: "ทำแบบประเมินทักษะ สร้างแผนการเรียน และฝึกกับโค้ช AI",
    },
  },
  {
    role: "manager",
    icon: "team",
    title: { en: "Employee + team lead", th: "พนักงาน + หัวหน้าทีม" },
    persona: { en: "Malee Suksan · Store Manager", th: "มาลี สุขสันต์ · ผู้จัดการสาขา" },
    detail: {
      en: "Your own learning, plus reviewing and approving your team's skill checks, plans and projects.",
      th: "การเรียนของคุณเอง พร้อมตรวจและอนุมัติผลประเมิน แผนการเรียน และโปรเจกต์ของลูกทีม",
    },
  },
  {
    role: "leader",
    icon: "skills",
    title: { en: "HR / Executive", th: "HR / ผู้บริหาร" },
    persona: { en: "Arunee Srisuk · HR Business Partner", th: "อรุณี ศรีสุข · HR Business Partner" },
    detail: {
      en: "The organisation overview: adoption, skill readiness and impact, with group totals only.",
      th: "ภาพรวมองค์กร: การใช้งาน ความพร้อมด้านทักษะ และผลลัพธ์ เห็นเฉพาะตัวเลขรวมของกลุ่ม",
    },
  },
];

export function RolePicker({
  lang,
  current,
  busy,
  onChoose,
  onCancel,
}: {
  lang: Lang;
  current?: Role;
  busy: boolean;
  onChoose: (role: Role) => void;
  onCancel?: () => void;
}) {
  const th = lang === "th";
  return (
    <section aria-labelledby="role-picker-title" className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2 text-center">
        <Badge tone="warn" className="mx-auto w-fit">{th ? "เฉพาะเดโม" : "Demo only"}</Badge>
        <h1 id="role-picker-title" className="font-display text-2xl font-bold">
          {th ? "เลือกบทบาทที่ต้องการทดลองใช้" : "Choose how you want to explore"}
        </h1>
        <p className="text-sm text-ink-2">
          {th
            ? "ในการใช้งานจริง บทบาทมาจากระบบ HR และสายบังคับบัญชา ไม่ได้ให้ผู้ใช้เลือกเอง เปลี่ยนบทบาทได้ตลอดจากปุ่มด้านบนค่ะ"
            : "In the real rollout, roles come from the HR system and the org chart, not from a menu. You can switch roles at any time from the top bar."}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLE_OPTIONS.map((option) => {
          const selected = option.role === current;
          return (
            <button
              key={option.role}
              type="button"
              disabled={busy}
              onClick={() => onChoose(option.role)}
              aria-pressed={selected}
              className={cx(
                "flex min-h-44 cursor-pointer flex-col gap-2 rounded-2xl border bg-surface p-4 text-left shadow-2xs transition hover:border-brand/50 disabled:cursor-wait disabled:opacity-60",
                selected ? "border-brand ring-2 ring-brand/30" : "border-line"
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name={option.icon} className="h-4 w-4" />
              </span>
              <span className="font-semibold text-ink">{option.title[lang]}</span>
              <span className="text-xs font-medium text-brand">{option.persona[lang]}</span>
              <span className="text-sm text-ink-2">{option.detail[lang]}</span>
              {selected && <span className="mt-auto text-xs font-semibold text-brand">{th ? "บทบาทปัจจุบัน" : "Current role"}</span>}
            </button>
          );
        })}
      </div>
      <Card>
        <p className="text-xs text-ink-3">
          {th
            ? "ทุกคนที่เลือกบทบาทเดียวกันใช้โปรไฟล์เดโมร่วมกัน คุณจึงอาจเห็นการเปลี่ยนแปลงจากผู้อื่น ข้อมูลทั้งหมดเป็นข้อมูลสมมติ"
            : "Everyone who picks the same role shares one demo profile, so you may see changes made by others. All data is synthetic."}
        </p>
      </Card>
      {onCancel && (
        <div className="text-center">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {th ? "ยกเลิก" : "Cancel"}
          </Button>
        </div>
      )}
    </section>
  );
}
